# Bifrost Task Source Plugin PRD v4

**Status:** Draft  
**Authors:** Eric Siebeneich  
**Date:** 2026-05-08  
**Version:** 4.0

**Changes from v3:**
- Configuration: Read url/realm from .bifrost.yaml (no duplication in orchestrate config)
- No default agent: Skip runes without agent:<agent-id> tags
- Use dedicated GET /api/ready endpoint (new Bifrost API endpoint)

---

## Product Description, Problem, and Goal

### Product Description

The **Bifrost Task Source Plugin** (`@bifrost-ai/task-source-bifrost`) implements the Orchestrator Framework's TaskSource interface, providing a bidirectional integration between Orchestrator and Bifrost. It enables AI agents to consume **runes** (work items) from Bifrost as executable tasks and report completion status back to Bifrost.

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

With the Bifrost Task Source Plugin, Alex configures the Orchestrator via `.orchestrator.yaml`. The plugin reads Bifrost connection details from `.bifrost.yaml` (created by `bf init`). Agents automatically discover available runes via the `/api/ready` endpoint, execute them using the Orchestrator engine, and report completion back to Bifrost via fulfill/fail commands. Rune state updates persist, dependencies are tracked, and notes/retros capture execution context—all without manual coordination.

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
And a .bifrost.yaml file exists in the project root
And .bifrost.yaml contains url and realm fields
And a valid PAT exists in ~/.config/bifrost/credentials.yaml for the URL
When the orchestrator loads configuration
Then a BifrostTaskSource is created with settings from .bifrost.yaml
And the plugin loads credentials from ~/.config/bifrost/credentials.yaml
And the plugin validates connectivity to the Bifrost server
And invalid credentials result in a clear authentication error
```

### US-2: Task Discovery (Watch Tasks)

**As a** task orchestration system  
**I want to** continuously poll for ready runes in Bifrost via the /api/ready endpoint  
**So that** agents can discover work as soon as it becomes available

**Acceptance Criteria:**

```
Given the plugin is configured and watching tasks
When a rune is returned by GET /api/ready
And the rune has an agent:<agent-id> tag
Then the plugin yields a Task via the watchTasks() async iterator
And the Task.id is the rune UUID
And the Task.agentId is the agent-id from the tag
And the Task.taskState is initialized from the Bifrost rune state
And the Task.metadata contains rune fields (title, description, priority, branch, sagaId, createdAt, assignee)
And the Task.metadata.dependencies contains array of DependencyRef
And the Task.metadata.notes contains array of NoteEntry
And the Task.metadata.acceptanceCriteria contains array of ACEntry
And the Task.metadata.retro contains array of RetroEntry
```

```
Given the plugin is watching for tasks
When a rune is returned by GET /api/ready
And the rune has no agent:<agent-id> tag
Then the plugin skips the rune (does not yield a Task)
And polling continues to the next rune
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
When the plugin evaluates the rune for task generation
Then Task.agentId is set to the agent-id from the tag
And multiple agent tags result in the first tag being used
And if no agent tag exists, the rune is skipped (not yielded)
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
- `agentId`: Derived from "agent:<agent-id>" tag (string). No default—runes without agent tags are skipped.
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

- `GET /api/ready`: List ready runes (open, not blocked, not sagas) — NEW endpoint for v4
- `GET /api/rune`: Get single rune with full details
- `POST /api/claim-rune`: Claim a rune (provides coordination)
- `POST /api/fulfill-rune`: Mark rune as fulfilled
- `POST /api/fail-rune`: Mark rune as failed with error message
- `POST /api/update-rune-state`: Update rune execution state

All data access is via HTTP API. No direct database access.

### FR-5: Ready Rune Discovery

The plugin MUST use the dedicated `/api/ready` endpoint to discover available runes:

- Endpoint: `GET /api/ready`
- Returns: Array of ready runes (open status, not blocked, not sagas)
- Bifrost's business logic determines which runes are "ready"
- The plugin does NOT implement custom filtering logic

**Note:** The `/api/ready` endpoint is a new Bifrost API addition for v4. It encapsulates the same business logic as the `bf ready` CLI command, ensuring the CLI and task source have consistent opinions on what constitutes a "ready" rune.

Rationale: Having a dedicated endpoint prevents logic divergence between CLI and task source, and provides a single source of truth for ready rune determination.

### FR-6: Configuration

The plugin configuration follows the Orchestrator FR-13 format for `.orchestrator.yaml`:

```yaml
orchestrate:
  task_source:
    type: "bifrost"
    settings:
      poll_interval: number # Base poll interval in ms (optional, default 1000)
      max_poll_interval: number # Max poll interval in ms (optional, default 30000)
```

**URL and realm are read from `.bifrost.yaml`, not from the orchestrate config.**

The `.bifrost.yaml` file is created by `bf init --realm <name>` and contains:

```yaml
url: https://bifrost.example.com
realm: my-project
```

Token is loaded from `~/.config/bifrost/credentials.yaml`, not from configuration.

### FR-7: Configuration File Reading

The plugin MUST read Bifrost configuration from `.bifrost.yaml`:

- Read `.bifrost.yaml` from the project root (same directory as `.orchestrator.yaml`)
- Parse YAML format with `url` and `realm` fields
- Use `url` as the Bifrost server base URL
- Use `realm` for the X-Bifrost-Realm header
- Clear error if `.bifrost.yaml` is missing or malformed

### FR-8: Credential Loading

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

### FR-9: Agent Tag Filtering

The plugin MUST filter runes based on agent tags:

- When processing runes from `/api/ready`, check each rune for `agent:<agent-id>` tags
- If a rune has at least one agent tag, use the first tag's agent-id as Task.agentId
- If a rune has no agent tags, skip the rune (do not yield a Task)
- No default agent fallback—un-tagged runes are explicitly not meant for agent execution

### FR-10: Error Handling

The plugin MUST handle errors appropriately:

- Authentication errors: terminate polling, throw clear error
- Network errors: retry with exponential backoff
- 404 errors (rune not found): log warning, skip task
- 409 errors (conflict): log warning, skip rune (already claimed)
- 5xx errors: retry with exponential backoff

### FR-11: Polling Behavior

The plugin MUST implement exponential backoff for polling:

- Start at 1 second (configurable via poll_interval)
- Double interval on each empty poll (up to max_poll_interval, default 30s)
- Reset interval to base when a task is found
- Add jitter (±20%) to avoid thundering herd across multiple instances
- Use short-polling only (no long-polling in v4)

### FR-12: Claim-Before-Yield Coordination

Per Orchestrator FR-1, the plugin MUST handle coordination via Bifrost's claim API:

- When a ready rune with an agent tag is discovered, attempt to claim it via POST /api/claim-rune
- If claim succeeds (204 No Content), yield the task via watchTasks()
- If claim fails with 409 Conflict, skip the rune (claimed by another instance)
- Bifrost manages claim coordination; no additional locking required in plugin

### FR-13: State Persistence Atomicity

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
- Ready rune discovery MUST log number of runes returned from /api/ready
- Agent tag filtering MUST log number of runes skipped (no agent tag)
- State updates MUST log task ID and state size
- Claim attempts MUST log rune ID and result (success/skip)
- Errors MUST log context (task ID, operation, error message)

### NFR-4: Compatibility

Per Orchestrator NFR-4 (implicitly):
- Plugin MUST run in Node.js 24+
- Plugin MUST use ES modules (type: "module")
- Plugin MUST export TypeScript types
- Plugin MUST be compatible with Orchestrator Framework @bifrost-ai/task-source

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
- Tests MUST verify configuration reading from .bifrost.yaml
- Tests MUST verify agent tag filtering (runes without tags are skipped)

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
- Endpoint: `GET /api/ready`
- Purpose: Discover runes ready for agent execution
- Business logic: Bifrost determines which runes are "ready" (open, not blocked, not sagas)
- Returns: Array of ready rune summary objects
- New in v4: Dedicated endpoint to ensure consistency with CLI

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

Per Orchestrator "Out of Scope" section and Bifrost Task Source v4 scope:

The following features are explicitly out of scope for v4:

- Creating runes from the orchestrator (read-only discovery from Bifrost)
- Modifying rune metadata (title, description, priority, branch)
- Managing dependencies (add/remove/update)
- Managing acceptance criteria (add/remove/update)
- Adding notes or retrospective entries from orchestrator
- Multi-realm support in single plugin instance (one realm per .bifrost.yaml)
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
- **Custom filtering logic for ready runes** (use Bifrost's /api/ready endpoint)
- **Default agent behavior** (runes without agent tags are skipped per Feedback FB2)

---

## Dependencies and Assumptions

### External Dependencies

| Dependency | Purpose |
|---|---|
| **Bifrost Server** | Rune management, event sourcing, HTTP API |
| **Bifrost HTTP API** | Task discovery, claiming, state updates, completion reporting |
| **Bifrost Realm** | Tenant namespace for runes |
| **.bifrost.yaml** | Per-project configuration (url, realm) created by `bf init` |
| **Bifrost Credential Store** | PAT storage at ~/.config/bifrost/credentials.yaml |
| **Orchestrator Framework** | @bifrost-ai/task-source interface, @bifrost-ai/core orchestration |

### NPM Dependencies

- `@bifrost-ai/task-source`: Interface and type definitions (Task, TaskSource)
- Node.js 24+ native fetch for HTTP client
- YAML parser for configuration and credential files (e.g., `yaml` or `js-yaml`)

### Assumptions

Per Orchestrator "Assumptions" section and Bifrost-specific assumptions:

1. Bifrost server is running and accessible before plugin instantiation
2. .bifrost.yaml exists in the project root with valid url and realm fields
3. Valid PAT exists in ~/.config/bifrost/credentials.yaml for the configured server URL
4. Realm has sufficient runes for agent execution
5. Agents follow the Orchestrator Framework contract (per Orchestrator Assumptions 1, 20, 21)
6. Network connectivity is reliable between orchestrator and Bifrost (per Orchestrator Assumption 16)
7. Bifrost API is stable and backward compatible
8. Rune lifecycle states follow the documented transitions (draft → open → claimed → fulfilled/sealed)
9. Dependency graph is acyclic (Bifrost enforces this for "blocks" dependencies)
10. The orchestrator is configured with `.orchestrator.yaml` per Orchestrator FR-13
11. The orchestrator handles TaskSource reconnection per FR-15 (plugin does not implement reconnection)
12. TaskSource handles coordination via Bifrost's claim API (per Orchestrator FR-1, Assumption 21, Decision D2)
13. TaskSource is responsible for persisting its own state (per Orchestrator Assumption 22)
14. setState() callback is provided by orchestrator and MUST be invoked immediately and atomically per Decision D1
15. completeTask() and failTask() are called by orchestrator, not by the engine directly
16. File system permissions: Orchestrator has read access to ~/.config/bifrost/credentials.yaml and .bifrost.yaml
17. Bifrost's claim API provides atomic coordination (per Decision D2)
18. Orphaned claims are an operational concern, not a plugin concern (per Decision D3)
19. Agent tags follow format `agent:<agent-id>` (per Decision D4)
20. Short-polling is used for task discovery (per Decision D5)
21. skipFulfill is an orchestrator concern, task source is unaware (per Decision D6)
22. Bifrost's /api/ready endpoint provides ready rune determination (per Feedback FB3)
23. Runes without agent tags are skipped, not defaulted (per Feedback FB2)
24. URL and realm come from .bifrost.yaml, not orchestrate config (per Feedback FB1)

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
- Short-polling with exponential backoff (1s base, 30s max). No long-polling, no webhooks in v4.
- Rationale: Bifrost API doesn't support long-polling. Short-polling is sufficient and requires no Bifrost changes.

**D6: skipFulfill Handling (2026-05-08)**
- Task source plugin is unaware of skipFulfill. It's an orchestrator concern.
- Rationale: The orchestrator decides whether to call completeTask() based on EngineResult.skipFulfill. The task source only handles the calls it receives.

**D7: Ready Rune Discovery (2026-05-08)**
- Use dedicated Bifrost endpoint: `GET /api/ready` (new in v4).
- No custom filtering logic in the plugin.
- Rationale: CLI and task source shouldn't have different opinions on what "ready" means. Single source of truth.

**D8: Configuration Source (2026-05-08)**
- URL and realm read from .bifrost.yaml, not duplicated in orchestrate config.
- Rationale: .bifrost.yaml already exists from `bf init`. Don't make users specify the same values twice.

**D9: Default Agent Behavior (2026-05-08)**
- No default agent. Runes without agent:<agent-id> tags are skipped.
- Rationale: Only explicitly tagged runes should be processed. Un-tagged runes are not meant for agent execution.
