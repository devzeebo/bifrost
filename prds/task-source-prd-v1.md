# Bifrost Task Source PRD

**Status:** Draft
**Authors:** Eric Siebeneich
**Date:** 2026-05-07
**Version:** 1.0

---

## Product Description, Problem, and Goal

### Product Description

The **Bifrost Task Source** is a plugin implementation of the Orchestrator Framework's `TaskSource` interface that connects to a **Bifrost** server—the event-sourced rune management service. It enables orchestrator instances to discover, claim, and fulfill **runes** (work items) stored in Bifrost, providing seamless integration between AI agent orchestration and the Bifrost task management system.

**Key Terms:**

- **Bifrost**: Event-sourced rune (work item) management service for AI agents
- **Rune**: A work item in Bifrost (issue, task, bug, feature, etc.)
- **Saga**: An epic; a collection of related runes in Bifrost
- **Realm**: A tenant namespace in Bifrost for organizing runes with credentials
- **Task Source**: Orchestrator Framework plugin that discovers, claims, and fulfills tasks from external systems
- **Claimant**: Identifier for the agent instance currently working on a task
- **Rune State**: The lifecycle state of a rune (draft, forged, open, claimed, fulfilled, sealed)
- **PAT**: Personal Access Token used for authentication with Bifrost
- **Orchestrator**: TypeScript-based distributed task execution system that coordinates AI agents
- **taskState**: Free-form object containing all context for a single task execution

### Problem

Sarah has deployed the Orchestrator Framework to automate code maintenance across her monorepo. Her team uses Bifrost for rune management—developers create runes for features, bugs, and refactors. She wants her AI agents to automatically pick up and work on these runes, but she faces three problems:

1. **No integration**: The orchestrator's default API task source doesn't understand Bifrost's rune lifecycle, state model, or event-sourced architecture
2. **No coordination**: Multiple orchestrator instances might claim the same rune, causing duplicate work and race conditions
3. **No state synchronization**: When an agent completes work, the rune state in Bifrost isn't automatically updated—developers must manually mark runes as fulfilled

Marcus, Sarah's teammate, has written custom scripts to poll Bifrost's HTTP API and dispatch work to agents. These scripts are fragile—they don't handle reconnection, don't respect Bifrost's claim semantics, and error handling is ad-hoc. When the Bifrost server is temporarily unavailable, the scripts crash and lose track of which runes were being processed. When two script instances run simultaneously, they both claim the same rune, wasting compute resources and creating conflicting code changes.

Sarah spends time manually deconflicting agent work, restarting crashed scripts, and syncing rune states back to Bifrost. She can't reliably scale her automation because the integration layer is a house of cards.

### Goal

With the Bifrost Task Source plugin, Sarah configures her orchestrator instances to connect directly to her Bifrost server. The plugin:

1. Authenticates using a PAT with realm-scoped permissions
2. Polls for runes in the `open` state that are ready for work
3. Uses Bifrost's native claim API to ensure exclusive ownership (no duplicate work)
4. Maps Bifrost runes to orchestrator Tasks with full metadata (tags, dependencies, notes)
5. Executes agents via the orchestrator framework
6. Automatically updates rune state to `fulfilled` on success, `open` on recoverable errors
7. Handles Bifrost server unavailability with exponential backoff reconnection
8. Emits structured telemetry for every operation (claim, execution, completion)

Marcus removes his fragile scripts. The orchestrator instances now coordinate seamlessly through Bifrost's claim semantics. When a rune is completed, its state is automatically updated—developers see real-time progress in the Bifrost UI. Sarah can deploy multiple orchestrator instances knowing they won't duplicate work. The system is reliable, observable, and requires no custom glue code.

---

## User Stories / Use Cases

### US-1: Configure orchestrator to use Bifrost Task Source

**As a** platform engineer
**I want** to configure the orchestrator to use the Bifrost Task Source with connection details and credentials
**So that** orchestrator instances can connect to my Bifrost server

**Acceptance Criteria:**

```
Given a .orchestrator.yaml configuration file
And orchestrate.task_source.type is "bifrost"
And orchestrate.task_source.settings.baseUrl is "https://bifrost.example.com"
And orchestrate.task_source.settings.realm is "my-project"
And orchestrate.task_source.settings.pat is a valid PAT
When the orchestrator loads configuration
Then a BifrostTaskSource is created with the specified baseUrl, realm, and PAT
And the BifrostTaskSource connects to the Bifrost server
```

```
Given a .orchestrator.yaml configuration file
And orchestrate.task_source.settings.pollInterval is 30
When the orchestrator loads configuration
Then the BifrostTaskSource polls for ready runes every 30 seconds
```

```
Given a .orchestrator.yaml configuration file
And orchestrate.task_source.settings.claimant is "orchestrator-prod-1"
When the orchestrator loads configuration
Then the BifrostTaskSource uses "orchestrator-prod-1" as the claimant identifier for all rune claims
```

### US-2: Poll for ready runes and claim them

**As an** orchestrator instance
**I want** to poll Bifrost for runes in the `open` state that are ready for work
**So that** I can claim and execute them

**Acceptance Criteria:**

```
Given the Bifrost Task Source is configured
And one or more runes exist in the configured realm with state "open"
And all rune dependencies are satisfied (no blocking runes)
When the poll interval elapses
Then the Bifrost Task Source queries Bifrost for ready runes
And each ready rune is yielded via the async iterator
```

```
Given a ready rune is yielded from the async iterator
When the orchestrator receives the rune
Then the Bifrost Task Source claims the rune via Bifrost's claim API
And the rune state in Bifrost transitions to "claimed"
And the claimant field is set to the configured claimant identifier
```

```
Given two orchestrator instances poll simultaneously
And the same rune is ready for work
When both instances attempt to claim the rune
Then only one instance successfully claims the rune
And the other instance receives a conflict error
And the conflict error is logged
And the unsuccessful instance does not process the rune
```

```
Given the Bifrost server is unreachable
When the Bifrost Task Source attempts to poll
Then the poll attempt is logged as failed
And the Task Source waits for the configured poll interval before retrying
```

### US-3: Map Bifrost runes to orchestrator Tasks

**As the** orchestrator framework
**I want** Bifrost runes to be mapped to the Task interface with all relevant metadata
**So that** agents can access rune context

**Acceptance Criteria:**

```
Given a claimed Bifrost rune with title "Fix login bug"
And the rune has description "Users cannot authenticate"
And the rune has tags ["bug", "auth", "priority:high"]
And the rune has priority 2
When the rune is mapped to an orchestrator Task
Then Task.id is the rune ID
And Task.title is "Fix login bug"
And Task.description is "Users cannot authenticate"
And Task.tags is ["bug", "auth", "priority:high", "worker:implementer"] (worker tag added if not present)
And Task.priority is 2
And Task.status is "IN_PROGRESS"
And Task.claimant is the configured claimant identifier
```

```
Given a Bifrost rune with acceptance criteria
And the rune has dependencies on other runes
And the rune has notes from developers
When the rune is mapped to an orchestrator TaskDetail
Then TaskDetail.acceptanceCriteria contains all AC entries
And TaskDetail.dependencies contains all DependencyRef entries
And TaskDetail.notes contains all NoteEntry entries
```

```
Given a Bifrost rune with branch tracking enabled
And the rune is associated with branch "feature/fix-login"
When the rune is mapped to an orchestrator Task
Then Task.metadata contains the branch name
And agents can access the branch information via taskState
```

### US-4: Complete rune on successful agent execution

**As the** orchestrator framework
**I want** to mark a rune as fulfilled when the agent completes successfully
**So that** developers see the updated state in Bifrost

**Acceptance Criteria:**

```
Given a rune has been claimed and processed by an agent
And the agent execution completed successfully
When the orchestrator calls completeTask(taskId)
Then the Bifrost Task Source calls Bifrost's fulfill API
And the rune state transitions to "fulfilled"
And a completion note is added with execution telemetry (duration, tokens used, cost)
And the method returns true
```

```
Given a rune has been claimed and processed
And the agent execution failed with a recoverable error
When the orchestrator calls failTask(taskId, error)
Then the Bifrost Task Source calls Bifrost's unclaim API or reopen equivalent
And the rune state transitions to "open"
And an error note is added with the failure reason
And the method returns true
```

```
Given the Bifrost server is unreachable when completing a task
When the orchestrator calls completeTask(taskId)
Then the method throws an error
And the orchestrator logs the failure
And the orchestrator marks the task as failed in its own records
```

### US-5: Handle Bifrost server unavailability

**As an** orchestrator operator
**I want** the Bifrost Task Source to handle server unavailability gracefully
**So that** temporary outages don't crash the orchestrator

**Acceptance Criteria:**

```
Given the Bifrost Task Source is polling for tasks
And the Bifrost server becomes unreachable
When a poll attempt fails
Then the error is logged with server URL and timestamp
And the Task Source waits for the configured poll interval
And the Task Source retries polling
```

```
Given the Bifrost Task Source async iterator is active
And a network error occurs during iteration
When the error is detected
Then the async iterator does not terminate
And the error is logged
And polling continues on the next interval
```

```
Given the Bifrost server has been unavailable for 5 minutes
And the server becomes available again
When the next poll occurs
Then the Bifrost Task Source successfully connects
And polling resumes normally
And a reconnection log entry is written
```

### US-6: Filter runes by agent worker tags

**As an** orchestrator operator
**I want** to filter runes based on worker tags so that specialized agents only receive relevant work
**So that** implementer agents don't receive tester-tagged runes

**Acceptance Criteria:**

```
Given a Bifrost Task Source configured with workerTagFilter: ["implementer", "reviewer"]
And a rune has tags ["bug", "worker:tester"]
When the Bifrost Task Source polls for ready runes
Then the rune with "worker:tester" is not yielded
```

```
Given a Bifrost Task Source configured with workerTagFilter: ["implementer"]
And a rune has tags ["feature", "worker:implementer"]
When the Bifrost Task Source polls for ready runes
Then the rune is yielded
```

```
Given a Bifrost Task Source without workerTagFilter configured
And a rune has any worker tag
When the Bifrost Task Source polls for ready runes
Then all ready runes are yielded regardless of worker tag
```

### US-7: Emit telemetry for all operations

**As a** platform engineer
**I want** detailed telemetry emitted for all Bifrost Task Source operations
**So that** I can monitor integration health and debug issues

**Acceptance Criteria:**

```
Given the Bifrost Task Source successfully polls for ready runes
When the poll completes
Then a log entry is emitted with: poll timestamp, number of ready runes found, realm name
```

```
Given the Bifrost Task Source claims a rune
When the claim API call succeeds
Then a log entry is emitted with: rune ID, claimant, timestamp
```

```
Given the Bifrost Task Source fails to claim a rune due to conflict
When the conflict error is received
Then a log entry is emitted with: rune ID, conflict reason, current claimant
```

```
Given the Bifrost Task Source completes a rune
When the fulfill API call succeeds
Then a log entry is emitted with: rune ID, fulfillment timestamp, execution telemetry
```

---

## Functional Requirements

### FR-1: Configuration Schema

The Bifrost Task Source MUST support the following configuration:

```yaml
orchestrate:
  task_source:
    type: "bifrost"
    settings:
      baseUrl: string              # Bifrost server URL (e.g., "https://bifrost.example.com")
      realm: string                # Realm name to poll for runes
      pat: string                  # Personal Access Token for authentication
      claimant: string             # Claimant identifier for this orchestrator instance
      pollInterval: number         # Polling interval in milliseconds (default: 10000)
      timeout: number              # Request timeout in milliseconds (default: 30000)
      workerTagFilter: string[]    # Optional list of worker tags to filter (default: no filter)
```

### FR-2: BifrostTaskSource Implementation

The Bifrost Task Source MUST implement the `TaskSource` interface:

```typescript
export type TaskSource = {
  watchTasks: () => AsyncGenerator<Task>
  getTaskDetail: (taskId: string) => Promise<TaskDetail | null>
  completeTask: (taskId: string) => Promise<boolean>
  failTask: (taskId: string, error: string) => Promise<boolean>
}
```

### FR-3: Rune to Task Mapping

The Bifrost Task Source MUST map Bifrost runes to orchestrator Tasks with the following field mappings:

| Bifrost Field | Task Field | Notes |
|---------------|------------|-------|
| `id` | `id` | Direct mapping |
| `title` | `title` | Direct mapping |
| `description` | `description` | Direct mapping |
| `state` | `status` | Mapped: "claimed" → "IN_PROGRESS" |
| `tags` | `tags` | Direct mapping, plus worker tag inference |
| `claimant` | `claimant` | Direct mapping |
| `created_at` | `createdAt` | Date parsing |
| `updated_at` | `updatedAt` | Date parsing |
| `priority` | `priority` | Direct mapping |
| `branch` | `metadata.branch` | Stored in metadata object |
| N/A | `tags[]` | "worker:X" added if not present (inferred from agent catalog) |

### FR-4: Ready Rune Query

The Bifrost Task Source MUST query for runes that meet ALL of the following criteria:

- `state == "open"` (rune is ready to be claimed)
- All dependency runes in the `blocks` relationship are in state `fulfilled` or `sealed`
- No circular dependencies exist (enforced by Bifrost)
- If `workerTagFilter` is configured, rune has a tag matching one of the filter values

The query MUST use Bifrost's `bf ready` equivalent API endpoint.

### FR-5: Claim Semantics

The Bifrost Task Source MUST use Bifrost's native claim API to atomically claim runes. The claim operation MUST:

- Be atomic (no race conditions between multiple orchestrator instances)
- Set the rune state to `claimed`
- Set the rune's claimant field to the configured claimant identifier
- Return an error if the rune is already claimed by another claimant

On claim conflict, the Bifrost Task Source MUST log the conflict and NOT yield the rune to the orchestrator.

### FR-6: Completion and Failure Handling

On successful agent execution, the Bifrost Task Source MUST:

- Call Bifrost's fulfill API (equivalent to `bf fulfill`)
- Transition the rune state to `fulfilled`
- Add a completion note containing execution telemetry

On failed agent execution, the Bifrost Task Source MUST:

- Determine if the error is recoverable (exit code 1) or fatal (exit code 2)
- For recoverable errors: call Bifrost's unclaim/reopen API to return the rune to `open` state
- For fatal errors: leave the rune in `claimed` state and add an error note
- Add a note with the error message

### FR-7: Authentication

The Bifrost Task Source MUST authenticate using Bearer token authentication:

- Include the PAT in the `Authorization` header as `Bearer <pat>`
- Include the realm name in the `X-Bifrost-Realm` header
- Handle 401/403 responses by logging authentication failures

### FR-8: Reconnection Behavior

If the Bifrost server becomes unreachable, the Bifrost Task Source MUST:

- Log the connection error with timestamp and server URL
- Continue polling at the configured interval (no exponential backoff for v1)
- Successfully reconnect when the server becomes available
- Log successful reconnection

The `watchTasks()` async iterator MUST NOT terminate on network errors.

### FR-9: Worker Tag Inference

If a Bifrost rune does NOT have a `worker:*` tag, the Bifrost Task Source MUST:

- Examine the rune's other tags to infer an appropriate worker tag
- Use the following inference rules:
  - Tags containing `test` → `worker:tester`
  - Tags containing `review` → `worker:reviewer`
  - Tags containing `debug` or `fix` or `bug` → `worker:debugger`
  - Default → `worker:implementer`
- Add the inferred worker tag to the Task.tags array

This inference allows existing runes without worker tags to be routed appropriately.

### FR-10: Branch Metadata

If a Bifrost rune has an associated Git branch, the Bifrost Task Source MUST:

- Include the branch name in `Task.metadata.branch`
- Agents can access this via `taskState.metadata.branch` for checkout operations

### FR-11: Dependency Mapping

Bifrost dependency relationships MUST be mapped to orchestrator TaskDetail:

| Bifrost Relationship | TaskDetail.dependencies[] |
|----------------------|---------------------------|
| `blocks` | `{ taskId, type: "blocks" }` |
| `relates_to` | `{ taskId, type: "relates_to" }` |
| `duplicates` | `{ taskId, type: "duplicates" }` |
| `supersedes` | `{ taskId, type: "supersedes" }` |
| `replies_to` | `{ taskId, type: "replies_to" }` |

### FR-12: Notes and Retro Mapping

Bifrost notes and retro entries MUST be mapped to TaskDetail:

- Notes → `TaskDetail.notes[]` with `{ id, content, createdAt }`
- Retro entries → `TaskDetail.retro[]` with `{ id, content, createdAt }`

---

## Non-Functional Requirements

### NFR-1: Performance

- Polling interval MUST be configurable (default 10 seconds)
- API request timeout MUST be configurable (default 30 seconds)
- Rune to Task mapping MUST complete in under 10ms per rune
- Bifrost API calls MUST complete within the configured timeout

### NFR-2: Reliability

- The Bifrost Task Source MUST handle Bifrost server unavailability without crashing
- The Bifrost Task Source MUST log all failures without terminating the async iterator
- Claim conflicts MUST be handled gracefully (no duplicate work)
- Network errors MUST be logged and retried on next poll

### NFR-3: Monitoring and Observability

- All Bifrost API calls MUST be logged with: endpoint, status code, duration
- All claim operations MUST be logged with: rune ID, claimant, success/failure
- All fulfill/unclaim operations MUST be logged with: rune ID, result
- Poll operations MUST be logged with: realm, ready rune count
- Reconnection events MUST be logged

### NFR-4: Concurrency

- Multiple orchestrator instances MUST be able to poll simultaneously
- Bifrost's claim API ensures only one instance claims each rune
- No additional locking is required in the Bifrost Task Source

### NFR-5: Error Handling

- Authentication failures (401/403) MUST be logged and polling must continue
- Invalid PAT MUST be detected and logged on startup
- Realm not found MUST be logged and polling must continue
- Malformed API responses MUST be logged and the rune must be skipped

### NFR-6: Security

- PATs MUST be transmitted via HTTPS only
- PATs MUST NOT be logged under any circumstances
- The Bifrost Task Source MUST validate SSL certificates

### NFR-7: Compatibility

- The Bifrost Task Source MUST be compatible with Bifrost server version ≥ 1.0
- The Bifrost Task Source MUST handle API version changes gracefully for minor version bumps

---

## Data & Storage

### Commands

**PollReadyRunes**
- `realm: string`, `claimant: string`, `workerTagFilter: string[] | null`
- Occurs when: Poll interval elapses

**ClaimRune**
- `runeId: string`, `claimant: string`
- Occurs when: Ready rune is identified

**MapRuneToTask**
- `rune: BifrostRune`, `inferredWorkerTag: string | null`
- Occurs when: Claimed rune is yielded to orchestrator

**FulfillRune**
- `runeId: string`, `telemetry: ExecutionStats`
- Occurs when: Agent completes successfully

**UnclaimRune**
- `runeId: string`, `error: string`
- Occurs when: Agent fails with recoverable error

**AddRuneNote**
- `runeId: string`, `content: string`
- Occurs when: Completion or error note is added

### Events

**ReadyRunesPolled**
- `realm: string`, `readyRuneCount: number`, `pollTimestamp: ISO8601`

**RuneClaimed**
- `runeId: string`, `claimant: string`, `claimedAt: ISO8601`

**RuneClaimConflict**
- `runeId: string`, `attemptedBy: string`, `currentClaimant: string`, `conflictAt: ISO8601`

**RuneFulfilled**
- `runeId: string`, `claimant: string`, `telemetry: ExecutionStats`, `fulfilledAt: ISO8601`

**RuneUnclaimed**
- `runeId: string`, `reason: string`, `unclaimedAt: ISO8601`

**BifrostApiCallFailed**
- `endpoint: string`, `statusCode: number`, `error: string`, `timestamp: ISO8601`

**BifrostServerReconnecting**
- `baseUrl: string`, `lastError: string`, `reattemptDelay: number`, `reattemptAt: ISO8601`

**BifrostServerReconnected**
- `baseUrl: string`, `downtimeDuration: number`, `reconnectedAt: ISO8601`

### Aggregates

**BifrostRune**
```typescript
type BifrostRune = {
  id: string
  title: string
  description: string | null
  state: RuneState
  tags: string[]
  claimant: string | null
  createdAt: Date
  updatedAt: Date
  priority: number
  branch: string | null
  realmId: string
}

type RuneState = "draft" | "forged" | "open" | "claimed" | "fulfilled" | "sealed"
```

**BifrostRuneDetail**
```typescript
type BifrostRuneDetail = BifrostRune & {
  dependencies: BifrostDependency[]
  notes: BifrostNote[]
  acceptanceCriteria: BifrostAC[]
  retro: BifrostRetroEntry[]
}

type BifrostDependency = {
  taskId: string
  type: "blocks" | "relates_to" | "duplicates" | "supersedes" | "replies_to"
}

type BifrostNote = {
  id: string
  content: string
  createdAt: Date
}

type BifrostAC = {
  id: string
  criteria: string
  satisfied: boolean
}

type BifrostRetroEntry = {
  id: string
  content: string
  createdAt: Date
}
```

**BifrostTaskSourceConfig**
```typescript
type BifrostTaskSourceConfig = {
  baseUrl: string
  realm: string
  pat: string
  claimant: string
  pollInterval: number
  timeout: number
  workerTagFilter: string[] | null
}
```

### Query Projections

**ReadyRunesQuery**
- Question: Which runes in this realm are ready to be claimed?
- Projection: List of `BifrostRune` filtered by state="open", satisfied dependencies, realm
- Used by: Poll operation

**RuneDetailQuery**
- Question: What is the full detail for a specific rune?
- Projection: `BifrostRuneDetail` by rune ID
- Used by: getTaskDetail, agent context

**ClaimantStatusQuery**
- Question: Which runes are currently claimed by this orchestrator instance?
- Projection: List of `BifrostRune` filtered by claimant and state="claimed"
- Used by: Status reporting, recovery

### Data Retention

- Bifrost Task Source does NOT persist data locally
- All rune state is stored in Bifrost server
- Event logs for telemetry follow orchestrator framework retention policy (90 days)

---

## Out of Scope

- Real-time push notifications (polling only, no webhooks in v1)
- Custom claim semantics (uses Bifrost's built-in claim API)
- Multi-realm polling (one task source instance = one realm)
- Rune creation from the orchestrator (runes are created externally)
- Saga-level orchestration (individual runes only)
- Automatic retry on failure (manual retry only via Bifrost UI or CLI)
- Bifrost server administration (no realm/account management from task source)
- Migration tools (no import from other task systems)
- Advanced scheduling (FIFO polling based on Bifrost's ready query order)
- Custom priority handling (Bifrost priority is informational only)
- Branch creation (branch must already exist or be created externally)
- Dependency resolution visualization (no graph generation)

---

## Dependencies and Assumptions

### Dependencies

| Dependency | Purpose | Version |
|---|---|---|---|
| Bifrost Server | Rune management backend | ≥ 1.0 |
| Orchestrator Framework | Core orchestration system | 1.0 |
| TypeScript Runtime | Task source execution | ≥ 24 |
| Node.js fetch API | HTTP requests to Bifrost | Built-in |

### Assumptions

1. Bifrost server is accessible via HTTPS from the orchestrator runtime environment
2. A valid PAT with at least `member` role in the target realm is available
3. Bifrost server's claim API is atomic and prevents duplicate claims
4. The realm specified in configuration exists
5. Network connectivity allows periodic polling at the configured interval
6. Bifrost server's `bf ready` equivalent API endpoint exists and returns ready runes
7. Bifrost server supports fulfill and unclaim/reopen API endpoints
8. Time synchronization between orchestrator and Bifrost server is adequate (clock skew < 1 minute)
9. The orchestrator framework provides the TaskSource interface contract
10. Agent catalog provides available worker tags for inference

### External System Assumptions

- **Bifrost Server**: Provides HTTP API for rune CRUD operations, claim/unclaim, fulfill, and ready query. API is versioned and backward-compatible for minor versions. Supports PAT authentication and realm-scoped queries.
- **Orchestrator Framework**: Provides TaskSource interface, defines Task and TaskDetail types, handles agent dispatch, and manages hook execution.

---

## Decision Records

This section records decisions made during the development of the Bifrost Task Source. Each decision includes the question, the answer, and the rationale.

### DR-1: Rune filtering in task source

**Question**: Should the task source filter runes by worker tag, or should it yield all ready runes and let the orchestrator handle filtering?

**Decision**: No. The task source should not do any rune filtering. If it's ready, it goes in the async generator.

**Rationale**: Filtering is the orchestrator's responsibility, not the task source's. The task source's job is to provide ready runes from the backend system. The orchestrator framework has agent routing mechanisms that determine which worker should handle which task. Adding filtering to the task source creates unnecessary complexity and coupling between the task source and agent catalog.

**Impact**: 
- Remove `workerTagFilter` from configuration schema
- Remove US-6 (Filter runes by agent worker tags)
- Update FR-4 to remove worker tag filtering criteria
- Remove FR-9 (Worker Tag Inference)

---

### DR-2: Task source responsibility for completion/failure handling

**Question**: Is the task source responsible for determining whether an error is recoverable vs fatal and managing rune state accordingly?

**Decision**: No. The task source is not responsible for this. The orchestrator either fulfills or fails it via `completeTask()` or `failTask()`.

**Rationale**: The task source's job is to provide the interface for completion and failure. Determining the nature of the error and the appropriate response is the orchestrator's concern. The task source simply calls the appropriate Bifrost API based on which orchestrator method is invoked.

**Impact**:
- Remove error classification logic from FR-6
- Simplify FR-6 to: call fulfill API on `completeTask()`, call unclaim API on `failTask()`
- Remove exit code interpretation from task source

---

### DR-3: Polling interval default

**Question**: What should the default polling interval be?

**Decision**: 10 seconds.

**Rationale**: Matches the orchestrator framework's default. Provides good balance between responsiveness and resource usage.

**Impact**: Already specified in v1. No change needed.

---

### DR-4: Bifrost API version compatibility

**Question**: How should the task source handle Bifrost API version changes?

**Decision**: Don't worry about versioning. Assume it's all the correct versions.

**Rationale**: The task source and Bifrost server are developed together. Version compatibility is managed at the deployment level, not in the task source code.

**Impact**:
- Remove version compatibility requirements from NFR-7
- Remove OQ-4 from v2

---

### DR-5: Credential source and management

**Question**: Where should the task source read credentials from?

**Decision**: Read the server URL and realm from the `.bifrost.yaml` of the working repository. Read the credentials (PAT) for that repo from `~/.config/bifrost/credentials.yaml`.

**Rationale**: This follows the Bifrost CLI's credential management pattern. The `.bifrost.yaml` in the working repo specifies which server and realm to use. The credentials file maps those to PATs. This avoids hardcoding PATs in orchestrator config and supports multiple realms/credentials.

**Impact**:
- Remove `pat` from `.orchestrator.yaml` configuration
- Add logic to read `.bifrost.yaml` from `projectDir`
- Add logic to read `~/.config/bifrost/credentials.yaml`
- Update configuration schema to only include optional overrides
- Update FR-1 configuration schema
- Add credential resolution to FR-7 (Authentication)

---

## Open Questions

### OQ-1: Worker tag inference vs. explicit requirement

**Ambiguity**: Should the Bifrost Task Source infer worker tags for runes that don't have them, or should such runes be rejected?

**Assumption**: Infer worker tags based on existing tags using the heuristic rules specified in FR-9.

**Ideal Solution**: Infer worker tags for backward compatibility with existing runes. This allows existing Bifrost projects without worker tags to work with the orchestrator without manual data migration.

**Alternatives**:
1. **Reject runes without worker tags**: Fails fast and forces explicit tagging, but breaks existing workflows and requires manual migration of all runes.
2. **Default all runes to `worker:implementer`**: Simpler than inference but may misroute specialized work (test runes would go to implementers).

**Comparison**: Inference provides the best balance of backward compatibility and correct routing. Rejection breaks existing workflows. Defaulting to implementer causes misrouting. The heuristic approach in FR-9 covers common tagging patterns while allowing explicit tags to override.

---

### OQ-2: Recoverable vs. fatal error handling

**Ambiguity**: When an agent fails, how should the task source determine if the error is recoverable (return rune to pool) vs. fatal (leave claimed)?

**Assumption**: Use the orchestrator's hook exit code convention: exit code 1 = recoverable (follow-up possible), exit code 2 = fatal.

**Ideal Solution**: Respect the orchestrator's hook exit code contract. Exit code 1 indicates a recoverable issue that might be resolved by another agent or same agent with follow-up. Exit code 2 indicates a fatal error that requires human intervention.

**Alternatives**:
1. **Always return runes to pool on failure**: Maximizes retry but may retry hopeless failures indefinitely.
2. **Never return runes to pool**: Minimizes noise but requires manual intervention for all failures.
3. **Add explicit error classification in API**: Requires Bifrost server changes and additional configuration.

**Comparison**: Using the existing exit code convention requires no new configuration or Bifrost changes. Always returning to pool creates retry loops. Never returning creates operational overhead. The exit code approach balances automation with appropriate stopping conditions.

---

### OQ-3: Polling interval default

**Ambiguity**: What should the default polling interval be? Too frequent wastes resources; too infrequent increases latency.

**Assumption**: Default to 10 seconds, matching the orchestrator framework's default.

**Ideal Solution**: Use 10 seconds as default, make it configurable. This provides a good balance between responsiveness and resource usage for most workloads.

**Alternatives**:
1. **Default to 30 seconds**: Reduces API load but increases latency for new runes.
2. **Default to 5 seconds**: Reduces latency but increases API load significantly.
3. **Adaptive polling based on rune availability**: More complex but optimizes for both scenarios.

**Comparison**: 10 seconds is a proven default in the orchestrator framework. 30 seconds adds noticeable delay. 5 seconds creates excessive load for large deployments. Adaptive polling is complex and error-prone for v1.

---

### OQ-4: Handling Bifrost API version changes

**Ambiguity**: How should the task source handle Bifrost API version changes, especially field renames or endpoint changes?

**Assumption**: Assume backward compatibility for minor Bifrost version bumps. Major version bumps will require task source updates.

**Ideal Solution**: Document the minimum supported Bifrost version (≥ 1.0). Assume semantic versioning—minor updates are backward-compatible, major updates may require task source updates.

**Alternatives**:
1. **Runtime API version detection**: Query Bifrost for its version and adapt behavior dynamically. Adds complexity and testing burden.
2. **Strict version pinning**: Only work with a single Bifrost version. Prevents upgrades.
3. **Feature detection per endpoint**: Try each endpoint and fall back on failure. Fragile and unpredictable.

**Comparison**: Semantic versioning is standard practice. Runtime detection is over-engineering for v1. Strict pinning prevents valid upgrades. Feature detection is fragile. Document minimum version and assume semver.

---

### OQ-5: PAT rotation and credential management

**Ambiguity**: How should the task source handle PAT expiration or rotation during operation?

**Assumption**: PAT rotation requires orchestrator restart with updated configuration. The task source does not implement automatic credential rotation.

**Ideal Solution**: Document that PAT changes require orchestrator restart. A future version could watch for credential changes and hot-reload, but v1 uses restart-based rotation.

**Alternatives**:
1. **Automatic credential refresh**: Watch for credential file changes and reload without restart. Adds complexity.
2. **Multiple PAT support with failover**: Configure primary and fallback PATs. Adds operational complexity.
3. **Delegate to external credential management**: Use a secrets manager. Requires additional infrastructure.

**Comparison**: Restart-based rotation is simple and reliable for v1. Automatic refresh adds complexity. Multiple PATs adds operational burden. External secrets manager is over-engineering for initial release. Support restart-based rotation and consider automatic refresh for v2 based on user feedback.
