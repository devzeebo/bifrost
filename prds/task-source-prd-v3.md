# Bifrost Task Source PRD

**Status:** Draft
**Authors:** Eric Siebeneich
**Date:** 2026-05-07
**Version:** 3.0

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
- **projectDir**: Git root of the working repository, resolved automatically by the orchestrator and passed to task source constructor

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
3. Polls for runes in the `open` state that are ready for work (unblocked)
4. Uses Bifrost's native claim API to ensure exclusive ownership (no duplicate work)
5. Yields all ready runes via async iterator (no filtering)
6. Maps Bifrost runes to orchestrator Tasks with full metadata (tags, dependencies, notes)
7. Stores and retrieves task state via TaskStateStore interface
8. Executes agents via the orchestrator framework
9. Calls fulfill or fail API based on orchestrator's `completeTask()` or `failTask()` calls
10. Handles Bifrost server unavailability with retry on next poll interval
11. Emits structured telemetry for every operation (claim, execution, completion)

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
Given .orchestrator.yaml does not specify claimant
When the orchestrator loads configuration
Then the BifrostTaskSource uses the system username from os.userInfo().username as the claimant
```

```
Given .orchestrator.yaml contains optional overrides
And orchestrate.task_source.settings.baseUrl is "https://custom.bifrost.com"
And .bifrost.yaml contains a different baseUrl
When the orchestrator loads configuration
Then the BifrostTaskSource uses the override from .orchestrator.yaml
```

```
Given .bifrost.yaml does not exist in projectDir
When the orchestrator attempts to create the BifrostTaskSource
Then an error is thrown indicating .bifrost.yaml is missing
And the orchestrator does not start
```

```
Given ~/.config/bifrost/credentials.yaml does not exist
When the orchestrator attempts to create the BifrostTaskSource
Then an error is thrown indicating credentials are missing
And the orchestrator does not start
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
Then Task.taskState contains { branch: "feature/fix-login" }
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
```

```
Given a rune has been claimed and processed
And the agent execution failed with error "Test timeout after 5 minutes"
When the orchestrator calls failTask(taskId, error)
Then the Bifrost Task Source calls Bifrost's fail API with reason "Test timeout after 5 minutes"
And the rune state transitions to "open"
```

```
Given the Bifrost server is unreachable when completing a task
When the orchestrator calls completeTask(taskId)
Then the method throws an error
And the orchestrator logs the failure
And the orchestrator marks the task as failed in its own records
```

```
Given completeTask is called for a rune that is already fulfilled
When the Bifrost API acknowledges the operation
Then the method returns without error (Bifrost guarantees idempotency)
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
Given the Bifrost Task Source completes or fails a rune
When the fulfill/fail API call succeeds
Then a log entry is emitted with: rune ID, operation, timestamp
```

### US-7: Store and retrieve task state

**As an** orchestrator framework
**I want** the task source to store and retrieve task state
**So that** hooks and agents can share data across executions

**Acceptance Criteria:**

```
Given a hook writes taskState.snapshotTests = { "test.js": "hash123" }
When the hook completes
Then the task source persists the taskState via TaskStateStore
```

```
Given a subsequent hook needs to read taskState
When the hook executes
Then the task source loads the persisted taskState from TaskStateStore
And the hook receives the updated taskState via stdin
```

```
Given the TaskStateStore is unavailable
When a task state operation is attempted
Then an error is thrown
And the orchestrator marks the UoW as failed
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
      url: string                  # Override Bifrost server URL
      realm: string                # Override realm name
      claimant: string             # Claimant identifier (defaults to system username)
      pollInterval: number         # Polling interval in milliseconds (default: 10000)
      timeout: number              # Request timeout in milliseconds (default: 30000)
```

The task source MUST read from:
- `.bifrost.yaml` in `projectDir` for default `url` and `realm`
- `~/.config/bifrost/credentials.yaml` for PAT authentication

Configuration priority: `.orchestrator.yaml` settings override `.bifrost.yaml` values.

**Configuration validation**:
- All validation occurs at task source construction time
- Invalid configuration throws an error
- The task source is not created if validation fails

**Missing configuration behavior**:
- If `.bifrost.yaml` doesn't exist in `projectDir`: throw error with clear message
- If `.bifrost.yaml` exists but is missing required fields: throw error with clear message
- If `credentials.yaml` doesn't exist: throw error with clear message
- If no matching credential entry is found: throw error with clear message
- If files are malformed (invalid YAML): throw error with clear message

### FR-2: BifrostTaskSource Implementation

The Bifrost Task Source MUST implement the `TaskSource` and `TaskStateStore` interfaces:

```typescript
export type TaskSource = {
  watchTasks: () => AsyncGenerator<Task>
  getTaskDetail: (taskId: string) => Promise<TaskDetail | null>
  completeTask: (taskId: string) => Promise<void>
  failTask: (taskId: string, error: string) => Promise<void>
}

export type TaskStateStore = {
  loadTaskState: (taskId: string) => Promise<Record<string, unknown> | null>
  saveTaskState: (taskId: string, taskState: Record<string, unknown>) => Promise<void>
  deleteTaskState: (taskId: string) => Promise<void>
  initializeTaskState: (taskId: string, initialState: Record<string, unknown>) => Promise<void>
}
```

The BifrostTaskSource constructor MUST accept:

```typescript
constructor(config: BifrostTaskSourceConfig, projectDir: string)
```

The `projectDir` parameter is the git root of the working repository, provided by the orchestrator framework at task source instantiation. This is an orchestrator framework feature that passes the resolved project directory to all task sources.

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
| `branch` | Stored in taskState as `taskState.branch` | Passed via TaskStateStore |

The task source MUST NOT modify tags. The orchestrator framework handles worker tag routing.

### FR-4: Ready Rune Query

The Bifrost Task Source MUST query for runes that meet ALL of the following criteria:

- `state == "open"` (rune is ready to be claimed)
- `blocked == "false"` (all dependency runes in the `blocks` relationship are in state `fulfilled` or `sealed`)
- No circular dependencies exist (enforced by Bifrost)
- `is_saga == "false"` (exclude sagas, only return individual runes)

The query MUST use Bifrost's HTTP API:
```
GET /api/runes?status=open&blocked=false&is_saga=false
Headers: Authorization: Bearer {pat}, X-Bifrost-Realm: {realm}
```

The task source MUST NOT filter runes by any criteria including worker tags. All ready runes are yielded to the orchestrator.

### FR-5: Claim Semantics

The Bifrost Task Source MUST use Bifrost's HTTP API to claim runes:

```
POST /api/claim-rune
Headers: Authorization: Bearer {pat}, X-Bifrost-Realm: {realm}
Body: { "id": string, "claimant": string }
Response: 204 No Content on success
```

The claim operation is atomic. Bifrost's event-sourced design prevents race conditions at the server level.

If a claim fails with a domain error (rune not in correct state, etc.), the rune is NOT yielded to the orchestrator. The task source logs the failure and continues polling.

### FR-6: Completion and Failure Handling

The Bifrost Task Source MUST provide methods for the orchestrator to signal completion or failure:

- `completeTask(taskId)`: Calls Bifrost's fulfill API. Transitions rune to `fulfilled` state.
- `failTask(taskId, error)`: Calls Bifrost's fail API with the error message as the reason. Transitions rune back to `open` state.

Both methods return `Promise<void>` and throw on error.

**Fulfill API**:
```
POST /api/fulfill-rune
Headers: Authorization: Bearer {pat}, X-Bifrost-Realm: {realm}
Body: { "id": string }
Response: 204 No Content
```

**Fail API**:
```
POST /api/fail-rune
Headers: Authorization: Bearer {pat}, X-Bifrost-Realm: {realm}
Body: { "id": string, "reason": string }
Response: 204 No Content
```

The task source MUST NOT classify errors. That is the orchestrator's responsibility.

**Error handling**:
- Network errors: throw error
- HTTP 4xx/5xx: throw error with message
- Bifrost guarantees idempotency: calling fulfill on an already-fulfilled rune succeeds without error

### FR-7: Authentication and Credentials

The Bifrost Task Source MUST authenticate using Bearer token authentication:

- Read credentials from `~/.config/bifrost/credentials.yaml` (or `$XDG_CONFIG_HOME/bifrost/credentials.yaml`)
- Include the PAT in the `Authorization` header as `Bearer {pat}`
- Include the realm name in the `X-Bifrost-Realm` header
- Handle 401/403 responses by logging authentication failures and continuing polling

The credentials file format matches the Bifrost CLI format:

```yaml
# ~/.config/bifrost/credentials.yaml
credentials:
  "https://bifrost.example.com":
    token: "the-pat-token"
```

Credentials are resolved by matching the normalized `url` from `.bifrost.yaml` (or override) to the keys in the `credentials` map. URL normalization removes trailing slashes.

**Credential resolution failure behavior**:
- If `credentials.yaml` doesn't exist: throw error at construction
- If no matching credential entry is found: throw error at construction
- If the file is malformed (invalid YAML): throw error at construction
- The error MUST clearly indicate which file or credential lookup failed

### FR-8: Reconnection Behavior

If the Bifrost server becomes unreachable, the Bifrost Task Source MUST:

- Log the connection error with timestamp and server URL
- Continue polling at the configured interval (no exponential backoff for v1)
- Successfully reconnect when the server becomes available
- Log successful reconnection

The `watchTasks()` async iterator MUST NOT terminate on network errors.

### FR-9: Branch and TaskState Handling

If a Bifrost rune has an associated Git branch, the Bifrost Task Source MUST:

- Store the branch name in taskState via `saveTaskState(taskId, { branch: branchName })`
- Subsequent loads of taskState will include the branch field
- Agents can access this via taskState for checkout operations

### FR-10: Dependency Mapping

Bifrost dependency relationships MUST be mapped to orchestrator TaskDetail:

| Bifrost Relationship | TaskDetail.dependencies[] |
|----------------------|---------------------------|
| `blocks` / `blocked_by` | `{ taskId, type: "blocks" }` |
| `relates_to` | `{ taskId, type: "relates_to" }` |
| `duplicates` / `duplicated_by` | `{ taskId, type: "duplicates" }` |
| `supersedes` / `superseded_by` | `{ taskId, type: "supersedes" }` |
| `replies_to` / `replied_to_by` | `{ taskId, type: "replies_to" }` |

### FR-11: Notes and Retro Mapping

Bifrost notes and retro entries MUST be mapped to TaskDetail:

- Notes → `TaskDetail.notes[]` with `{ id, content, createdAt }`
- Retro entries → `TaskDetail.retro[]` with `{ id, content, createdAt }`

### FR-12: TaskStateStore Implementation

The Bifrost Task Source MUST implement the `TaskStateStore` interface using Bifrost's rune state API:

**Load**:
```
GET /api/rune?id={taskId}
Response: 200 OK with rune detail including state field
```

**Save**:
```
POST /api/update-rune-state
Body: { "id": string, "state": Record<string, unknown> }
```

**Delete**:
```
POST /api/clear-rune-state
Body: { "id": string }
```

**Initialize**:
```
POST /api/update-rune-state
Body: { "id": string, "state": Record<string, unknown> }
```

The taskState is stored as a free-form JSON object in the rune's `state` field in Bifrost.

### FR-13: Claimant Default

If `claimant` is not provided in the configuration, the task source MUST default to the system username using Node.js `os.userInfo().username`.

### FR-14: Get Rune Detail

The task source MUST implement `getTaskDetail` using:

```
GET /api/rune?id={runeId}
Headers: Authorization: Bearer {pat}, X-Bifrost-Realm: {realm}
Response: 200 OK with full rune detail, 404 Not Found
```

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
- Bifrost's atomic claim operations prevent duplicate work
- Network errors MUST be logged and retried on next poll

### NFR-3: Monitoring and Observability

- All Bifrost API calls MUST be logged with: endpoint, status code, duration
- All claim operations MUST be logged with: rune ID, claimant, success/failure
- All fulfill/fail operations MUST be logged with: rune ID, result
- Poll operations MUST be logged with: realm, ready rune count
- Reconnection events MUST be logged

### NFR-4: Concurrency

- Multiple orchestrator instances MUST be able to poll simultaneously
- Bifrost's atomic claim operations ensure only one instance claims each rune
- No additional locking is required in the Bifrost Task Source

### NFR-5: Error Handling

- Authentication failures (401/403) MUST be logged and polling must continue
- Invalid configuration MUST throw at construction
- Realm not found MUST be logged and polling must continue
- Malformed API responses MUST be logged and the rune must be skipped

### NFR-6: Security

- PATs MUST be transmitted via HTTPS only
- PATs MUST NOT be logged under any circumstances
- The Bifrost Task Source MUST validate SSL certificates
- Credential file permissions SHOULD be restricted (user-readable only)

### NFR-7: Idempotency

- The task source MUST be idempotent for all operations
- Bifrost guarantees idempotency for claim, fulfill, and fail operations
- Repeated calls to `completeTask` on an already-fulfilled rune succeed without error

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
- `rune: BifrostRune`, `projectDir: string`
- Occurs when: Claimed rune is yielded to orchestrator

**FulfillRune**
- `runeId: string`
- Occurs when: Orchestrator calls completeTask()

**FailRune**
- `runeId: string`, `reason: string`
- Occurs when: Orchestrator calls failTask()

**LoadTaskState**
- `runeId: string`
- Occurs when: Hook or agent needs to read taskState

**SaveTaskState**
- `runeId: string`, `taskState: Record<string, unknown>`
- Occurs when: Hook modifies taskState

**DeleteTaskState**
- `runeId: string`
- Occurs when: Task is completed and state should be cleaned up

**InitializeTaskState**
- `runeId: string`, `initialState: Record<string, unknown>`
- Occurs when: Task is claimed for the first time

### Events

**ReadyRunesPolled**
- `realm: string`, `readyRuneCount: number`, `pollTimestamp: ISO8601`

**RuneClaimed**
- `runeId: string`, `claimant: string`, `claimedAt: ISO8601`

**RuneFulfilled**
- `runeId: string`, `claimant: string`, `fulfilledAt: ISO8601`

**RuneFailed**
- `runeId: string`, `claimant: string`, `reason: string`, `failedAt: ISO8601`

**BifrostApiCallFailed**
- `endpoint: string`, `statusCode: number`, `error: string`, `timestamp: ISO8601`

**BifrostServerReconnecting**
- `baseUrl: string`, `lastError: string`, `reattemptDelay: number`, `reattemptAt: ISO8601`

**BifrostServerReconnected**
- `baseUrl: string`, `downtimeDuration: number`, `reconnectedAt: ISO8601`

**CredentialResolutionFailed**
- `server: string`, `reason: string`, `timestamp: ISO8601`

**TaskStateLoaded**
- `runeId: string`, `keys: string[]`, `loadedAt: ISO8601`

**TaskStateSaved**
- `runeId: string`, `keys: string[]`, `savedAt: ISO8601`

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
  created_at: Date
  updated_at: Date
  priority: number
  branch: string | null
  realm_id: string
  parent_id: string | null
}

type RuneState = "draft" | "forged" | "open" | "claimed" | "fulfilled" | "sealed"
```

**BifrostRuneDetail**
```typescript
type BifrostRuneDetail = BifrostRune & {
  dependencies: BifrostDependency[]
  notes: BifrostNote[]
  acceptance_criteria: BifrostAC[]
  retro: BifrostRetroEntry[]
  state: Record<string, unknown>  // Free-form taskState
}

type BifrostDependency = {
  target_id: string
  relationship: "blocked_by" | "relates_to" | "duplicated_by" | "superseded_by" | "replied_to_by"
}
```

**BifrostTaskSourceConfig**
```typescript
type BifrostTaskSourceConfig = {
  url?: string                  // Optional override
  realm?: string                // Optional override
  claimant?: string             // Optional, defaults to system username
  pollInterval: number          // Default: 10000
  timeout: number               // Default: 30000
}
```

**BifrostRepoConfig** (from `.bifrost.yaml`)
```typescript
type BifrostRepoConfig = {
  url: string                   // Bifrost server URL
  realm: string                 // Realm name (required)
  orchestrate?: OrchestrateConfig
  api_key?: string              // Deprecated, use credentials.yaml
}
```

**BifrostCredentialsFile** (from `~/.config/bifrost/credentials.yaml`)
```typescript
type BifrostCredentialsFile = {
  credentials: Record<string, {   // URL is key
    token: string
  }>
}
```

### Query Projections

**ReadyRunesQuery**
- Question: Which runes in this realm are ready to be claimed?
- API Call: `GET /api/runes?status=open&blocked=false&is_saga=false`
- Used by: Poll operation

**RuneDetailQuery**
- Question: What is the full detail for a specific rune?
- API Call: `GET /api/rune?id={runeId}`
- Used by: getTaskDetail, agent context

**CredentialLookupQuery**
- Question: What PAT should be used for this server URL?
- Projection: Single credential entry matching normalized URL
- Used by: Authentication

### Data Retention

- Task state is persisted in Bifrost rune's `state` field
- Bifrost Task Source does NOT persist data separately
- Event logs for telemetry follow orchestrator framework retention policy (90 days)

---

## Out of Scope

- Real-time push notifications (polling only, no webhooks in v1)
- Custom claim semantics (uses Bifrost's built-in claim API)
- Multi-realm polling (one task source instance = one realm)
- Rune creation from the orchestrator (runes are created externally)
- Saga-level orchestration (individual runes only, sagas excluded via `is_saga=false`)
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
- Claim conflict handling (Bifrost guarantees no conflicts at server level)

---

## Dependencies and Assumptions

### Dependencies

| Dependency | Purpose | Version |
|---|---|---|---|
| Bifrost Server | Rune management backend | Current |
| Orchestrator Framework | Core orchestration system | 1.0 |
| TypeScript Runtime | Task source execution | ≥ 24 |
| Node.js os module | System username discovery | Built-in |
| Node.js fs module | Reading .bifrost.yaml and credentials.yaml | Built-in |
| Node.js fetch API | HTTP requests to Bifrost | Built-in |

### Assumptions

1. Bifrost server is accessible via HTTPS from the orchestrator runtime environment
2. A valid PAT with at least `member` role in the target realm is available in credentials file
3. Bifrost server's claim API is atomic and prevents duplicate claims
4. The realm specified in .bifrost.yaml exists
5. Network connectivity allows periodic polling at the configured interval
6. Bifrost server's HTTP API is available and returns ready runes
7. Bifrost server supports fulfill and fail API endpoints
8. Time synchronization between orchestrator and Bifrost server is adequate (clock skew < 1 minute)
9. The orchestrator framework provides the TaskSource and TaskStateStore interfaces
10. The orchestrator automatically resolves `projectDir` from git root and passes it to task source constructor
11. `.bifrost.yaml` exists in the working repository (fatal if missing)
12. `~/.config/bifrost/credentials.yaml` exists and contains valid credentials (fatal if missing)
13. The orchestrator handles worker tag routing, not the task source
14. Bifrost guarantees idempotency for all operations
15. Bifrost guarantees atomicity and prevents claim conflicts at the server level

### External System Assumptions

- **Bifrost Server**: Provides HTTP API for rune CRUD operations, claim/fail, fulfill, and ready query. Supports PAT authentication and realm-scoped queries. Guarantees idempotency, atomicity, and eventual consistency.
- **Orchestrator Framework**: Provides TaskSource and TaskStateStore interfaces, defines Task and TaskDetail types, handles agent dispatch, manages hook execution, automatically resolves projectDir and passes to task source constructor.

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

### DR-6: .bifrost.yaml and credentials.yaml formats from source code

**Question**: What are the actual file formats for `.bifrost.yaml` and `credentials.yaml`?

**Decision**: Use formats from Bifrost source code (`cli/config.go`, `cli/credentials.go`).

**Rationale**: Bifrost CLI is the reference implementation. Task source must match exactly for interoperability. See Appendix A and B for exact formats.

### DR-7: Claimant identifier defaults to system username

**Question**: What is the default claimant if not provided in configuration?

**Decision**: Use system username from `os.userInfo().username` (Node.js equivalent of Go's `user.Current().Username`).

**Rationale**: Matches Bifrost CLI behavior. Provides sensible default while allowing override.

### DR-8: Credential resolution failures are fatal

**Question**: What happens when credentials can't be resolved?

**Decision**: Raise an error to the orchestrator and die. Do not continue without credentials.

**Rationale**: Continuing without credentials would pollute Bifrost with anonymous claims. Fail fast is better.

### DR-9: .bifrost.yaml missing is fatal

**Question**: What happens when `.bifrost.yaml` doesn't exist or is malformed?

**Decision**: Raise an error to the orchestrator and die.

**Rationale**: The task source cannot function without knowing which server and realm to connect to. Fail fast.

### DR-10: projectDir parameter is orchestrator framework feature

**Question**: How does the task source receive `projectDir`?

**Decision**: The orchestrator framework passes `projectDir` to the task source constructor. This is a new orchestrator framework feature.

**Rationale**: Task sources need access to working repository for config files. The orchestrator already resolves projectDir for hooks; it should also pass it to task sources.

### DR-11: TaskStateStore interface for task metadata

**Question**: What is `Task.metadata` and how is it shared?

**Decision**: Task source implements `TaskStateStore` interface for storing/retrieving per-task state. The orchestrator and task source share task state through this interface. Data is stored in Bifrost's rune `state` field.

**Rationale**: Task metadata needs persistence across hook executions. Making the task source responsible for storage (via Bifrost) keeps the interface clean and data co-located with the task.

### DR-12: failTask passes error as reason to Bifrost fail command

**Question**: What happens to the `error` parameter in `failTask`?

**Decision**: Pass it as the `reason` field in Bifrost's `/api/fail-rune` command.

**Rationale**: Bifrost's `FailRune` command has a `Reason` field. The error message provides diagnostic value for developers.

### DR-13: No claim conflict handling needed

**Question**: Should the task source handle claim conflicts?

**Decision**: No. Bifrost server guarantees no conflicts through atomic claim operations. Task source does not need conflict handling.

**Rationale**: Bifrost's event-sourced design with single-stream claims prevents race conditions at the server level. The task source can trust claim operations succeed or fail with genuine errors.

### DR-14: Remove boolean return from completion methods

**Question**: Should `completeTask` and `failTask` return `Promise<boolean>`?

**Decision**: No. Return `Promise<void>`. Methods only throw on failure. Bifrost guarantees idempotency, atomicity, and eventual consistency.

**Rationale**: Boolean returns create ambiguity about failure modes. Throwing is clearer. Bifrost's design ensures operations either succeed or throw.

### DR-15: Configuration validation at construction time

**Question**: When is configuration validated?

**Decision**: At task source construction time. Invalid configuration = log error and throw.

**Rationale**: Fail fast on startup rather than discovering config issues during operation.

---

## Appendices

### Appendix A: .bifrost.yaml Schema

The `.bifrost.yaml` file in the working repository specifies the Bifrost server and realm for that repository.

```yaml
# .bifrost.yaml
url: "https://bifrost.example.com"  # Bifrost server URL
realm: "my-project"                   # Realm name (required)
orchestrate:                          # Optional orchestrator config
  dispatcher: "echo"
  claimant: ""
  poll_interval: "10s"
  concurrency: 1
api_key: "deprecated-token"           # DEPRECATED: Use credentials.yaml instead
```

**Notes**:
- Field is `url`, not `baseUrl`
- `realm` is required
- `api_key` is deprecated; use `credentials.yaml`
- Task source ignores `orchestrate` section (that's for Bifrost CLI's orchestrate command)

### Appendix B: ~/.config/bifrost/credentials.yaml Schema

The credentials file stores PATs mapped by server URL.

```yaml
# ~/.config/bifrost/credentials.yaml (or $XDG_CONFIG_HOME/bifrost/credentials.yaml)
credentials:
  "https://bifrost.example.com":
    token: "the-pat-token"
  "https://other-bifrost.example.com":
    token: "another-token"
```

**Notes**:
- Top-level key is `credentials`
- Server URLs are map keys (not values)
- URLs are normalized (trailing slashes removed) for matching
- Token values are the actual PAT strings

### Appendix C: Bifrost HTTP API Endpoints

The task source uses these Bifrost HTTP API endpoints:

**List Ready Runes**
```
GET /api/runes?status=open&blocked=false&is_saga=false
Headers: 
  Authorization: Bearer {pat}
  X-Bifrost-Realm: {realm}
Response: 200 OK with array of rune objects
```

**Claim Rune**
```
POST /api/claim-rune
Headers:
  Authorization: Bearer {pat}
  X-Bifrost-Realm: {realm}
Body: { "id": string, "claimant": string }
Response: 204 No Content on success, 4xx on error
```

**Get Rune Detail**
```
GET /api/rune?id={runeId}
Headers:
  Authorization: Bearer {pat}
  X-Bifrost-Realm: {realm}
Response: 200 OK with rune detail object, 404 Not Found
```

**Fulfill Rune**
```
POST /api/fulfill-rune
Headers:
  Authorization: Bearer {pat}
  X-Bifrost-Realm: {realm}
Body: { "id": string }
Response: 204 No Content
```

**Fail Rune**
```
POST /api/fail-rune
Headers:
  Authorization: Bearer {pat}
  X-Bifrost-Realm: {realm}
Body: { "id": string, "reason": string }
Response: 204 No Content
```

**Update Rune State (TaskStateStore)**
```
POST /api/update-rune-state
Headers:
  Authorization: Bearer {pat}
  X-Bifrost-Realm: {realm}
Body: { "id": string, "state": Record<string, unknown> }
Response: 204 No Content
```

**Clear Rune State**
```
POST /api/clear-rune-state
Headers:
  Authorization: Bearer {pat}
  X-Bifrost-Realm: {realm}
Body: { "id": string }
Response: 204 No Content
```

### Appendix D: HTTP Status Codes

| Status | Meaning | Task Source Behavior |
|--------|---------|---------------------|
| 204 No Content | Success | Proceed |
| 401 Unauthorized | Invalid PAT | Log error, continue polling |
| 403 Forbidden | Insufficient permissions | Log error, continue polling |
| 404 Not Found | Rune not found | Return null from getTaskDetail |
| 409 Conflict | Domain constraint violation | Log error, skip rune |
| 422 Unprocessable Entity | Validation error | Log error, skip rune |
| 500+ Server Error | Bifrost server error | Log error, retry on next poll |

---
