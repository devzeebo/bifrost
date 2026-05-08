# Bifrost Task Source PRD

**Status:** Draft
**Authors:** Eric Siebeneich
**Date:** 2026-05-07
**Version:** 2.0

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
- **projectDir**: Git root of the working repository, resolved automatically by the orchestrator

### Problem

Sarah has deployed the Orchestrator Framework to automate code maintenance across her monorepo. Her team uses Bifrost for rune management—developers create runes for features, bugs, and refactors. She wants her AI agents to automatically pick up and work on these runes, but she faces three problems:

1. **No integration**: The orchestrator's default API task source doesn't understand Bifrost's rune lifecycle, state model, or event-sourced architecture
2. **No coordination**: Multiple orchestrator instances might claim the same rune, causing duplicate work and race conditions
3. **No state synchronization**: When an agent completes work, the rune state in Bifrost isn't automatically updated—developers must manually mark runes as fulfilled

Marcus, Sarah's teammate, has written custom scripts to poll Bifrost's HTTP API and dispatch work to agents. These scripts are fragile—they don't handle reconnection, don't respect Bifrost's claim semantics, and error handling is ad-hoc. When the Bifrost server is temporarily unavailable, the scripts crash and lose track of which runes were being processed. When two script instances run simultaneously, they both claim the same rune, wasting compute resources and creating conflicting code changes.

Sarah spends time manually deconflicting agent work, restarting crashed scripts, and syncing rune states back to Bifrost. She can't reliably scale her automation because the integration layer is a house of cards.

### Goal

With the Bifrost Task Source plugin, Sarah configures her orchestrator instances to use the Bifrost Task Source. The plugin:

1. Reads server URL and realm from `.bifrost.yaml` in the working repository
2. Reads PAT credentials from `~/.config/bifrost/credentials.yaml`
3. Polls for runes in the `open` state that are ready for work
4. Uses Bifrost's native claim API to ensure exclusive ownership (no duplicate work)
5. Yields all ready runes via async iterator (no filtering)
6. Maps Bifrost runes to orchestrator Tasks with full metadata (tags, dependencies, notes)
7. Executes agents via the orchestrator framework
8. Calls fulfill or unclaim API based on orchestrator's `completeTask()` or `failTask()` calls
9. Handles Bifrost server unavailability with retry on next poll interval
10. Emits structured telemetry for every operation (claim, execution, completion)

Marcus removes his fragile scripts. The orchestrator instances now coordinate seamlessly through Bifrost's claim semantics. When a rune is completed, its state is automatically updated—developers see real-time progress in the Bifrost UI. Sarah can deploy multiple orchestrator instances knowing they won't duplicate work. The system is reliable, observable, and requires no custom glue code.

---

## User Stories / Use Cases

### US-1: Configure orchestrator to use Bifrost Task Source

**As a** platform engineer
**I want** to configure the orchestrator to use the Bifrost Task Source
**So that** orchestrator instances can connect to my Bifrost server using the working repo's Bifrost configuration

**Acceptance Criteria:**

```
Given a .orchestrator.yaml configuration file
And orchestrate.task_source.type is "bifrost"
And the working repository has a .bifrost.yaml file
And .bifrost.yaml contains realm: "my-project"
And ~/.config/bifrost/credentials.yaml contains a PAT for the server
When the orchestrator loads configuration
Then a BifrostTaskSource is created using the realm from .bifrost.yaml
And the BifrostTaskSource reads credentials from ~/.config/bifrost/credentials.yaml
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

```
Given .orchestrator.yaml contains optional overrides
And orchestrate.task_source.settings.baseUrl is "https://custom.bifrost.com"
And .bifrost.yaml contains a different baseUrl
When the orchestrator loads configuration
Then the BifrostTaskSource uses the override from .orchestrator.yaml
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
And Task.tags is ["bug", "auth", "priority:high"]
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

### US-4: Complete or fail rune based on orchestrator call

**As the** orchestrator framework
**I want** to mark a rune as fulfilled or failed based on the orchestrator's completion method
**So that** rune state in Bifrost reflects the actual outcome

**Acceptance Criteria:**

```
Given a rune has been claimed and processed by an agent
And the agent execution completed successfully
When the orchestrator calls completeTask(taskId)
Then the Bifrost Task Source calls Bifrost's fulfill API
And the rune state transitions to "fulfilled"
And the method returns true
```

```
Given a rune has been claimed and processed
And the agent execution failed
When the orchestrator calls failTask(taskId, error)
Then the Bifrost Task Source calls Bifrost's unclaim API
And the rune state transitions to "open"
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

### US-6: Emit telemetry for all operations

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
Given the Bifrost Task Source completes or fails a rune
When the fulfill/unclaim API call succeeds
Then a log entry is emitted with: rune ID, operation, timestamp
```

---

## Functional Requirements

### FR-1: Configuration Schema

The Bifrost Task Source MUST support the following configuration in `.orchestrator.yaml`:

```yaml
orchestrate:
  task_source:
    type: "bifrost"
    settings:
      # Optional overrides for values from .bifrost.yaml
      baseUrl: string              # Override Bifrost server URL
      realm: string                # Override realm name
      claimant: string             # Claimant identifier (required)
      pollInterval: number         # Polling interval in milliseconds (default: 10000)
      timeout: number              # Request timeout in milliseconds (default: 30000)
```

The task source MUST read from:
- `.bifrost.yaml` in `projectDir` for default `baseUrl` and `realm`
- `~/.config/bifrost/credentials.yaml` for PAT authentication

Configuration priority: `.orchestrator.yaml` settings override `.bifrost.yaml` values.

**.bifrost.yaml resolution behavior**:
- If `.bifrost.yaml` doesn't exist in `projectDir`: throw an error at task source construction
- If `.bifrost.yaml` exists but is missing `baseUrl` or `realm` fields: throw an error at task source construction
- If both `.orchestrator.yaml` overrides are provided and `.bifrost.yaml` is missing: use the overrides (this is valid)
- If only one of `baseUrl` or `realm` is overridden and the other is missing from `.bifrost.yaml`: throw an error

**Configuration validation**:
- All validation occurs at task source construction time
- Invalid values (negative pollInterval, empty claimant, etc.) throw an error
- The task source does not start polling if configuration is invalid

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

The BifrostTaskSource constructor MUST accept:

```typescript
constructor(config: BifrostTaskSourceConfig, projectDir: string)
```

The `projectDir` parameter is the git root of the working repository, used to locate `.bifrost.yaml`. This is provided by the orchestrator framework at task source instantiation.

### FR-3: Rune to Task Mapping

The Bifrost Task Source MUST map Bifrost runes to orchestrator Tasks with the following field mappings:

| Bifrost Field | Task Field | Notes |
|---------------|------------|-------|
| `id` | `id` | Direct mapping |
| `title` | `title` | Direct mapping |
| `description` | `description` | Direct mapping |
| `state` | `status` | Mapped: "claimed" → "IN_PROGRESS" |
| `tags` | `tags` | Direct mapping, no modification |
| `claimant` | `claimant` | Direct mapping |
| `created_at` | `createdAt` | Date parsing |
| `updated_at` | `updatedAt` | Date parsing |
| `priority` | `priority` | Direct mapping |
| `branch` | `metadata.branch` | Stored in metadata object |

### FR-4: Ready Rune Query

The Bifrost Task Source MUST query for runes that meet ALL of the following criteria:

- `state == "open"` (rune is ready to be claimed)
- All dependency runes in the `blocks` relationship are in state `fulfilled` or `sealed`
- No circular dependencies exist (enforced by Bifrost)

The query MUST use Bifrost's `bf ready` equivalent API endpoint.

The task source MUST NOT filter runes by any criteria including worker tags. All ready runes are yielded to the orchestrator.

### FR-5: Claim Semantics

The Bifrost Task Source MUST use Bifrost's native claim API to atomically claim runes. The claim operation MUST:

- Be atomic (no race conditions between multiple orchestrator instances)
- Set the rune state to `claimed`
- Set the rune's claimant field to the configured claimant identifier
- Return an error if the rune is already claimed by another claimant

On claim conflict (409 Conflict response from Bifrost API):
- Log the conflict with rune ID, attempted claimant, and current claimant
- NOT yield the rune to the orchestrator (skip it silently in the async iterator)
- Continue polling for other ready runes
- The conflict is logged but does not terminate the async iterator

### FR-6: Completion and Failure Handling

The Bifrost Task Source MUST provide methods for the orchestrator to signal completion or failure:

- `completeTask(taskId)`: Calls Bifrost's fulfill API. Transitions rune to `fulfilled` state.
- `failTask(taskId, error)`: Calls Bifrost's unclaim API with the error message as the reason. Transitions rune back to `open` state.

The `error` parameter in `failTask` MUST be passed as the `reason` field in the unclaim API request body. The error message is also logged.

The task source MUST NOT classify errors or determine whether errors are recoverable. That is the orchestrator's responsibility.

**Return value semantics**:
- Returns `true` if the Bifrost API acknowledged the operation
- Returns `false` if the rune was not in the expected state (e.g., fulfill on already-fulfilled rune)
- Throws an error if the Bifrost server is unreachable or the request times out

### FR-7: Authentication and Credentials

The Bifrost Task Source MUST authenticate using Bearer token authentication:

- Read credentials from `~/.config/bifrost/credentials.yaml`
- Include the PAT in the `Authorization` header as `Bearer <pat>`
- Include the realm name in the `X-Bifrost-Realm` header
- Handle 401/403 responses by logging authentication failures

The credentials file format matches the Bifrost CLI format:

```yaml
# ~/.config/bifrost/credentials.yaml
credentials:
  - server: "https://bifrost.example.com"
    realm: "my-project"
    token: "the-pat-token"
```

Credentials are resolved by matching `server` and `realm` from `.bifrost.yaml` (or overrides) to the entries in the credentials file.

**Credential resolution failure behavior**:
- If `credentials.yaml` doesn't exist: throw an error at task source construction
- If no matching credential entry is found: throw an error at task source construction
- If the file is malformed (invalid YAML): throw an error at task source construction
- The error MUST clearly indicate which file or credential lookup failed

### FR-8: Reconnection Behavior

If the Bifrost server becomes unreachable, the Bifrost Task Source MUST:

- Log the connection error with timestamp and server URL
- Continue polling at the configured interval (no exponential backoff for v1)
- Successfully reconnect when the server becomes available
- Log successful reconnection

The `watchTasks()` async iterator MUST NOT terminate on network errors.

### FR-9: Branch Metadata

If a Bifrost rune has an associated Git branch, the Bifrost Task Source MUST:

- Include the branch name in `Task.metadata.branch`
- Agents can access this via `taskState.metadata.branch` for checkout operations

### FR-10: Dependency Mapping

Bifrost dependency relationships MUST be mapped to orchestrator TaskDetail:

| Bifrost Relationship | TaskDetail.dependencies[] |
|----------------------|---------------------------|
| `blocks` | `{ taskId, type: "blocks" }` |
| `relates_to` | `{ taskId, type: "relates_to" }` |
| `duplicates` | `{ taskId, type: "duplicates" }` |
| `supersedes` | `{ taskId, type: "supersedes" }` |
| `replies_to` | `{ taskId, type: "replies_to" }` |

### FR-11: Notes and Retro Mapping

Bifrost notes and retro entries MUST be mapped to TaskDetail:

- Notes → `TaskDetail.notes[]` with `{ id, content, createdAt }`
- Retro entries → `TaskDetail.retro[]` with `{ id, content, createdAt }`

---

## Non-Functional Requirements

### NFR-1: Performance

- Polling interval default: 10 seconds (configurable)
- API request timeout default: 30 seconds (configurable)
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
- Invalid credential configuration MUST be detected and logged on startup
- Realm not found MUST be logged and polling must continue
- Malformed API responses MUST be logged and the rune must be skipped

### NFR-6: Security

- PATs MUST be transmitted via HTTPS only
- PATs MUST NOT be logged under any circumstances
- The Bifrost Task Source MUST validate SSL certificates
- Credential file permissions SHOULD be restricted (user-readable only)

---

## Data & Storage

### Commands

**PollReadyRunes**
- `realm: string`, `claimant: string`
- Occurs when: Poll interval elapses

**ClaimRune**
- `runeId: string`, `claimant: string`
- Occurs when: Ready rune is identified

**MapRuneToTask**
- `rune: BifrostRune`
- Occurs when: Claimed rune is yielded to orchestrator

**FulfillRune**
- `runeId: string`
- Occurs when: Orchestrator calls completeTask()

**UnclaimRune**
- `runeId: string`, `error: string`
- Occurs when: Orchestrator calls failTask()

### Events

**ReadyRunesPolled**
- `realm: string`, `readyRuneCount: number`, `pollTimestamp: ISO8601`

**RuneClaimed**
- `runeId: string`, `claimant: string`, `claimedAt: ISO8601`

**RuneClaimConflict**
- `runeId: string`, `attemptedBy: string`, `currentClaimant: string`, `conflictAt: ISO8601`

**RuneFulfilled**
- `runeId: string`, `claimant: string`, `fulfilledAt: ISO8601`

**RuneUnclaimed**
- `runeId: string`, `reason: string`, `unclaimedAt: ISO8601`

**BifrostApiCallFailed**
- `endpoint: string`, `statusCode: number`, `error: string`, `timestamp: ISO8601`

**BifrostServerReconnecting**
- `baseUrl: string`, `lastError: string`, `reattemptDelay: number`, `reattemptAt: ISO8601`

**BifrostServerReconnected**
- `baseUrl: string`, `downtimeDuration: number`, `reconnectedAt: ISO8601`

**CredentialResolutionFailed**
- `server: string`, `realm: string`, `reason: string`, `timestamp: ISO8601`

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
  baseUrl?: string              // Optional override
  realm?: string                // Optional override
  claimant: string              // Required
  pollInterval: number          // Default: 10000
  timeout: number               // Default: 30000
}
```

**BifrostRepoConfig** (from `.bifrost.yaml`)
```typescript
type BifrostRepoConfig = {
  baseUrl: string
  realm: string
}
```

**BifrostCredentialsFile** (from `~/.config/bifrost/credentials.yaml`)
```typescript
type BifrostCredentialsFile = {
  credentials: Array<{
    server: string
    realm: string
    token: string
  }>
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

**CredentialLookupQuery**
- Question: What PAT should be used for this server/realm combination?
- Projection: Single credential entry matching server and realm
- Used by: Authentication

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
- Automatic retry on failure (orchestrator decides, task source just follows orders)
- Bifrost server administration (no realm/account management from task source)
- Migration tools (no import from other task systems)
- Advanced scheduling (FIFO polling based on Bifrost's ready query order)
- Custom priority handling (Bifrost priority is informational only)
- Branch creation (branch must already exist or be created externally)
- Dependency resolution visualization (no graph generation)
- Worker tag filtering (orchestrator's responsibility, not task source)
- Worker tag inference (orchestrator's responsibility)
- Error classification (orchestrator's responsibility)

---

## Dependencies and Assumptions

### Dependencies

| Dependency | Purpose | Version |
|---|---|---|---|
| Bifrost Server | Rune management backend | Current |
| Orchestrator Framework | Core orchestration system | 1.0 |
| TypeScript Runtime | Task source execution | ≥ 24 |
| Node.js fs module | Reading .bifrost.yaml and credentials.yaml | Built-in |
| Node.js fetch API | HTTP requests to Bifrost | Built-in |

### Assumptions

1. Bifrost server is accessible via HTTPS from the orchestrator runtime environment
2. A valid PAT with at least `member` role in the target realm is available in credentials file
3. Bifrost server's claim API is atomic and prevents duplicate claims
4. The realm specified in .bifrost.yaml exists
5. Network connectivity allows periodic polling at the configured interval
6. Bifrost server's `bf ready` equivalent API endpoint exists and returns ready runes
7. Bifrost server supports fulfill and unclaim API endpoints
8. Time synchronization between orchestrator and Bifrost server is adequate (clock skew < 1 minute)
9. The orchestrator framework provides the TaskSource interface contract
10. The orchestrator automatically resolves `projectDir` from git root
11. `.bifrost.yaml` exists in the working repository
12. `~/.config/bifrost/credentials.yaml` exists and contains valid credentials
13. The orchestrator handles worker tag routing, not the task source

### External System Assumptions

- **Bifrost Server**: Provides HTTP API for rune CRUD operations, claim/unclaim, fulfill, and ready query. Supports PAT authentication and realm-scoped queries.
- **Orchestrator Framework**: Provides TaskSource interface, defines Task and TaskDetail types, handles agent dispatch, manages hook execution, automatically resolves projectDir.

---

## Decision Records

This section records decisions made during the development of the Bifrost Task Source. Each decision includes the question, the answer, and the rationale.

### DR-1: No rune filtering in task source

**Question**: Should the task source filter runes by worker tag?

**Decision**: No. The task source should not do any rune filtering. If it's ready, it goes in the async generator.

**Rationale**: Filtering is the orchestrator's responsibility. The task source's job is to provide ready runes from the backend system. The orchestrator framework has agent routing mechanisms that determine which worker should handle which task. Adding filtering to the task source creates unnecessary complexity and coupling.

### DR-2: Task source not responsible for error classification

**Question**: Is the task source responsible for determining whether an error is recoverable vs fatal?

**Decision**: No. The task source is not responsible for this. The orchestrator either fulfills or fails it via `completeTask()` or `failTask()`.

**Rationale**: The task source's job is to provide the interface for completion and failure. Determining the nature of the error and the appropriate response is the orchestrator's concern. The task source simply calls the appropriate Bifrost API based on which orchestrator method is invoked.

### DR-3: Polling interval default

**Question**: What should the default polling interval be?

**Decision**: 10 seconds.

**Rationale**: Matches the orchestrator framework's default. Provides good balance between responsiveness and resource usage.

### DR-4: No API version compatibility handling

**Question**: How should the task source handle Bifrost API version changes?

**Decision**: Don't worry about versioning. Assume it's all the correct versions.

**Rationale**: The task source and Bifrost server are developed together. Version compatibility is managed at the deployment level, not in the task source code.

### DR-5: Credentials from .bifrost.yaml and credentials.yaml

**Question**: Where should the task source read credentials from?

**Decision**: Read the server URL and realm from the `.bifrost.yaml` of the working repository. Read the credentials (PAT) for that repo from `~/.config/bifrost/credentials.yaml`.

**Rationale**: This follows the Bifrost CLI's credential management pattern. The `.bifrost.yaml` in the working repo specifies which server and realm to use. The credentials file maps those to PATs. This avoids hardcoding PATs in orchestrator config and supports multiple realms/credentials.

---

### DR-6: .bifrost.yaml and credentials.yaml formats from source code

**Question**: What are the actual file formats for `.bifrost.yaml` and `credentials.yaml`?

**Decision**: Use formats from Bifrost source code (`cli/config.go`, `cli/credentials.go`).

**Rationale**: Bifrost CLI is the reference implementation. Task source must match exactly for interoperability.

**Impact**: Corrected field names and structure in Appendices A and B.

---

### DR-7: Claimant identifier defaults to system username

**Question**: What is the default claimant if not provided in configuration?

**Decision**: Use system username from `whoami` bash command (Node.js equivalent: `os.userInfo().username`).

**Rationale**: Matches Bifrost CLI behavior (`user.Current().Username` in Go). Provides sensible default while allowing override.

---

### DR-8: Credential resolution failures are fatal

**Question**: What happens when credentials can't be resolved?

**Decision**: Raise an error to the orchestrator and die. Do not continue without credentials.

**Rationale**: Continuing without credentials would pollute Bifrost with anonymous claims. Fail fast is better.

---

### DR-9: .bifrost.yaml missing is fatal

**Question**: What happens when `.bifrost.yaml` doesn't exist or is malformed?

**Decision**: Raise an error to the orchestrator and die.

**Rationale**: The task source cannot function without knowing which server and realm to connect to. Fail fast.

---

### DR-10: projectDir parameter is new orchestrator feature

**Question**: How does the task source receive `projectDir`?

**Decision**: Gap in orchestrator definition. Add `projectDir` parameter to task source constructor as a new orchestrator framework feature.

**Rationale**: Task sources need access to working repository for config files. This is orchestrator framework's responsibility to provide.

---

### DR-11: TaskState Store interface for task metadata

**Question**: What is `Task.metadata` and how is it shared between orchestrator and task source?

**Decision**: Gap in orchestrator definition. Task source implements `TaskStateStore` interface for storing/retrieving per-task metadata. Orchestrator and task source share task state through this interface.

**Rationale**: Task metadata (like branch) needs persistence across hook executions. The task source is responsible for the storage backend, orchestrator provides the data.

---

### DR-12: failTask passes error as reason to Bifrost fail command

**Question**: What happens to the `error` parameter in `failTask`?

**Decision**: Pass it as the `reason` field in Bifrost's `/api/fail-rune` command.

**Rationale**: Bifrost's `FailRune` command has a `Reason` field. The error message provides diagnostic value.

---

### DR-13: No claim conflict handling needed

**Question**: Should the task source handle claim conflicts?

**Decision**: No. Bifrost server guarantees no conflicts through atomic claim operations. Task source does not need conflict handling.

**Rationale**: Bifrost's event-sourced design with single-stream claims prevents race conditions at the server level. The task source can trust claim operations succeed or fail with genuine errors.

---

### DR-14: Remove boolean return from completion methods

**Question**: Should `completeTask` and `failTask` return `Promise<boolean>`?

**Decision**: No. Remove boolean return. Methods only throw on failure. Bifrost guarantees idempotency, atomicity, and eventual consistency.

**Rationale**: Boolean returns create ambiguity about failure modes. Throwing is clearer. Bifrost's design ensures operations either succeed or throw.

---

### DR-15: Configuration validation at construction time

**Question**: When is configuration validated?

**Decision**: At task source construction time. Invalid configuration = log error and throw.

**Rationale**: Fail fast on startup rather than discovering config issues during operation.

---

## Open Questions

### OQ-1: .bifrost.yaml file format specification

**Ambiguity**: FR-1 states the task source reads `baseUrl` and `realm` from `.bifrost.yaml`, but the file format is not specified anywhere in the document.

**Assumed format**:
```yaml
baseUrl: "https://bifrost.example.com"
realm: "my-project"
```

**Questions**:
1. Is this the actual format? Does `.bifrost.yaml` use different field names?
2. Is `baseUrl` even in `.bifrost.yaml`, or is it configured elsewhere (server config)?
3. What other fields might be in `.bifrost.yaml` that we should ignore?

**Impact**: Critical for implementation. Wrong field names will cause credential resolution to fail.

---

### OQ-2: Bifrost HTTP API endpoint contracts

**Ambiguity**: FR-4, FR-5, FR-6 reference "bf ready equivalent API", "claim API", "fulfill API", "unclaim API" but actual HTTP endpoints and request/response formats are not specified.

**Questions**:
1. What is the HTTP path for each operation? (e.g., `GET /api/v1/runes/ready`, `POST /api/v1/runes/{id}/claim`)
2. What are the request body formats?
3. What are the response formats?
4. What HTTP status codes indicate success vs. various failure modes?
5. How is the claimant identifier passed to the claim API?

**Impact**: Critical. Cannot implement without knowing actual API contracts.

---

### OQ-3: Claimant identifier generation and format

**Ambiguity**: FR-1 requires `claimant: string` in config, but doesn't specify what this value should be or how it's generated.

**Questions**:
1. Is the claimant a user-chosen string (hostname, orchestrator instance name)?
2. Is there a format requirement (UUID, DNS name)?
3. Must claimant be unique across all orchestrator instances?
4. What happens if two orchestrator instances use the same claimant?

**Impact**: Medium. Duplicate claimants could cause coordination issues.

---

### OQ-4: Credential resolution failure behavior

**Ambiguity**: FR-7 describes reading from `~/.config/bifrost/credentials.yaml`, but doesn't specify behavior when credentials aren't found.

**Questions**:
1. What happens if `credentials.yaml` doesn't exist?
2. What happens if no credential matches the server/realm combination?
3. What happens if the file is malformed (invalid YAML)?
4. Should the task source fail fast on startup, or log and continue?

**Impact**: Critical. Needs clear failure mode specification.

---

### OQ-5: .bifrost.yaml missing or malformed behavior

**Ambiguity**: Assumption 11 states `.bifrost.yaml` exists, but doesn't specify behavior if it doesn't.

**Questions**:
1. What if `.bifrost.yaml` doesn't exist in `projectDir`?
2. What if it exists but is missing required fields?
3. What if both `.orchestrator.yaml` overrides and `.bifrost.yaml` are missing - is this fatal?
4. Should we fall back to `.orchestrator.yaml` only, or fail?

**Impact**: High. Need to define graceful degradation vs. hard failure.

---

### OQ-6: projectDir access mechanism

**Ambiguity**: The `TaskSource` interface (FR-2) doesn't include `projectDir` as a parameter, but FR-1 and FR-7 reference reading files from `projectDir`.

**Questions**:
1. How does the task source receive `projectDir`? Is it passed to the constructor?
2. Is `projectDir` resolved once at startup, or can it change during operation?
3. What if the orchestrator runs from outside a git repository (no projectDir)?

**Impact**: High. Cannot implement file reading without knowing how projectDir is provided.

---

### OQ-7: Task.metadata type specification

**Ambiguity**: FR-3 specifies `branch` goes into `Task.metadata.branch`, but the structure of `Task.metadata` is not defined.

**Questions**:
1. Is `Task.metadata` a free-form `Record<string, unknown>`?
2. Are there other metadata fields beyond `branch`?
3. Does the orchestrator framework define `Task.metadata`, or is it task-source-specific?

**Impact**: Medium. Affects type safety and serialization.

---

### OQ-8: failTask error message handling

**Ambiguity**: The interface specifies `failTask(taskId: string, error: string)`, but doesn't specify what happens to the error message.

**Questions**:
1. Is the error message added as a note on the rune in Bifrost?
2. Is it just logged?
3. Is it passed to the unclaim API body?
4. Should the error message be truncated if too long?

**Impact**: Medium. Affects debugging and user experience.

---

### OQ-9: Claim conflict handling in watchTasks

**Ambiguity**: FR-5 states "On claim conflict, the Bifrost Task Source MUST log the conflict and NOT yield the rune to the orchestrator." This conflicts with US-2 AC which says the unsuccessful instance "receives a conflict error."

**Questions**:
1. Does the conflicting rune get silently skipped, or is an error emitted?
2. If an error, is it a logged error or thrown from the async iterator?
3. Should the task source track conflicts and alert if conflicts are frequent?

**Impact**: Medium. Affects observability and operational debugging.

---

### OQ-10: completeTask/failTask partial failure modes

**Ambiguity**: FR-6 specifies `completeTask` and `failTask` return `Promise<boolean>`, but doesn't specify what `false` means vs. throwing an error.

**Questions**:
1. Does `false` mean "Bifrost acknowledged but state didn't change"?
2. Does `false` mean "network error but operation might have succeeded"?
3. When should the method throw vs. return false?
4. Should the orchestrator retry on `false`?

**Impact**: High. Affects orchestrator's retry and error handling logic.

---

### OQ-11: Configuration validation timing

**Ambiguity**: FR-1 through FR-11 specify configuration, but not when validation occurs.

**Questions**:
1. Is configuration validated at task source construction time, or on first API call?
2. Which validation errors should prevent startup vs. be logged warnings?
3. If `.orchestrator.yaml` has invalid values (negative pollInterval), what happens?

**Impact**: Medium. Affects startup behavior and diagnosability.

---

## Appendices

### Appendix A: .bifrost.yaml Schema

The `.bifrost.yaml` file in the working repository specifies the Bifrost server and realm for that repository.

```yaml
# .bifrost.yaml
baseUrl: "https://bifrost.example.com"  # Bifrost server URL
realm: "my-project"                       # Realm name for this repository
```

Additional fields may be present in the file but are ignored by the task source.

### Appendix B: Bifrost HTTP API Endpoints

The following HTTP endpoints are used by the Bifrost Task Source:

**Ready Runes Query**
```
GET /api/v1/runes?state=open&realm={realm}
Headers: Authorization: Bearer {pat}, X-Bifrost-Realm: {realm}
Response: 200 OK with array of BifrostRune
```

**Claim Rune**
```
POST /api/v1/runes/{runeId}/claim
Headers: Authorization: Bearer {pat}, X-Bifrost-Realm: {realm}
Body: { "claimant": string }
Response: 200 OK on success, 409 Conflict on claim conflict
```

**Get Rune Detail**
```
GET /api/v1/runes/{runeId}
Headers: Authorization: Bearer {pat}, X-Bifrost-Realm: {realm}
Response: 200 OK with BifrostRuneDetail, 404 Not Found
```

**Fulfill Rune**
```
POST /api/v1/runes/{runeId}/fulfill
Headers: Authorization: Bearer {pat}, X-Bifrost-Realm: {realm}
Response: 200 OK
```

**Unclaim Rune**
```
POST /api/v1/runes/{runeId}/unclaim
Headers: Authorization: Bearer {pat}, X-Bifrost-Realm: {realm}
Body: { "reason": string }
Response: 200 OK
```

### Appendix C: HTTP Status Codes

| Status | Meaning | Task Source Behavior |
|--------|---------|---------------------|
| 200 OK | Success | Proceed |
| 401 Unauthorized | Invalid PAT | Log error, continue polling |
| 403 Forbidden | Insufficient permissions | Log error, continue polling |
| 404 Not Found | Rune not found | Return null from getTaskDetail |
| 409 Conflict | Rune already claimed | Log conflict, skip rune |
| 500+ Server Error | Bifrost server error | Log error, retry on next poll |

---
