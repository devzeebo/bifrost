# Bifrost Task Source Plugin PRD v3

**Status:** Draft  
**Authors:** Eric Siebeneich  
**Date:** 2026-05-08  
**Version:** 3.0

**Changes from v2:**
- Credential path corrected to `~/.config/bifrost/credentials.yaml` with YAML format
- Polling uses "ready" query pattern (`status=open&blocked=false&is_saga=false`)
- Removed custom filtering logic (use Bifrost's ready business logic)

---

## Product Description, Problem, and Goal

### Product Description

The **Bifrost Task Source Plugin** (`@orchestrator/task-source-bifrost`) implements the Orchestrator Framework's TaskSource interface, providing a bidirectional integration between Orchestrator and Bifrost. It enables AI agents to consume **runes** (work items) from Bifrost as executable tasks and report completion status back to Bifrost.

**Key Terms:**

- **Rune**: A work item (issue, task, bug) in Bifrost with lifecycle states (draft → open → claimed → fulfilled/sealed)
- **Saga**: An epic; a collection of related runes in Bifrost
- **Realm**: A tenant namespace in Bifrost for organizing runes
- **Task Source**: Orchestrator plugin that yields tasks via async iterator and handles coordination, state persistence, and completion reporting (per Orchestrator FR-1)
- **Task**: Minimal unit containing `id`, `agentId`, `taskState`, and `metadata` (per Orchestrator FR-2)
- **Agent**: An AI worker with specific capabilities (model, tools, prompt) that executes tasks

### Problem

Alex, an AI infrastructure engineer, has two disconnected systems:

1. **Bifrost** manages runes (work items) with rich metadata, dependencies, notes, acceptance criteria, and retrospectives
2. **Orchestrator** executes tasks using AI agents but needs TaskSource implementations to discover work

Alex wants agents to automatically discover work from Bifrost, execute it, and update rune status without manual coordination. Currently, Alex must manually copy rune data into Orchestrator and manually mark runes as fulfilled after agent execution.

### Goal

With the Bifrost Task Source Plugin, Alex configures the Orchestrator via `.orchestrator.yaml` with Bifrost connection details. Agents automatically discover available runes (open status, no blockers), execute them using the Orchestrator engine, and report completion back to Bifrost via fulfill/fail commands. Rune state updates persist, dependencies are tracked, and notes/retros capture execution context—all without manual intervention.

---

## User Stories / Use Cases

### US-1: System Administrator - Configure Bifrost Task Source

**As a** system administrator  
**I want to** configure the Bifrost task source plugin via `.orchestrator.yaml`  
**So that** the orchestrator can discover and execute runes from Bifrost

**Acceptance Criteria:**

```
Given a .orchestrator.yaml configuration file
And orchestrate.task_source.type is "bifrost"
And orchestrate.task_source.settings.url is "https://bifrost.example.com"
And orchestrate.task_source.settings.realm is "my-project"
And a valid PAT exists in ~/.config/bifrost/credentials.yaml for the URL
When the orchestrator loads configuration
Then a BifrostTaskSource is created with the specified settings
And the plugin loads credentials from ~/.config/bifrost/credentials.yaml
And the plugin validates connectivity to the Bifrost server
And invalid credentials result in a clear authentication error
```

### US-2: Task Discovery (Watch Tasks)

**As a** task orchestration system  
**I want to** continuously poll for ready runes in Bifrost via HTTP API  
**So that** agents can discover work as soon as it becomes available

**Acceptance Criteria:**

```
Given the plugin is configured and watching tasks
When a rune becomes "ready" (open status, not blocked, not a saga)
Then the plugin yields a Task via the watchTasks() async iterator
And the Task.id is the rune UUID
And the Task.agentId is derived from rune tags or "default"
And the Task.taskState is initialized from the Bifrost rune state
And the Task.metadata contains rune fields (title, description, priority, branch, sagaId, createdAt, assignee)
And the Task.metadata.dependencies contains array of DependencyRef
And the Task.metadata.notes contains array of NoteEntry
And the Task.metadata.acceptanceCriteria contains array of ACEntry
And the Task.metadata.retro contains array of RetroEntry
```

```
Given the plugin is watching for tasks
When no tasks are available
Then the plugin polls at increasing intervals (1s, 2s, 4s, ..., max 30s)
And when a task is found, the polling interval resets to 1s
```

```
Given the plugin watchTasks() async iterator throws an error or terminates unexpectedly
When the orchestrator detects the termination
Then the orchestrator follows Orchestrator FR-15 reconnection logic:
  - Wait 1 minute
  - Create a new Task Source instance with the same configuration
  - Call watchTasks() again
  - Log the reconnection attempt
```

### US-3: Agent Tag Routing

**As a** system operator  
**I want to** route runes to specific agent types based on tags  
**So that** specialized agents (implementer, tester, debugger) receive appropriate work

**Acceptance Criteria:**

```
Given a rune has tags in the format "agent:<agent-id>"
When the plugin yields a Task for the rune
Then Task.agentId is set to the agent-id from the tag
And if no agent tag exists, Task.agentId defaults to "default"
And multiple agent tags result in the first tag being used
```

### US-4: Dependency Mapping

**As a** task orchestration system  
**I want to** map Bifrost dependencies to task metadata  
**So that** task metadata includes relationship information

**Acceptance Criteria:**

```
Given a rune has dependencies of type "blocks", "relates_to", "duplicates", "supersedes", or "replies_to"
When the plugin yields a Task for the rune
Then Task.metadata.dependencies includes a DependencyRef for each dependency
And each DependencyRef includes the target rune ID and relationship type
And inverse dependency types (blocked_by, etc.) are normalized to their canonical form
```

### US-5: Task State Persistence

**As a** task orchestration system  
**I want to** persist task execution state updates to Bifrost via HTTP API  
**So that** agent progress is visible in Bifrost and survives failures

**Acceptance Criteria:**

```
Given a rune is being executed by an agent
When the engine calls setState(newState) via the TaskSource callback
Then the plugin immediately invokes POST /api/update-rune-state
And the rune state is persisted in Bifrost
And errors during state persistence are logged but do not fail task execution
```

### US-6: Task Completion Reporting

**As a** task orchestration system  
**I want to** report successful task completion to Bifrost  
**So that** runes are marked as fulfilled and agents can proceed to dependent work

**Acceptance Criteria:**

```
Given a rune is being executed by an agent
When the agent completes execution successfully
And the orchestrator calls completeTask(taskId)
Then the plugin invokes POST /api/fulfill-rune
And the rune status transitions to "fulfilled"
And dependent runes become unblocked
And fulfillment failures result in task failure with clear error messaging
```

### US-7: Task Failure Reporting

**As a** task orchestration system  
**I want to** report task execution failures to Bifrost  
**So that** failed runes are tracked and can be retried or investigated

**Acceptance Criteria:**

```
Given a rune is being executed by an agent
When the agent fails (validation error, hook exit code 2, EngineResult.success = false)
And the orchestrator calls failTask(taskId, error)
Then the plugin invokes POST /api/fail-rune
And the rune status transitions to "failed"
And the error message is persisted to the rune
```

### US-8: Claim Coordination

**As a** task source plugin author  
**I want to** ensure each rune is yielded to at most one orchestrator instance  
**So that** duplicate work is prevented

**Acceptance Criteria:**

```
Given multiple orchestrator instances are polling the same Bifrost realm
When a ready rune is discovered
Then each instance attempts POST /api/claim-rune
And only the first instance receives 204 No Content
And that instance yields the task via watchTasks()
And other instances receive 409 Conflict and skip the rune
```

---

## Functional Requirements

### FR-1: TaskSource Interface Implementation

The plugin MUST implement the TaskSource interface per Orchestrator FR-1:

```typescript
interface TaskSource {
  async watchTasks(): AsyncIterator<Task>;
  async completeTask(taskId: string): Promise<void>;
  async failTask(taskId: string, error: string): Promise<void>;
  async setState(taskId: string, taskState: Record<string, unknown>): Promise<void>;
}
```

The plugin is responsible for:
- Ensuring tasks yielded via `watchTasks()` include all data needed (id, agentId, taskState, metadata)
- Not re-emitting tasks that have been marked as `FAILED`
- Handling coordination via Bifrost's claim API (POST /api/claim-rune)
- Persisting task state via Bifrost's HTTP API
- Handling network connectivity (reconnection is handled by orchestrator per FR-15)

### FR-2: Task Type Mapping

The plugin MUST map Bifrost rune fields to the Task type per Orchestrator FR-2:

- `id`: Rune UUID (string)
- `agentId`: Derived from "agent:<agent-id>" tag or "default" (string)
- `taskState`: Initialized from Bifrost rune state JSON (Record<string, unknown>)
- `metadata`: Opaque metadata from Bifrost (Record<string, unknown>)
  - `title`: Rune title (string)
  - `description`: Rune description (string)
  - `priority`: Rune priority (1-5) (number)
  - `status`: Rune status (draft, open, claimed, fulfilled, sealed) (string)
  - `branch`: Associated Git branch (string | undefined)
  - `sagaId`: Parent saga UUID if exists (string | undefined)
  - `createdAt`: Rune creation timestamp (string)
  - `assignee`: Account ID of claimant (string | undefined)
  - `dependencies`: Array of DependencyRef (each has taskId and type)
  - `notes`: Array of NoteEntry (each has id, content, createdAt)
  - `acceptanceCriteria`: Array of ACEntry (each has id, criteria, satisfied)
  - `retro`: Array of RetroEntry (each has id, content, createdAt)

The orchestrator treats `taskState` and `metadata` as opaque per Orchestrator FR-2.

### FR-3: HTTP Client

The plugin MUST implement an HTTP client for Bifrost API communication:

- Base URL configuration
- Bearer token authentication (PAT loaded from credential store)
- X-Bifrost-Realm header injection
- JSON request/response handling
- Error handling with clear error messages

### FR-4: API Endpoints

The plugin MUST use the following Bifrost HTTP API endpoints:

- `GET /api/runes`: List runes with query parameters (for ready discovery)
- `GET /api/rune`: Get single rune with full details
- `POST /api/claim-rune`: Claim a rune (provides coordination)
- `POST /api/fulfill-rune`: Mark rune as fulfilled
- `POST /api/fail-rune`: Mark rune as failed with error message
- `POST /api/update-rune-state`: Update rune execution state

All data access is via HTTP API. No direct database access.

### FR-5: Ready Rune Discovery

The plugin MUST use the "ready" query pattern to discover available runes:

- Query: `GET /api/runes?status=open&blocked=false&is_saga=false`
- This pattern matches the `bf ready` command behavior
- Bifrost's business logic determines which runes are "ready" (not blocked, not sagas)
- The plugin does NOT implement custom filtering logic

Rationale: Bifrost has existing business logic for ready rune determination. Recreating this logic in the plugin would be redundant and could diverge from Bifrost's behavior.

### FR-6: Configuration

The plugin configuration follows the Orchestrator FR-13 format for `.orchestrator.yaml`:

```yaml
orchestrate:
  task_source:
    type: "bifrost"
    settings:
      url: string           # Bifrost server URL (required)
      realm: string         # Realm name (required)
      poll_interval: number # Base poll interval in ms (optional, default 1000)
      max_poll_interval: number # Max poll interval in ms (optional, default 30000)
      default_agent: string # Default agent ID (optional, default "default")
```

Token is loaded from `~/.config/bifrost/credentials.yaml`, not from configuration.

### FR-7: Credential Loading

The plugin MUST load credentials from Bifrost's credential store:

- Read `~/.config/bifrost/credentials.yaml` file
- Parse YAML format with `credentials` map keyed by normalized URL
- Extract PAT for the configured server URL
- Use PAT as Bearer token for HTTP requests
- Clear error if credentials file is missing or URL not found

**Credential File Format:**
```yaml
credentials:
  https://bifrost.example.com:
    token: "pat-value-here"
  http://localhost:8080:
    token: "another-pat-value"
```

URL normalization: Trailing slashes are trimmed (`https://example.com/` → `https://example.com`).

### FR-8: Error Handling

The plugin MUST handle errors appropriately:

- Authentication errors: terminate polling, throw clear error
- Network errors: retry with exponential backoff
- 404 errors (rune not found): log warning, skip task
- 409 errors (conflict): log warning, skip rune (already claimed)
- 5xx errors: retry with exponential backoff

### FR-9: Polling Behavior

The plugin MUST implement exponential backoff for polling:

- Start at 1 second (configurable via poll_interval)
- Double interval on each empty poll (up to max_poll_interval, default 30s)
- Reset interval to base when a task is found
- Add jitter (±20%) to avoid thundering herd across multiple instances
- Use short-polling only (no long-polling in v3)

### FR-10: Claim-Before-Yield Coordination

Per Orchestrator FR-1, the plugin MUST handle coordination via Bifrost's claim API:

- When a ready rune is discovered, attempt to claim it via POST /api/claim-rune
- If claim succeeds (204 No Content), yield the task via watchTasks()
- If claim fails with 409 Conflict, skip the rune (claimed by another instance)
- Bifrost manages claim coordination; no additional locking required in plugin

### FR-11: State Persistence Atomicity

Per Decision D1, setState() MUST be invoked immediately and atomically:

- Each call to setState(taskId, taskState) results in exactly one POST /api/update-rune-state
- No batching, no debouncing, no delaying of state updates
- Errors are logged but do not fail the task execution

---

## Non-Functional Requirements

### NFR-1: Performance

Per Orchestrator NFR-1:
- watchTasks() MUST yield tasks within polling interval (1s base, 30s max)
- API request timeout MUST be 30 seconds per Orchestrator NFR-1
- Task state persistence MUST complete within 500ms for remote API calls per Orchestrator NFR-1

### NFR-2: Reliability

Per Orchestrator NFR-2:
- The plugin MUST gracefully handle Bifrost server unavailability
- setState() failures MUST be logged but MUST NOT fail task execution (continue with agent execution)
- Complete/fail operations MUST be retried 3 times with exponential backoff before failing
- Network failures MUST NOT crash the orchestrator (continue polling)
- Orphaned claim recovery is out of scope (operational concern, not plugin concern per Decision D3)

### NFR-3: Observability

Per Orchestrator NFR-3:
- All Bifrost API operations MUST be logged with task ID, method, and endpoint
- Ready rune discovery MUST log number of runes returned from ready query
- State updates MUST log task ID and state size
- Claim attempts MUST log rune ID and result (success/skip)
- Errors MUST log context (task ID, operation, error message)

### NFR-4: Compatibility

Per Orchestrator NFR-4 (implicitly):
- Plugin MUST run in Node.js 24+
- Plugin MUST use ES modules (type: "module")
- Plugin MUST export TypeScript types
- Plugin MUST be compatible with Orchestrator Framework @orchestrator/task-source

### NFR-5: Concurrency

Per Orchestrator NFR-4:
- Multiple orchestrator instances MAY poll the same Bifrost realm
- The plugin's claim-before-yield coordination ensures each rune is processed by at most one instance
- No additional locking is required in the orchestrator (coordination is the task source's responsibility per Orchestrator FR-1)
- Bifrost's claim API provides atomic coordination (per Decision D2)

### NFR-6: Testing

Per Orchestrator NFR-5 (implicitly):
- Unit tests MUST cover all TaskSource methods
- Integration tests MUST use mocked Bifrost HTTP API server
- Tests MUST verify error handling for all HTTP status codes
- Tests MUST verify exponential backoff behavior
- Tests MUST verify claim coordination with multiple instances
- Tests MUST verify credential loading from ~/.config/bifrost/credentials.yaml
- Tests MUST verify ready query pattern with various parameter combinations

---

## Data & Storage

### Commands

No commands are created by this plugin. It invokes existing Bifrost commands via HTTP API:
- `ClaimRune`: Atomically claim a rune before yielding as task (POST /api/claim-rune)
- `FulfillRune`: Mark rune as fulfilled on successful task completion (POST /api/fulfill-rune)
- `FailRune`: Mark rune as failed on task failure (POST /api/fail-rune)
- `UpdateRuneState`: Persist taskState changes during execution (POST /api/update-rune-state)

### Events

No events are emitted by this plugin. It reads Bifrost's event-sourced state via HTTP API polling.

### Aggregates

No new aggregates are created. The plugin reads Bifrost's `rune` aggregate via HTTP API.

### API Queries

The plugin queries Bifrost via HTTP API (not direct database access):

**Ready Rune Discovery**
- Endpoint: `GET /api/runes?status=open&blocked=false&is_saga=false`
- Purpose: Discover runes ready for agent execution
- Business logic: Bifrost determines which runes are "ready" (not blocked, not sagas)
- Returns: Array of ready rune summary objects

**Get Rune Details**
- Endpoint: `GET /api/rune?id=<rune-id>`
- Purpose: Retrieve full rune context for task execution
- Returns: Complete rune object with dependencies, notes, AC, retro, state

**Claim Rune**
- Endpoint: `POST /api/claim-rune`
- Purpose: Atomically claim a rune before yielding as task
- Returns: 204 No Content on success, 409 Conflict if already claimed

**Update Rune State**
- Endpoint: `POST /api/update-rune-state`
- Purpose: Persist taskState changes during execution
- Returns: 204 No Content on success

**Fulfill Rune**
- Endpoint: `POST /api/fulfill-rune`
- Purpose: Mark rune as fulfilled on successful completion
- Returns: 204 No Content on success

**Fail Rune**
- Endpoint: `POST /api/fail-rune`
- Purpose: Mark rune as failed on execution failure
- Returns: 204 No Content on success

### Data Retention

No data retention requirements. All data is stored in Bifrost per its retention policies.

---

## Out of Scope

Per Orchestrator "Out of Scope" section and Bifrost Task Source v3 scope:

The following features are explicitly out of scope for v3:

- Creating runes from the orchestrator (read-only discovery from Bifrost)
- Modifying rune metadata (title, description, priority, branch)
- Managing dependencies (add/remove/update)
- Managing acceptance criteria (add/remove/update)
- Adding notes or retrospective entries from orchestrator
- Multi-realm support in single plugin instance (one realm per config)
- Real-time event streaming (HTTP short-polling only)
- Long-polling optimization (requires Bifrost API changes)
- Webhook callbacks from Bifrost to orchestrator
- SASL token authentication (PAT from credential store only)
- GraphQL API support (REST only)
- Admin operations (realm/account management)
- Level 5 meta-agent behavior (prompt improvement, eval-driven updates)
- Task state size enforcement (Bifrost's responsibility)
- Task state persistence across orchestrator restarts beyond what Bifrost provides
- **Orphaned claim recovery** (operational concern, not plugin concern per Decision D3)
- Direct database access (all access via HTTP API)
- **skipFulfill awareness** (orchestrator concern, not task source concern per Decision D6)
- **Custom filtering logic for ready runes** (use Bifrost's ready query pattern per Feedback FB2)

---

## Dependencies and Assumptions

### External Dependencies

| Dependency | Purpose |
|---|---|
| **Bifrost Server** | Rune management, event sourcing, HTTP API |
| **Bifrost HTTP API** | Task discovery, claiming, state updates, completion reporting |
| **Bifrost Realm** | Tenant namespace for runes |
| **Bifrost Credential Store** | PAT storage at ~/.config/bifrost/credentials.yaml |
| **Orchestrator Framework** | @orchestrator/task-source interface, @orchestrator/core orchestration |

### NPM Dependencies

- `@orchestrator/task-source`: Interface and type definitions (Task, TaskSource)
- Node.js 24+ native fetch for HTTP client
- YAML parser for credential file (e.g., `yaml` or `js-yaml`)

### Assumptions

Per Orchestrator "Assumptions" section and Bifrost-specific assumptions:

1. Bifrost server is running and accessible before plugin instantiation
2. Valid PAT exists in ~/.config/bifrost/credentials.yaml for the configured server URL
3. Realm has sufficient runes for agent execution
4. Agents follow the Orchestrator Framework contract (per Orchestrator Assumptions 1, 20, 21)
5. Network connectivity is reliable between orchestrator and Bifrost (per Orchestrator Assumption 16)
6. Bifrost API is stable and backward compatible
7. Rune lifecycle states follow the documented transitions (draft → open → claimed → fulfilled/sealed)
8. Dependency graph is acyclic (Bifrost enforces this for "blocks" dependencies)
9. The orchestrator is configured with `.orchestrator.yaml` per Orchestrator FR-13
10. The orchestrator handles TaskSource reconnection per FR-15 (plugin does not implement reconnection)
11. TaskSource handles coordination via Bifrost's claim API (per Orchestrator FR-1, Assumption 21, Decision D2)
12. TaskSource is responsible for persisting its own state (per Orchestrator Assumption 22)
13. setState() callback is provided by orchestrator and MUST be invoked immediately and atomically per Decision D1
14. completeTask() and failTask() are called by orchestrator, not by the engine directly
15. File system permissions: Orchestrator has read access to ~/.config/bifrost/credentials.yaml
16. Bifrost's claim API provides atomic coordination (per Decision D2)
17. Orphaned claims are an operational concern, not a plugin concern (per Decision D3)
18. Agent tags follow format `agent:<agent-id>` (per Decision D4)
19. Short-polling is used for task discovery (per Decision D5)
20. skipFulfill is an orchestrator concern, task source is unaware (per Decision D6)
21. Bifrost's "ready" query pattern determines which runes are available (per Feedback FB2)

---

## Decisions

This section records decisions made during PRD review. See v1 "Decisions and Feedback" section for full rationale.

**D1: Task State Persistence Granularity (2026-05-08)**
- setState() is called immediately on every engine invocation. No batching, no debouncing.
- Rationale: Bifrost's update-rune-state API is designed for atomic state updates. Real-time visibility is more valuable than API call optimization.

**D2: Claim Coordination (2026-05-08)**
- Claims are managed entirely by Bifrost. Plugin calls POST /api/claim-rune before yielding. No additional coordination logic.
- Rationale: Bifrost provides atomic claim semantics. Duplicating this logic in the plugin would be redundant and error-prone.

**D3: Orphaned Claim Recovery (2026-05-08)**
- Out of scope for the task source plugin. Orphaned or stalled claims are an operational concern.
- Rationale: The plugin's responsibility ends at the API boundary. Recovery mechanisms belong in Bifrost or operational tooling.

**D4: Agent Tag Format (2026-05-08)**
- Use `agent:<agent-id>` format where `<agent-id>` matches orchestrator's agent catalog.
- Rationale: Simple, extensible, aligns with Bifrost's existing tag system.

**D5: Polling Strategy (2026-05-08)**
- Short-polling with exponential backoff (1s base, 30s max). No long-polling, no webhooks in v3.
- Rationale: Bifrost API doesn't support long-polling. Short-polling is sufficient and requires no Bifrost changes.

**D6: skipFulfill Handling (2026-05-08)**
- Task source plugin is unaware of skipFulfill. It's an orchestrator concern.
- Rationale: The orchestrator decides whether to call completeTask() based on EngineResult.skipFulfill. The task source only handles the calls it receives.

**D7: Ready Rune Discovery (2026-05-08)**
- Use Bifrost's "ready" query pattern: `GET /api/runes?status=open&blocked=false&is_saga=false`
- No custom filtering logic in the plugin.
- Rationale: Bifrost has existing business logic for ready rune determination. Recreating this logic would be redundant and could diverge from Bifrost's behavior.

---

## Feedback

This section records feedback received after v3 completion for incorporation into v4.

**FB1: Configuration Duplication (2026-05-08)**
- Current: PRD specifies url and realm in both .bifrost.yaml and orchestrate.task_source.settings
- Correction: URL and realm are already in .bifrost.yaml. Don't duplicate in orchestrate config.
- Action for v4: Remove url and realm from plugin configuration. Read from .bifrost.yaml instead.
- Note: .bifrost.yaml is created by `bf init --realm <name>` and contains url and realm fields.

**FB2: Default Agent Removal (2026-05-08)**
- Current: PRD specifies default_agent setting (defaults to "default")
- Correction: No default agent. If rune has no agent tag, noop it—ignore and don't yield.
- Rationale: Only explicitly tagged runes should be processed. Un-tagged runes are not meant for agent execution.
- Action for v4: Remove default_agent configuration. Skip runes without agent:<agent-id> tags.

**FB3: Dedicated Ready Endpoint (2026-05-08)**
- Current: PRD uses query parameters for ready discovery (`?status=open&blocked=false&is_saga=false`)
- Correction: Add dedicated `GET /api/ready` endpoint to Bifrost.
- Rationale: CLI and task source shouldn't have different opinions on what "ready" means. Single source of truth.
- Action for v4: Update PRD to use `GET /api/ready` endpoint. Add scope item for Bifrost server implementation of ready endpoint.
