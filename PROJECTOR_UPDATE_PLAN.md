# Projector Update Plan

## Problem Statement

The current projection system stores all projections in a single `projections` table with schema
`(realm_id, projection_name, key, value)`. This creates two problems:

1. **Multiple shapes per projection** — `account_lookup` stores 6 different key/value shapes
   (PAT hash entries, username lookups, account info, reverse indexes, etc.) under one
   `projection_name`. `account_list` mixes full account documents with `pat_counted:*` boolean
   markers. The table is a bag of opaque JSON blobs with prefixed keys acting as poor-man's
   secondary indexes.

2. **No discoverability** — You cannot look at the database and understand the schema. Every row
   could have any shape. Listing a projection returns heterogeneous documents that callers must
   filter by key prefix.

## Design Principles

1. **Each projection is its own table.** Schema: `(realm_id TEXT, key TEXT, doc TEXT,
   PRIMARY KEY(realm_id, key))`. The `doc` column is always a JSON document. Schema evolution
   happens by changing the JSON shape and rebuilding from the event stream — no column migrations.

2. **Every row in a projection table has the same document shape.** No auxiliary keys
   (`pat_counted:*`, `child_counted:*`, `dep:*`, `cycle:*`). If you need a different shape,
   that is a different projection and a different table.

3. **A projection is a query model, not a mutable document.** Each projection answers one specific
   read question. The event stream is the source of truth. Projections are derived, disposable,
   and rebuildable.

4. **One projector per projection table, no exceptions.** A projector writes only to its own
   table. It does not read from other projectors' tables. If a projector needs information that
   comes from other events, it listens to those events itself and tracks the needed state in its
   own document.

5. **Registration creates the table.** When a projector is registered with the engine,
   the engine automatically runs `CREATE TABLE IF NOT EXISTS projection_{name} (...)`.
   No separate migration files. No manual schema maintenance. Safe to run on every startup
   because it is `IF NOT EXISTS`.

## Interface Changes

### `Projector` interface (`core/projection.go`)

Add `TableName()`:

```go
type Projector interface {
    Name() string        // projector name, used for checkpoints
    TableName() string   // the projection table this projector owns (e.g., "pat_auth")
    Handle(ctx context.Context, event Event, store ProjectionStore) error
}
```

### `ProjectionEngine.Register()` (`core/engine.go`)

On registration, auto-create the table:

```sql
CREATE TABLE IF NOT EXISTS projection_{tableName} (
    realm_id TEXT NOT NULL,
    key      TEXT NOT NULL,
    doc      TEXT NOT NULL,
    PRIMARY KEY (realm_id, key)
)
```

The engine also exposes `RegisteredTables() []string` for the rebuild command to use.

### `ProjectionStore` interface (`core/store.go`)

The `projectionName` parameter is replaced by `table`:

```go
type ProjectionStore interface {
    Get(ctx context.Context, table string, realmID string, key string, dest any) error
    List(ctx context.Context, table string, realmID string) ([]json.RawMessage, error)
    Put(ctx context.Context, table string, realmID string, key string, value any) error
    Delete(ctx context.Context, table string, realmID string, key string) error
}
```

SQL becomes: `SELECT doc FROM projection_{table} WHERE realm_id = ? AND key = ?`

## Idempotency Without Auxiliary Keys

The old approach used auxiliary keys (`pat_counted:{patID}`, `child_counted:{childID}`) stored
as separate rows to track idempotency. These violate the one-shape-per-table rule. Idempotency
is handled differently for each case:

- **PAT count in `account_directory`**: The projector maintains a `pats` array in the account
  document and derives `pat_count` from `len(pats)`. PATCreated appends to the array;
  PATRevoked removes from it. Re-replaying is idempotent because append checks for duplicates
  and remove is a no-op if the entry is absent.

- **Child count in `rune_child_count`**: Child IDs are deterministic (`parent.1`, `parent.2`).
  The projector extracts the sequence number from the child ID suffix and only increments if
  `count < sequence_number`. No auxiliary key needed.

- **All other projectors**: Use standard read-modify-write. `Put` is an upsert, so replaying
  events is safe.

## Projection Catalog

All tables follow this schema template:

```sql
CREATE TABLE IF NOT EXISTS projection_{name} (
    realm_id TEXT NOT NULL,
    key      TEXT NOT NULL,
    doc      TEXT NOT NULL,
    PRIMARY KEY (realm_id, key)
)
```

### Account & Auth Projections (realm: `_admin`)

| Projector | Table | Key | Doc Shape |
|---|---|---|---|
| `PATKeyHashProjector` | `projection_pat_by_keyhash` | `key_hash` | `{key_hash, pat_id, account_id}` |
| `PATIDProjector` | `projection_pat_by_id` | `pat_id` | `{pat_id, key_hash, account_id}` |
| `AccountAuthProjector` | `projection_account_auth` | `account_id` | `{account_id, username, status, realms, roles}` |
| `AccountDirectoryProjector` | `projection_account_directory` | `account_id` | `{account_id, username, status, realms, roles, pat_count, pats, created_at}` |
| `UsernameLookupProjector` | `projection_username_lookup` | `username` | `{username, account_id}` |
| `SystemStatusProjector` | `projection_system_status` | `"status"` (constant) | `{admin_account_ids: [...], realm_ids: [...]}` |

**Auth read path** (two O(1) primary key lookups):
1. `projection_pat_by_keyhash[key_hash]` → `account_id`
2. `projection_account_auth[account_id]` → status, realms, roles

**Why `AccountAuthProjector` is separate from `AccountDirectoryProjector`**: Auth needs to be
fast and minimal. The directory projection carries additional display fields (`pat_count`,
`pats`, `created_at`) that are irrelevant to request authentication.

**`SystemStatusProjector` self-contained design**: Tracks `admin_account_ids` and `realm_ids`
as lists in its own document. Consumers derive `has_sysadmin` from
`len(admin_account_ids) > 0`. When `RoleRevoked` fires, the account is removed from the list.
The projector never reads outside its own table.

**Events per projector:**

| Projector | Events |
|---|---|
| `PATKeyHashProjector` | PATCreated, PATRevoked |
| `PATIDProjector` | PATCreated, PATRevoked |
| `AccountAuthProjector` | AccountCreated, AccountSuspended, RealmGranted, RealmRevoked, RoleAssigned, RoleRevoked |
| `AccountDirectoryProjector` | AccountCreated, AccountSuspended, RealmGranted, RealmRevoked, RoleAssigned, RoleRevoked, PATCreated, PATRevoked |
| `UsernameLookupProjector` | AccountCreated |
| `SystemStatusProjector` | AccountCreated, RoleAssigned, RoleRevoked, RealmCreated |

### Realm Projections (realm: `_admin`)

| Projector | Table | Key | Doc Shape |
|---|---|---|---|
| `RealmDirectoryProjector` | `projection_realm_directory` | `realm_id` | `{realm_id, name, status, created_at}` |
| `RealmNameLookupProjector` | `projection_realm_name_lookup` | `name` | `{name, realm_id}` |

**Realm name resolution** is now a single O(1) lookup on `projection_realm_name_lookup[name]`
instead of scanning all realm_list rows in memory.

**Events per projector:**

| Projector | Events |
|---|---|
| `RealmDirectoryProjector` | RealmCreated, RealmSuspended |
| `RealmNameLookupProjector` | RealmCreated |

### Rune Projections (realm: per-realm)

| Projector | Table | Key | Doc Shape |
|---|---|---|---|
| `RuneSummaryProjector` | `projection_rune_summary` | `rune_id` | `{id, title, status, priority, claimant, parent_id, branch, type, created_at, updated_at}` |
| `RuneDetailProjector` | `projection_rune_detail` | `rune_id` | `{id, title, description, status, priority, claimant, parent_id, branch, type, dependencies, notes, created_at, updated_at}` |
| `RuneDependencyGraphProjector` | `projection_rune_dependency_graph` | `rune_id` | `{rune_id, dependencies: [{target_id, relationship}], dependents: [{source_id, relationship}]}` |
| `DependencyExistenceProjector` | `projection_dependency_existence` | `{rune_id}:{target_id}:{relationship}` | `{rune_id, target_id, relationship}` |
| `DependencyCycleCheckProjector` | `projection_dependency_cycle_check` | `{source_id}:{target_id}` | `{source_id, target_id}` |
| `RuneChildCountProjector` | `projection_rune_child_count` | `parent_rune_id` | `{parent_rune_id, count}` |

**Splitting `dependency_graph`**: The old projection mixed three shapes under one name.
Each is now its own table answering one question:
- `projection_rune_dependency_graph` — "what are this rune's deps/dependents?" (for display and sweep)
- `projection_dependency_existence` — "does this specific dependency exist?" (for HandleRemoveDependency)
- `projection_dependency_cycle_check` — "would adding this edge create a cycle?" (for HandleAddDependency)

Row existence is the answer for the last two: if the row exists, the answer is yes.
The doc is stored for debuggability but the `Get` result is not strictly needed.

**Events per projector:**

| Projector | Events |
|---|---|
| `RuneSummaryProjector` | RuneCreated, RuneUpdated, RuneClaimed, RuneUnclaimed, RuneFulfilled, RuneForged, RuneSealed, RuneShattered |
| `RuneDetailProjector` | RuneCreated, RuneUpdated, RuneClaimed, RuneUnclaimed, RuneFulfilled, RuneForged, RuneSealed, RuneShattered, DependencyAdded, DependencyRemoved, RuneNoted |
| `RuneDependencyGraphProjector` | DependencyAdded, DependencyRemoved, RuneShattered |
| `DependencyExistenceProjector` | DependencyAdded, DependencyRemoved |
| `DependencyCycleCheckProjector` | DependencyAdded, DependencyRemoved |
| `RuneChildCountProjector` | RuneCreated (only when ParentID is set) |

### Agent / Skill / Workflow / Runner Projections (realm: per-realm)

These projections already have uniform document shapes. They are migrated to their own tables
with no logic changes.

| Projector | Table | Key |
|---|---|---|
| `AgentDetailProjector` | `projection_agent_detail` | `agent_id` |
| `SkillListProjector` | `projection_skill_list` | `skill_id` |
| `WorkflowListProjector` | `projection_workflow_list` | `workflow_id` |
| `RunnerSettingsProjector` | `projection_runner_settings` | `runner_settings_id` |

## Old vs. New Comparison

| Old Projection | Old Shapes | New Projections |
|---|---|---|
| `account_lookup` | 6 different key shapes | `pat_by_keyhash`, `pat_by_id`, `account_auth`, `username_lookup` |
| `account_list` | documents + `pat_counted:*` markers | `account_directory`, `system_status` |
| `realm_list` | documents (already uniform) | `realm_directory`, `realm_name_lookup` |
| `rune_list` | documents (already uniform) | `rune_summary` |
| `rune_detail` | documents (already uniform) | `rune_detail` |
| `dependency_graph` | documents + `dep:*` booleans + `cycle:*` booleans | `rune_dependency_graph`, `dependency_existence`, `dependency_cycle_check` |
| `RuneChildCount` | counts + `child_counted:*` markers | `rune_child_count` |
| `agent_detail` | documents (already uniform) | `agent_detail` |
| `skill_list` | documents (already uniform) | `skill_list` |
| `workflow_list` | documents (already uniform) | `workflow_list` |
| `runner_settings` | documents (already uniform) | `runner_settings` |

**Total: 7 old projections (with mixed shapes) → 19 new projections (one shape each)**

## Rebuild Command

The `rebuild-projections` command asks the engine for all registered table names and truncates
each one, then resets checkpoints and replays:

```go
for _, table := range engine.RegisteredTables() {
    db.Exec("DELETE FROM projection_" + table)
}
db.Exec("DELETE FROM checkpoints")
engine.RunCatchUpOnce(ctx)
```

## Execution Order

1. **Update `Projector` interface** in `core/projection.go` — add `TableName()`
2. **Update `ProjectionEngine`** in `core/engine.go` — auto-create table on `Register()`,
   expose `RegisteredTables()`
3. **Update `ProjectionStore` interface** in `core/store.go` — `table` replaces `projectionName`
4. **Update SQLite and Postgres store implementations** — queries use `projection_{table}` as the
   table name; remove the old generic `projections` table DDL from the schema
5. **Rewrite all projectors** in `domain/projectors/` — implement new `TableName()`, write to
   named tables, no auxiliary keys
6. **Update all consumers** — every `Get`/`List` call uses new table names and expects new doc
   shapes; update server handlers, middleware, CLI, and domain handlers
7. **Update `rebuild-projections`** — truncate via `engine.RegisteredTables()`
8. **Update all tests** — projector unit tests and integration tests
9. **No migration needed** — drop old `projections` table from schema DDL and rebuild from
   the event stream

## What Is Not Changing

- The event store schema and event types are unchanged.
- The checkpoint store is unchanged.
- The `ProjectionEngine` catch-up and sync logic is unchanged (only `Register` gains
  table-creation behavior).
- Projector registration in `server/main.go` gains new projectors but is otherwise the same pattern.
