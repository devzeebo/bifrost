# Bifrost Task Source Plugin PRD v1

**Status:** Draft  
**Authors:** Eric Siebeneich  
**Date:** 2026-05-08  
**Version:** 1.0

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
And orchestrate.task_source.settings.token is a valid PAT
When the orchestrator loads configuration
Then a BifrostTaskSource is created with the specified settings
And the plugin validates connectivity to the Bifrost server
And invalid credentials result in a clear authentication error
```

### US-2: Task Discovery (Watch Tasks)

**As a** task orchestration system  
**I want to** continuously poll for available runes in Bifrost  
**So that** agents can discover work as soon as it becomes available

**Acceptance Criteria:**

```
Given the plugin is configured and watching tasks
When a rune transitions to "open" status with no blocking dependencies
Then the plugin yields a Task via the watchTasks() async iterator
And the Task.id is the rune UUID
And the Task.agentId is derived from rune tags or "default"
And the Task.taskState is initialized from the Bifrost rune state
And the Task.metadata contains rune fields (title, description, priority, branch, sagaId, createdAt, assignee)
And Task extends TaskDetail with dependencies, notes, acceptanceCriteria, and retro
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
Given a rune has tags in the format "agent:<agent-type>"
When the plugin yields a Task for the rune
Then Task.agentId is set to the agent type from the tag
And if no agent tag exists, Task.agentId defaults to "default"
And multiple agent tags result in the first tag being used
```

### US-4: Dependency Mapping

**As a** task orchestration system  
**I want to** map Bifrost dependencies to task dependency references  
**So that** task metadata includes relationship information

**Acceptance Criteria:**

```
Given a rune has dependencies of type "blocks", "relates_to", "duplicates", "supersedes", or "replies_to"
When the plugin yields a Task for the rune
Then TaskDetail includes a DependencyRef for each dependency
And each DependencyRef includes the target rune ID and relationship type
And inverse dependency types (blocked_by, etc.) are normalized to their canonical form
```

### US-5: Task State Persistence

**As a** task orchestration system  
**I want to** persist task execution state updates to Bifrost  
**So that** agent progress is visible in Bifrost and survives failures

**Acceptance Criteria:**

```
Given a rune is being executed by an agent
When the engine calls setState(newState) via the TaskSource callback
Then the plugin invokes the Bifrost update-rune-state API
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
When the agent completes execution successfully (EngineResult.success = true, skipFulfill = false)
Then the orchestrator calls completeTask(taskId)
And the plugin invokes the Bifrost fulfill-rune API
And the rune status transitions to "fulfilled"
And dependent runes become unblocked
And fulfillment failures result in task failure with clear error messaging
```

```
Given EngineResult.skipFulfill is true
When the orchestrator receives the engine result
Then the orchestrator does NOT call completeTask()
And the rune status remains unchanged
```

### US-7: Task Failure Reporting

**As a** task orchestration system  
**I want to** report task execution failures to Bifrost  
**So that** failed runes are tracked and can be retried or investigated

**Acceptance Criteria:**

```
Given a rune is being executed by an agent
When the agent fails (validation error, hook exit code 2, EngineResult.success = false)
Then the orchestrator calls failTask(taskId, error)
And the plugin invokes the Bifrost fail-rune API
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
When a rune becomes available
Then only one orchestrator instance successfully claims the rune
And the claiming instance yields the task via watchTasks()
And other instances skip the rune (409 conflict)
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
- Handling coordination via atomic claims to prevent duplicate task processing
- Persisting task state according to its own requirements (via Bifrost API)
- Handling network connectivity and reconnection (orchestrator handles iterator termination per FR-15)

### FR-2: Task Type Mapping

The plugin MUST map Bifrost rune fields to the Task type per Orchestrator FR-2:

- `id`: Rune UUID (string)
- `agentId`: Derived from "agent:<type>" tag or "default" (string)
- `taskState`: Initialized from Bifrost rune state JSON (Record<string, unknown>)
- `metadata`: Opaque metadata from Bifrost (Record<string, unknown>)
  - `title`: Rune title
  - `description`: Rune description
  - `priority`: Rune priority (1-5)
  - `status`: Rune status (draft, open, claimed, fulfilled, sealed)
  - `branch`: Associated Git branch
  - `sagaId`: Parent saga UUID if exists
  - `createdAt`: Rune creation timestamp
  - `assignee`: Account ID of claimant

The orchestrator treats `taskState` and `metadata` as opaque per Orchestrator FR-2.

### FR-3: TaskDetail Extension

The plugin MUST provide TaskDetail data for each yielded task (extends Task):

- `dependencies`: Array of DependencyRef from Bifrost dependency relationships
- `notes`: Array of NoteEntry from Bifrost note history
- `acceptanceCriteria`: Array of ACEntry from Bifrost acceptance criteria
- `retro`: Array of RetroEntry from Bifrost retrospective entries

### FR-4: HTTP Client

The plugin MUST implement an HTTP client for Bifrost API communication:

- Base URL configuration
- Bearer token authentication (PAT or JWT)
- X-Bifrost-Realm header injection
- JSON request/response handling
- Error handling with clear error messages

### FR-5: API Endpoints

The plugin MUST use the following Bifrost HTTP API endpoints:

- `GET /api/runes`: List runes with status filter
- `GET /api/rune`: Get single rune with full details
- `POST /api/claim-rune`: Claim a rune (provides coordination)
- `POST /api/fulfill-rune`: Mark rune as fulfilled
- `POST /api/fail-rune`: Mark rune as failed with error message
- `POST /api/update-rune-state`: Update rune execution state

### FR-6: Rune Filtering

The plugin MUST filter runes when watching tasks:

- Status must be "open"
- No dependencies of type "blocks" may be unsatisfied (all blocking runes must be fulfilled)
- Rune must not already be claimed by another orchestrator instance

### FR-7: Configuration

The plugin configuration follows the Orchestrator FR-13 format for `.orchestrator.yaml`:

```yaml
orchestrate:
  task_source:
    type: "bifrost"
    settings:
      url: string           # Bifrost server URL (required)
      realm: string         # Realm name (required)
      token: string         # PAT or JWT token (required)
      poll_interval: number # Base poll interval in ms (optional, default 1000)
      max_poll_interval: number # Max poll interval in ms (optional, default 30000)
      default_agent: string # Default agent ID (optional, default "default")
```

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

### FR-10: Claim-Before-Yield Coordination

Per Orchestrator FR-1, the plugin MUST handle coordination. The plugin uses Bifrost's atomic claim primitive:

- When an available rune is discovered, attempt to claim it via POST /api/claim-rune
- If claim succeeds (204), yield the task via watchTasks()
- If claim fails with 409 Conflict, skip the rune (claimed by another instance)
- Track claimed runes for potential cleanup on startup (orphan detection)

---

## Non-Functional Requirements

### NFR-1: Performance

Per Orchestrator NFR-1:
- watchTasks() MUST yield tasks within polling interval (1s base, 30s max)
- API request timeout MUST be 30 seconds per Orchestrator NFR-1
- Task state persistence MUST complete within 500ms for remote stores per Orchestrator NFR-1

### NFR-2: Reliability

Per Orchestrator NFR-2:
- The plugin MUST gracefully handle Bifrost server unavailability
- setState() failures MUST be logged but MUST NOT fail task execution (continue with agent execution)
- Complete/fail operations MUST be retried 3 times with exponential backoff before failing
- Network failures MUST NOT crash the orchestrator (continue polling)

### NFR-3: Observability

Per Orchestrator NFR-3:
- All Bifrost API operations MUST be logged with task ID and method
- Task discovery MUST log number of available runes found
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

### NFR-6: Testing

Per Orchestrator NFR-5 (implicitly):
- Unit tests MUST cover all TaskSource methods
- Integration tests MUST use mocked Bifrost HTTP server
- Tests MUST verify error handling for all HTTP status codes
- Tests MUST verify exponential backoff behavior
- Tests MUST verify claim coordination with multiple instances

---

## Data & Storage

### Commands

No commands are created by this plugin. It invokes existing Bifrost commands via HTTP API:
- `ClaimRune`: Atomically claim a rune before yielding as task
- `FulfillRune`: Mark rune as fulfilled on successful task completion
- `FailRune`: Mark rune as failed on task failure
- `UpdateRuneState`: Persist taskState changes during execution

### Events

No events are emitted by this plugin. It reads Bifrost's event-sourced state via API polling.

### Aggregates

No new aggregates are created. The plugin reads Bifrost's `rune` aggregate via API.

### Projections

The plugin reads from the following Bifrost projections:

- `rune_summary`: For listing available runes (status, dependencies, assignee)
- `rune_detail`: For retrieving full rune details (notes, AC, retro, state)

### Query Projections

**Q1: List Available Runes**
- Projection: `rune_summary`
- Purpose: Discover runes ready for agent execution
- Query: `SELECT * FROM rune_summary WHERE status = 'open' AND realm_id = ?`
- Filters: No blocking dependencies unsatisfied, not already claimed

**Q2: Get Rune Details**
- Projection: `rune_detail`
- Purpose: Retrieve full rune context for task execution
- Query: `SELECT * FROM rune_detail WHERE rune_id = ? AND realm_id = ?`
- Returns: All rune fields including dependencies, notes, AC, retro, state

**Q3: Check Dependency Status**
- Projection: `rune_summary`
- Purpose: Verify blocking dependencies are satisfied
- Query: `SELECT status FROM rune_summary WHERE rune_id IN (?) AND realm_id = ?`
- Returns: Status of each dependency (must be "fulfilled" for blocks dependencies)

### Data Retention

No data retention requirements. All data is stored in Bifrost per its retention policies.

---

## Out of Scope

Per Orchestrator "Out of Scope" section and Bifrost Task Source v1 scope:

The following features are explicitly out of scope for v1:

- Creating runes from the orchestrator (read-only discovery from Bifrost)
- Modifying rune metadata (title, description, priority, branch)
- Managing dependencies (add/remove/update)
- Managing acceptance criteria (add/remove/update)
- Adding notes or retrospective entries from orchestrator
- Multi-realm support in single plugin instance (one realm per config)
- Real-time event streaming (HTTP polling only)
- Webhook callbacks from Bifrost to orchestrator
- SASL token authentication (PAT and JWT only)
- GraphQL API support (REST only)
- Admin operations (realm/account management)
- Level 5 meta-agent behavior (prompt improvement, eval-driven updates)
- Task state size enforcement (Bifrost's responsibility)
- Task state persistence across orchestrator restarts beyond what Bifrost provides
- Automatic orphaned claim recovery (manual recovery via unclaim/reopen in v1)

---

## Dependencies and Assumptions

### External Dependencies

| Dependency | Purpose |
|---|---|
| **Bifrost Server** | Rune management, event sourcing, projections |
| **Bifrost HTTP API** | Task discovery, claiming, state updates, completion reporting |
| **Bifrost Realm** | Tenant namespace for runes |
| **Orchestrator Framework** | @orchestrator/task-source interface, @orchestrator/core orchestration |

### NPM Dependencies

- `@orchestrator/task-source`: Interface and type definitions (Task, TaskDetail, TaskSource)
- Node.js 24+ native fetch or `node-fetch` for HTTP client

### Assumptions

Per Orchestrator "Assumptions" section and Bifrost-specific assumptions:

1. Bifrost server is running and accessible before plugin instantiation
2. Valid PAT or JWT token is available for the configured realm
3. Realm has sufficient runes for agent execution
4. Agents follow the Orchestrator Framework contract (per Orchestrator Assumptions 1, 20, 21)
5. Network connectivity is reliable between orchestrator and Bifrost (per Orchestrator Assumption 16)
6. Bifrost API version is stable and backward compatible
7. Rune lifecycle states follow the documented transitions (draft → open → claimed → fulfilled/sealed)
8. Dependency graph is acyclic (Bifrost enforces this for "blocks" dependencies)
9. The orchestrator is configured with `.orchestrator.yaml` per Orchestrator FR-13
10. The orchestrator handles TaskSource reconnection per FR-15 (plugin does not need to implement reconnection)
11. TaskSource handles coordination via atomic claims (per Orchestrator FR-1, Assumption 21)
12. TaskSource is responsible for persisting its own state (per Orchestrator Assumption 22)
13. setState() callback is provided by orchestrator and MUST be invoked by engine per Orchestrator FR-3
14. completeTask() and failTask() are called by orchestrator, not by the engine directly
15. File system permissions: Orchestrator has read/write access to project directory (per Orchestrator Assumption 17)

---

## Open Questions

### Q1: Task State Persistence Granularity

**Ambiguity:** How frequently should the plugin call setState() when the engine invokes the callback? Should it batch updates?

**Assumption:** setState() should be called immediately when the engine invokes it to ensure real-time visibility in Bifrost.

**Ideal Solution:** Call setState() immediately on each engine callback invocation. Implement debouncing if updates occur more frequently than 100ms to reduce API load.

**Alternatives:**
1. Batch updates every 5 seconds — reduces API calls but loses real-time visibility
2. Flush updates only on complete/fail — reduces API calls but eliminates progress tracking during execution

**Comparison:** Immediate updates provide best observability and align with Bifrost's real-time design goals. Batching adds complexity and reduces visibility without significant benefit for typical agent workloads. Debouncing at 100ms provides a middle ground if API load becomes a concern.

### Q2: Claim Ownership and Race Conditions

**Ambiguity:** What happens when multiple orchestrator instances poll for the same rune? How are claims managed?

**Assumption:** Bifrost's claim-rune API provides atomic claim semantics (first claim wins, subsequent claims fail with 409).

**Ideal Solution:** Attempt to claim each available rune before yielding it as a task. If claim fails (409), skip the rune as it's claimed by another instance. This aligns with Orchestrator FR-1's requirement that TaskSource handles coordination.

**Alternatives:**
1. No explicit claiming — rely on rune status checks only — vulnerable to race conditions between "check" and "yield"
2. Pre-claim all available runes on startup — wasteful of API calls and complicates cleanup

**Comparison:** Claim-before-yield ensures correct distributed behavior without significant complexity. Bifrost's atomic claim primitive is designed for this use case. This is the only approach that satisfies Orchestrator FR-1's coordination requirement.

### Q3: Orphaned Claim Recovery

**Ambiguity:** If the orchestrator crashes after claiming a rune but before completion, how is the orphaned claim recovered?

**Assumption:** Bifrost provides visibility into claim ownership and timestamp. Orphaned claims can be detected and released.

**Ideal Solution:** On plugin instantiation, query for runes claimed by this orchestrator instance (identified by claimant ID or tag). For claims older than a threshold (e.g., 1 hour), log a warning and optionally attempt to unclaim. This is a recovery mechanism, not a primary coordination strategy.

**Alternatives:**
1. Manual intervention only — operators must clean up orphaned claims via CLI or UI
2. Automatic unclaim of all old claims on startup — risks disrupting active executions on other instances if identification is imperfect

**Comparison:** Automatic recovery with time-based heuristics balances automation with safety. For v1, this can be deferred to manual recovery if Bifrost lacks sufficient metadata (claim timestamp, claimant identity) for reliable orphan detection. The primary coordination mechanism (claim-before-yield) prevents orphan creation in normal operation.

### Q4: Agent Tag Format

**Ambiguity:** What is the exact format for agent routing tags in Bifrost? How are multiple agent types specified?

**Assumption:** Tags follow the format `agent:<agent-type>` where `<agent-type>` is a string identifier matching an agentId in the orchestrator's agent catalog (e.g., "implementer", "tester", "reviewer").

**Ideal Solution:** Support the `agent:<type>` format. Use the first matching agent tag if multiple exist. If no agent tag exists, use the configured `default_agent` (or "default" if not configured).

**Alternatives:**
1. Single rigid tag format only — simpler but less flexible for future enhancements
2. Complex tag syntax with priority or metadata (e.g., `agent:tester:priority:1`) — over-engineered for v1

**Comparison:** Simple `agent:<type>` format is sufficient for v1 and aligns with Bifrost's existing tag system. Priority or metadata can be added in v2 if needed. The format is extensible without breaking existing tags.

### Q5: Polling Efficiency

**Ambiguity:** Should the plugin use HTTP long-polling or short-polling for task discovery?

**Assumption:** Bifrost API does not support long-polling in v1. Short-polling with exponential backoff is required.

**Ideal Solution:** Implement exponential backoff starting at 1s (configurable), maxing at 30s (configurable). Reset interval when tasks are found. Add jitter (±20%) to avoid thundering herd across multiple orchestrator instances.

**Alternatives:**
1. Fixed interval polling (e.g., every 10 seconds) — simpler but less efficient when tasks are sparse
2. Webhook push notifications from Bifrost — requires Bifrost changes and adds complexity

**Comparison:** Exponential backoff with jitter is the standard pattern for polling-based systems and aligns with Orchestrator NFR-1 (configurable polling interval). It balances responsiveness with resource efficiency. Webhooks can be added in v2 if Bifrost adds support, but polling provides a working v1 solution without Bifrost changes.

### Q6: skipFulfill Handling

**Ambiguity:** When EngineResult.skipFulfill is true, should the plugin still update Bifrost rune state?

**Assumption:** skipFulfill means "do not mark the rune as fulfilled," but state updates and notes should still be persisted.

**Ideal Solution:** When skipFulfill is true, the orchestrator does not call completeTask() (per Orchestrator FR-14). The rune remains in "claimed" status. Any setState() calls during execution still persist. A follow-up task can be created to complete the rune later.

**Alternatives:**
1. skipFulfill skips all Bifrost updates — loses valuable state and notes
2. skipFulfill is not supported — forces agents to always fulfill or fail

**Comparison:** The ideal solution preserves work done during execution while allowing deferred completion. This supports multi-stage workflows where an agent completes a phase but leaves the rune open for follow-up work.
