# Unified Orchestrator PRD v1

**Status:** Draft  
**Authors:** Eric Siebeneich, Matthew Wright, Alexander Reeves  
**Date:** 2026-05-07  
**Version:** 1.0

---

## Product Description, Problem, and Goal

### Product Description

The **Bifrost Orchestrator** is a Python-based distributed task execution system that coordinates **AI agents** to perform work across multiple projects. It provides a plugin architecture with **Task Sources** (providers of work) and **Engines** (executors of work), connected by a core orchestration layer that manages task lifecycle, state transitions, and telemetry.

The system implements a **multi-level AI factory model**:

- **Level 2 (skill):** Language- or tool-specific knowledge capsule. Contains a prompt describing how to write code in a specific language, a **toolClass** registry mapping roles (formatter, linter, testFramework, build) to named tools, and file-level hooks that validate output. A skill is agnostic to any task — it only answers: "how do you write X?"
- **Level 3 (task agent):** A **parameterized, task-focused agent** that accepts a **unit of work (UoW)** with pre-populated `taskState` and executes one discrete workflow (e.g., BDD Red phase). It is language-agnostic by design — language, framework, and style arrive via `taskState` at dispatch time.
- **Level 4 (orchestrator program):** Built using the orchestrator framework. Validates that the incoming UoW `taskState` satisfies the target agent's parameter schema, then dispatches the agent. The orchestrator does NOT derive or populate `taskState` values — that is the responsibility of whoever produced the UoW (a human, a CI system, another UoW agent, etc.).
- **Level 5 (meta-agent):** Can augment or modify skill and agent definitions (e.g., add timing hooks, update prompts after evals).

**Key Terms:**

- **Rune**: A unit of work (task) to be executed by an agent, containing title, description, tags, and metadata
- **Agent**: An AI worker with specific capabilities (model, tools, prompt) that executes runes
- **AGENT.md**: Markdown file with YAML frontmatter that fully describes a Level 3 agent's contract
- **taskState**: Free-form object containing all context for a single task execution, including language, framework, and cross-hook state
- **Task Source**: Plugin that discovers, claims, and fulfills runes from an external system (e.g., Bifrost API)
- **Engine**: Plugin that executes runes using a specific mechanism (e.g., Claude Code CLI)
- **Task State Store**: Plugin that persists and retrieves taskState across hook executions
- **Hook**: Shell command or Node.js script executed before (RuneStart) or after (RuneStop) agent execution
- **repo script**: Hook script that belongs to a specific working repository, installed to `.ai/<agent>/hooks/`
- **repoConfig**: YAML file committed to working repository declaring languages and tools
- **toolClass**: Role identifier (formatter, linter, testFramework, build) for tool resolution
- **Claimant**: Identifier for the agent instance currently working on a rune
- **projectDir**: Git root of the working repository, resolved automatically
- **Orchestration**: The process of coordinating hooks, engine execution, and follow-up loops
- **Follow-up**: Additional agent execution triggered by RuneStop hooks to address issues
- **Handlebars**: Template syntax used in AGENT.md prompt bodies for taskState substitution

### Problem

Sarah is a platform engineer managing a monorepo with 50+ services. Her team has implemented AI agents to help with routine maintenance tasks (dependency updates, code refactors, security patches). Each agent works great in isolation, but Sarah has five critical problems:

1. **No coordination**: Multiple agent instances compete for the same tasks, causing duplicate work
2. **No observability**: When an agent fails, there's no telemetry—did it timeout? run out of tokens? hit a bug?
3. **No integration**: Agents can't validate work with project-specific checks (running tests, linters) before marking tasks complete
4. **Tight coupling**: Agents hard-code language and framework details. When the team adds a C# service, Sarah must maintain separate C# agents
5. **No state sharing**: Hooks can't pass data to each other—snapshot-tests captures file hashes but check-new-tests can't read them

Marcus, a senior engineer on Sarah's team, wants to automate the BDD Red phase across the polyglot monorepo. He writes a BDD-Red agent prompt that hard-codes Python and pytest — but three weeks later the team adds a C# service. Marcus must now maintain two nearly identical agents. When a teammate writes a BDD-Green agent, they hard-code it for TypeScript/Vitest. The agents are not composable: changing the test framework means editing every agent. Hooks that enforce correctness are written as ad-hoc shell scripts with no documented contract, so no one knows which exit code means what.

Sarah spends hours manually deconflicting agents, digging through logs to understand failures, and manually validating work before merging. She can't scale her automation beyond a few agents without creating more work than she saves.

### Goal

With Bifrost Orchestrator, Sarah deploys a single orchestrator instance per project. She configures a **Task Source** that connects to her Bifrost API server, and an **Engine** that uses Claude Code CLI. When a rune is ready, the orchestrator:

1. Claims the rune (preventing duplicate work)
2. Runs **RuneStart hooks** (project-specific validation, prompt augmentation)
3. Executes the rune with the appropriate agent (model, tools, prompt from agent catalog)
4. Runs **RuneStop hooks** (test suites, linters, custom checks)
5. If hooks report issues, triggers a **follow-up** loop to address them
6. Marks the rune complete with full telemetry (tokens used, duration, cost)

Marcus defines one BDD-Red agent. Its AGENT.md declares the `taskState` fields it requires: `language`, `testFramework`, and `testStyle`. Whatever process creates the UoW — a human, a CI trigger, or another agent — fills those fields before handing it to the orchestrator. The orchestrator validates the schema and dispatches. The same BDD-Red agent handles the C# service when a UoW arrives with C# / XUnit / Gherkin in taskState. Hooks are declared in the AGENT.md with a defined stdin schema and exit code contract. Repo scripts are automatically installed to the working repository's `.ai/` directory on first run. Hooks communicate via taskState, so snapshot-tests writes file hashes that check-new-tests reads.

Sarah now has reliable, scalable, composable automation. She can deploy multiple agents knowing the orchestrator will coordinate them. She has full visibility into execution. She trusts the automation because hooks validate work before completion. Marcus's team ships BDD Red across every language without touching the agent definition.

---

## User Stories / Use Cases

### US-1: Define a task agent with AGENT.md

**As an** agent operator  
**I want** to write an AGENT.md with a documented parameter schema, allowed tools, hook lifecycle specs, and a Handlebars prompt body  
**So that** task agents are composable and language-agnostic

**Acceptance Criteria:**

```
Given an AGENT.md file with valid YAML frontmatter
  And a prompt body containing Handlebars tokens matching declared template parameters
When an orchestrator program reads the file
Then the agent name, description, tools, toolClasses, template parameter schema, and prompt body are all accessible as structured data
```

```
Given an AGENT.md missing a required frontmatter field (name, description, or tools)
When an orchestrator program reads the file
Then parsing fails with a descriptive error naming the missing field
  And the agent is not dispatched
```

```
Given an AGENT.md template.parameters section where a field name ends with ?
When the parameter schema is parsed
Then that field is marked optional
  And the Handlebars renderer does not error if that field is absent from taskState
  And an absent optional field renders as empty string
```

```
Given a template parameter declared as optional (name ends with ?)
  And that parameter is an object with one or more sub-fields whose names do not end with ?
When taskState provides that optional parameter
Then all non-? sub-fields of that object must be present and non-empty
  And validation fails naming any absent required sub-field by its dot-notation path
When taskState omits the optional parameter entirely
Then no validation error is raised for that parameter or any of its sub-fields
```

```
Given a prompt body referencing a Handlebars token not declared in template.parameters
When the AGENT.md is parsed
Then parsing fails identifying the undeclared token by name
```

### US-2: Agent Operator - Run Agent on Claimed Rune

**As an** agent operator  
**I want** to claim a rune and execute it with the appropriate agent  
**So that** work is completed without duplicate execution

**Acceptance Criteria:**

```
Given a rune is available with status "open"
  And the rune has a "worker:reviewer" tag
  And the reviewer agent is configured in the agent catalog
  And no other claimant is set on the rune
When the orchestrator polls the task source
Then the rune is claimed with the current claimant identifier
  And RuneStart hooks are executed in sequence
  And the reviewer agent is invoked with the rune context
  And RuneStop hooks are executed in sequence
  And the rune is marked complete
  And execution telemetry is recorded
```

```
Given a rune is already claimed by another process
When the orchestrator polls the task source
Then the rune is skipped
  And no execution occurs
```

```
Given a rune has no worker tag (no "worker:*" in tags)
When the dispatcher receives the rune
Then an empty command is emitted
  And the rune is not claimed
```

### US-3: Project Maintainer - Extend Agent with Hooks

**As a** project maintainer  
**I want** to attach shell commands to agent lifecycle events  
**So that** agents can validate work and augment prompts

**Acceptance Criteria:**

```
Given an agent has RuneStart hooks configured
And a hook command is configured as "npm run check-deps"
When the orchestrator executes the agent
Then the hook is executed with rune context as JSON stdin
And the hook environment includes CLAUDE_PROJECT_DIR
And hook exit code 0 results in continuation
And hook exit code -2 skips agent execution
And hook exit code > 0 aborts with failure
And hook stdout is appended to the system prompt
```

```
Given an agent has RuneStop hooks configured
And a hook command is configured as "pytest"
When the orchestrator completes agent execution
Then the hook is executed with rune context and last agent message
And hook exit code 0 results in SUCCESS outcome
And hook exit code -2 results in SKIP_FULFILL outcome
And hook exit code 1 results in FOLLOW_UP outcome with hook output as message
And hook exit code 2 results in BLOCKING_FAILURE outcome
```

```
Given multiple RuneStop hooks are configured
And the first hook succeeds (exit 0)
And the second hook returns FOLLOW_UP (exit 1)
When the orchestrator evaluates hook results
Then execution continues to the follow-up loop
And subsequent hooks are not executed
```

### US-4: First run installs repo scripts into the working repository

**As a** developer running `bf orchestrate` against a working repository for the first time  
**I want** repo scripts for all built-in agents to be automatically hard-copied into the working repository and staged for commit  
**So that** working repositories are ready for agent dispatch without manual file management

**Acceptance Criteria:**

```
Given an orchestrator program with one or more built-in agents that have repo scripts
  And a working repository that has not previously been initialized by this orchestrator
When bf orchestrate runs against the working repository for the first time
Then each repo script is hard-copied to .ai/<agent-name>/hooks/<lifecycle>.d/<hook-name>.mjs
  And no symlinks are created
  And the orchestrator logs each installed path
```

```
Given a working repository that has already been initialized
  And a repo script already exists at the expected path
When bf orchestrate runs again
Then the existing script is not overwritten
  And the orchestrator logs that the script is already present
```

```
Given repo scripts installed by bf orchestrate
When a developer runs git status in the working repository
Then the installed .mjs files appear as new untracked files
  And no other files in the working repository are modified by the install step
```

### US-5: Dispatch an agent with a pre-populated unit of work

**As a** Level 4 orchestrator program  
**I want** to validate an incoming UoW's `taskState` against the target agent's parameter schema and dispatch only when all required fields are satisfied  
**So that** the orchestrator remains a thin validation and dispatch layer

**Acceptance Criteria:**

```
Given a Level 3 agent with a declared template.parameters schema
  And a UoW whose taskState satisfies all required parameters recursively
When the orchestrator program dispatches
Then the rendered prompt is injected into the agent's context
  And the agent begins work
```

```
Given a UoW whose taskState is missing a required parameter
When the orchestrator program attempts dispatch
Then the Start hook validate-args exits with code 2
  And the agent does not execute any prompt
  And the error identifies the missing field by its dot-notation path
```

```
Given a template parameter that is an optional object (name ends with ?)
  And the UoW taskState provides that object
  And the object is missing a required sub-field (sub-field name does not end with ?)
When validate-args runs
Then validation fails identifying the missing sub-field by its dot-notation path
```

```
Given a UoW taskState where a required field is present but set to empty string
When validate-args runs
Then validation fails as if the field were absent
```

```
Given a UoW with an incomplete taskState
When the orchestrator program receives it
Then the orchestrator does not read repoConfig, inspect the workspace, or call any external service to fill in missing values
  And it fails validation and returns the error to the caller
```

### US-6: Platform Engineer - Observe Agent Execution

**As a** platform engineer  
**I want** to collect telemetry from agent executions  
**So that** I can debug failures and optimize costs

**Acceptance Criteria:**

```
Given an agent executes successfully
When the orchestration completes
Then execution telemetry includes: duration_ms, input_tokens, output_tokens
And telemetry includes: cache_read_tokens, cache_creation_tokens
And telemetry includes: total_cost_usd, num_turns
And telemetry is appended as a completion note on the rune
```

```
Given an agent executes with follow-up
When multiple engine executions occur
Then telemetry is accumulated across all executions
And cumulative telemetry is reported on completion
```

### US-7: System Administrator - Configure Multiple Sources and Engines

**As a** system administrator  
**I want** to configure task sources, engines, and task state stores via YAML  
**So that** the orchestrator works with different backends

**Acceptance Criteria:**

```
Given a .bifrost.yaml configuration file
And orchestrate.task_source.type is "bifrost"
And orchestrate.task_source.settings.base_url is "https://api.example.com"
And orchestrate.task_source.settings.poll_interval is 30
When the orchestrator loads configuration
Then a BifrostTaskSource is created with the specified base_url
And the task source polls every 30 seconds
```

```
Given a .bifrost.yaml configuration file
And orchestrate.engine.type is "claude-code"
And orchestrate.engine.settings.claude_dir is "/custom/.claude"
When the orchestrator loads configuration
Then a ClaudeCodeEngine is created with the specified claude_dir
```

```
Given a .bifrost.yaml configuration file
And orchestrate.task_state_store.type is "redis"
And orchestrate.task_state_store.settings.url is "redis://localhost:6379"
When the orchestrator loads configuration
Then a RedisTaskStateStore is created with the specified URL
```

```
Given an unknown task source type is configured
When the orchestrator attempts to create the task source
Then a ValueError is raised with message "Unknown task source type: {type}"
```

### US-8: Developer - List Available Agents

**As a** developer  
**I want** to list all configured agents and their capabilities  
**So that** I can choose the right agent for a task

**Acceptance Criteria:**

```
Given the agent catalog contains agents
And agent "reviewer" has description, model, tools, and hooks
When the dispatcher is invoked with --list-agents
Then each agent name is printed
And agent description is printed if present
And agent model is printed if present
And agent tools are printed as comma-separated list if present
And rune_start_hooks are printed as comma-separated list if present
And rune_stop_hooks are printed as comma-separated list if present
```

```
Given the agent catalog is empty
When the dispatcher is invoked with --list-agents
Then "No agents found." is printed to stderr
```

### US-9: projectDir resolved from git root of CWD

**As a** developer running `bf orchestrate` from within a working repository  
**I want** the orchestrator program to automatically resolve the working repository root by walking up from the current working directory  
**So that** running the orchestrator requires no path arguments and works from any subdirectory

**Acceptance Criteria:**

```
Given a developer runs bf orchestrate from a directory inside a git repository
When the orchestrator program starts
Then projectDir is set to the git root of the directory bf orchestrate was invoked from
  And no --projectDir argument is required
```

```
Given a developer runs bf orchestrate from a directory that is not inside any git repository
When the orchestrator program starts
Then it exits with a descriptive error stating that no git root could be found
  And no agent dispatch occurs
```

```
Given a git repository rooted at /home/user/myrepo
  And a developer runs bf orchestrate from /home/user/myrepo/src/lib
When the orchestrator program starts
Then projectDir is /home/user/myrepo
```

### US-10: Task State persistence across hook executions

**As a** hook author  
**I want** hooks to read and write taskState that persists across hook executions  
**So that** hooks can coordinate their behavior without side effects

**Acceptance Criteria:**

```
Given a Start hook that writes taskState.snapshotTests = { "test.js": "hash123" }
When the Start hook completes
Then the Task State Store persists the updated taskState
And the Stop hook can read taskState.snapshotTests in a subsequent execution
```

```
Given a taskState that was previously persisted
When a new hook execution begins
Then the Task State Store loads the persisted taskState
And the hook receives the updated taskState via stdin
```

```
Given the Task State Store is unavailable
When a hook attempts to read or write taskState
Then the hook execution fails with a descriptive error
And the orchestrator logs the failure
And the rune is marked as failed
```

---

## Functional Requirements

### FR-1: Task Source Interface

The system MUST implement the `TaskSource` interface with the following methods:

- `async watch_tasks() -> AsyncIterator[Task]`: Continuously poll for available tasks
- `async get_task_detail(task_id: str) -> TaskDetail`: Retrieve full task details
- `async claim_task(task_id: str, claimant: str) -> bool`: Claim exclusive ownership
- `async unclaim_task(task_id: str) -> bool`: Release ownership
- `async complete_task(task_id: str) -> bool`: Mark task as fulfilled

Task Status enum values:
- `OPEN`: Task is available for claiming
- `IN_PROGRESS`: Task is claimed and being executed
- `COMPLETED`: Task is fulfilled
- `FAILED`: Task execution failed
- `CANCELLED`: Task was cancelled

### FR-2: Engine Interface

The system MUST implement the `Engine` interface with the following methods:

- `async execute(context: EngineContext, task_data: dict) -> EngineResult`: Execute a task
- `async send_follow_up(message: str) -> EngineResult`: Optional method for follow-up execution

EngineContext MUST contain:
- `task_id: str`: Unique task identifier
- `working_dir: str`: Project directory for execution
- `agent_name: str`: Name of the agent to use
- `verbose: bool`: Enable verbose logging

EngineResult MUST contain:
- `success: bool`: Whether execution succeeded
- `skip_fulfill: bool`: Whether to skip marking the task complete
- `last_message: str | None`: Final message from the agent
- `stats: ExecutionStats | None`: Telemetry data

ExecutionStats MUST contain:
- `duration_ms: int`: Execution duration in milliseconds
- `input_tokens: int`: Input tokens consumed
- `output_tokens: int`: Output tokens consumed
- `cache_read_tokens: int`: Cache read tokens
- `cache_creation_tokens: int`: Cache creation tokens
- `total_cost_usd: float`: Total cost in USD
- `num_turns: int`: Number of conversation turns

### FR-3: Task State Store Interface

The system MUST implement the `TaskStateStore` interface with the following methods:

- `async load_task_state(task_id: str) -> dict | None`: Load taskState for a task
- `async save_task_state(task_id: str, task_state: dict) -> bool`: Persist taskState for a task
- `async delete_task_state(task_id: str) -> bool`: Delete taskState for a task
- `async initialize_task_state(task_id: str, initial_state: dict) -> bool`: Initialize taskState for a new task

TaskStateStore implementations MUST be thread-safe and support concurrent access.

### FR-4: Agent Definition File (AGENT.md)

Format: Markdown file with YAML frontmatter delimited by `---`. The prompt body follows the closing `---`.

Required frontmatter fields:

| Field | Type | Description |
|---|---|---|
| `name` | string | Unique agent identifier (kebab-case) |
| `description` | string | One-line description used for orchestrator routing |
| `tools` | string[] | Explicit allowlist of Claude Code tools this agent may use |
| `toolClasses` | string[] | Optional. Tool role types this agent requires. Informational — documents what must be available. |
| `template.parameters` | object | Free-form YAML shape declaring the taskState structure this agent expects |

The `tools` list is a strict allowlist enforced by the harness. Bash is not implicitly permitted. Any tool not listed is denied regardless of what the prompt requests.

### FR-5: template.parameters Schema Rules

`template.parameters` is a free-form YAML object of any shape. The following conventions govern optionality:

- A field whose key ends with `?` is **optional**. It may be absent from `taskState` without causing a validation error. When absent, its Handlebars token renders as empty string.
- A field whose key does not end with `?` is **required**. It must be present and non-empty in `taskState`.
- Rules apply recursively: if an optional object is provided, all of its non-`?`-suffixed sub-fields are required. If an optional object is absent, none of its sub-fields are evaluated.
- Scalar values (e.g., `string`) are type hints only and are not enforced at runtime.
- Prompt authors use `{{#if paramName}}...{{/if}}` to guard sections that depend on optional parameters.

Example:
```yaml
template:
  parameters:
    language:
      name: string
      prompt: string
    testFramework:
      name: string
      prompt: string
    testStyle:
      name: string
      prompt: string
    userPrompt: string
    context?:
      prDescription: string
      additionalNotes?: string
```

In this example: `language`, `testFramework`, `testStyle`, and `userPrompt` are required. `context` is optional; if provided, `context.prDescription` is required and `context.additionalNotes` is optional.

Handlebars tokens in the prompt body must match declared parameter paths exactly. Unknown tokens are a parse-time error.

### FR-6: projectDir Resolution

`projectDir` is not passed as a CLI argument. When `bf orchestrate` is invoked, the orchestrator program walks up from the current working directory to find the nearest ancestor directory containing a `.git` folder. That directory becomes `projectDir` for the duration of the run. If no git root is found, the program exits with a fatal error.

### FR-7: Orchestrator Framework and Orchestrator Program

The **orchestrator framework** is a Python/Node.js hybrid monorepo supporting both runtime environments:

```
orchestrator-framework/
  package.json              # Python: pyproject.toml with workspaces
  node_modules/             # shared, hoisted
  packages/
    bdd-red -> /path/to/bdd-red    # symlink
    bdd-green -> /path/to/bdd-green
```

An **orchestrator program** is built on this framework and embeds a chosen set of agents. When `bf orchestrate` runs against a working repository for the first time, it performs a one-time install of all built-in repo scripts before any dispatch occurs.

### FR-8: Working Repository Layout (after install)

```
<working-repo>/
  repoConfig.yaml
  .ai/
    <agent-name>/
      hooks/
        Start.d/
          <hook-name>.mjs     # hard-copied, committed
        Stop.d/
          <hook-name>.mjs
```

Repo scripts are hard-copied (never symlinked) and committed. The orchestrator program imports them via dynamic `import()` using the absolute path resolved from `projectDir + "/.ai/<agent-name>/hooks/..."`. Their dependencies are declared in the orchestrator program's `package.json` and resolved from its `node_modules`.

### FR-9: Agent Package Layout

```
<agent-dir>/
  AGENT.md
  package.json
  hooks/
    Start.d/
      <hook-name>.mjs        # provided script
      <hook-name>.md         # Gherkin acceptance spec
    Stop.d/
      <hook-name>.mjs
      <hook-name>.md
```

Hook execution order within each `.d/` directory: alphabetical by filename.

### FR-10: Hook Contract

**stdin (JSON):**
```json
{
  "projectDir": "string",
  "params": {},
  "taskState": {}
}
```

The rendered agent prompt is NOT included. Cross-hook state is communicated via `taskState` mutations passed through to subsequent hooks.

**Exit codes:**

| Code | Meaning | Effect |
|---|---|---|
| 0 | Success | Proceed |
| 1 | Recoverable error | Hook stdout passed to agent as context; execution continues |
| 2 | Fatal error | Agent halts; error surfaced to orchestrator caller |

**Script format:** `.mjs` (ES module) or executable shell script. Executed in the orchestrator program's runtime context via dynamic `import()` or subprocess execution.

### FR-11: Built-in Hook Specs

| Hook | Lifecycle | Type | Purpose |
|---|---|---|---|
| `validate-args` | Start | framework | Assert all required taskState fields are non-empty per declared schema |
| `snapshot-tests` | Start | framework | Hash existing test files into taskState |
| `check-new-tests` | Stop | framework | Assert at least one new test was added since snapshot |
| `lint` | Stop | repo script | Run project linter (resolved from repoConfig `linter` toolClass) |
| `format` | Stop | repo script | Run project formatter (resolved from repoConfig `formatter` toolClass) |

Framework hooks run from the orchestrator's `packages/` context. Repo scripts are loaded from the working repository's `.ai/` directory via dynamic `import()`.

### FR-12: repoConfig.yaml

```yaml
languages:
  - name: string          # e.g., "csharp", "node"
    version: string       # semver range
    tools:
      - toolClass: string # "formatter" | "linter" | "testFramework" | "build"
        name: string
        version: string   # optional
```

When multiple tools share the same `toolClass` within one language entry, the first entry wins and a warning is emitted identifying the language name, the conflicting toolClass, and the line numbers of both entries.

### FR-13: Configuration

Configuration file `.bifrost.yaml` MUST support:

```yaml
orchestrate:
  task_source:
    type: bifrost
    settings:
      base_url: string
      timeout: int (seconds)
      poll_interval: int (seconds)
  
  engine:
    type: claude-code
    settings:
      claude_dir: path
      verbose: bool
  
  task_state_store:
    type: redis | memory | file
    settings:
      # type-specific settings
  
  concurrency: int
  claimant: string | null
  dispatcher: path
  logging: normal | verbose
```

### FR-14: Dispatcher Protocol

Dispatcher MUST read `DispatchInput` from stdin:
```json
{
  "rune": { "id": "...", "title": "...", "tags": ["worker:..."], ... },
  "cwd": "/path/to/project"
}
```

Dispatcher MUST write `DispatchResult` to stdout:
```json
{
  "command": "uv",
  "args": ["run", "--directory", "...", "agent.py", "agent-name"],
  "stdin": "{...}",
  "env": {}
}
```

Empty command string indicates skip (unclaim).

### FR-15: Orchestration Lifecycle

The orchestrator MUST execute the following sequence:

1. Load agent definition from AGENT.md based on `worker:*` tag
2. Load/initialize taskState from Task State Store
3. Execute Start hooks with taskState
4. If hook error: abort with failure
5. If hook skip: exit success without engine execution
6. Validate taskState against template.parameters
7. Render Handlebars prompt with taskState values
8. Build EngineContext and task_data
9. Execute engine
10. Execute Stop hooks
11. If blocking failure: abort with failure
12. If follow-up: loop back to step 9 with follow-up message
13. Save final taskState to Task State Store
14. Append completion note with telemetry
15. Return OrchestrationResult

### FR-16: Level Hierarchy Constraints

- Level 2 skills do not know about Level 3 task workflows.
- Level 3 task agents do not know about Level 4 orchestrators and do not read repoConfig directly.
- Level 3 agents MUST NOT embed language names, framework names, or version numbers directly in their prompt bodies.
- Level 4 orchestrator programs validate UoW `taskState` but do NOT derive or populate parameter values.
- The `tools` allowlist is enforced by the runtime harness, not the prompt.
- Task State Store provides the interface for persisting taskState without coupling to any specific backend.

---

## Non-Functional Requirements

### NFR-1: Performance

- Task source polling interval MUST be configurable (default 10 seconds)
- API request timeout MUST be configurable (default 30 seconds)
- Hook execution MUST complete within 5 minutes or be terminated
- Engine execution has no hardcoded timeout (managed by engine)
- Task State Store operations MUST complete within 100ms for local stores, 500ms for remote stores
- AGENT.md parsing completes in under 100ms for files under 10KB

### NFR-2: Reliability

- The orchestrator MUST gracefully handle task source unavailability
- The orchestrator MUST log all hook failures without crashing
- The orchestrator MUST remove claimed runes from seen set on unclaim
- The orchestrator MUST survive process restart and resume polling
- Task State Store MUST be thread-safe and support concurrent access
- Task State persistence failures MUST be logged and cause task failure

### NFR-3: Monitoring and Observability

- All task source operations MUST be logged with task ID
- All hook executions MUST be logged with command and exit code
- Engine execution MUST log telemetry on completion
- Task State Store operations MUST be logged with task ID
- Log levels MUST be configurable (normal, verbose)
- Structured JSON log entries for: git root resolution, agent load, taskState validation result, hook start, hook exit (with exit code and duration), agent dispatch

### NFR-4: Concurrency

- The orchestrator MUST support configurable worker concurrency
- Each worker MUST maintain independent seen sets
- Claim operations MUST be atomic (handled by task source)
- Task State Store MUST support concurrent reads and writes to the same task_id

### NFR-5: Error Handling

- Invalid JSON on stdin MUST result in exit code 1
- Unknown agent name MUST result in exit code 1
- Agent without model MUST result in error and exit code 1
- Task source unavailability MUST be logged and retried
- Hook execution exceptions MUST be caught, logged, and skipped
- Task State Store unavailability MUST cause task failure with descriptive error
- Every validation failure, hook exit-2, and parse error must name the specific field or file path that caused the failure, using dot-notation for nested fields

### NFR-6: Install Idempotency

- Running `bf orchestrate` multiple times against the same working repository produces the same result
- Already-present repo scripts are not overwritten
- No errors are raised for already-installed scripts
- Task State Store initialization is idempotent

### NFR-7: Reproducibility

- Given the same AGENT.md, the same `taskState`, and the same `projectDir`, two dispatches produce identical rendered prompts
- Handlebars rendering is deterministic and side-effect free

### NFR-8: Security

- The `tools` allowlist is enforced by the runtime harness
- A prompt that instructs the agent to use an unlisted tool is rejected before execution
- Repo scripts are executed with the same permissions as the orchestrator
- Task State Store does not execute code from stored taskState values

---

## Data & Storage

### Commands

**ClaimRune**
- `rune_id: str`
- `claimant: str`
- Occurs when: Worker claims a task for execution

**UnclaimRune**
- `rune_id: str`
- Occurs when: Worker releases a task (error, skip, or manual)

**FulfillRune**
- `rune_id: str`
- Occurs when: Worker completes a task successfully

**AppendCompletionNote**
- `rune_id: str`
- `note: str` (JSON serialized ExecutionStats)
- Occurs when: Worker completes execution with telemetry

**InitializeTaskState**
- `task_id: str`
- `initial_state: dict`
- Occurs when: Task is claimed for the first time

**UpdateTaskState**
- `task_id: str`
- `updates: dict`
- Occurs when: Hook modifies taskState

**LoadTaskState**
- `task_id: str`
- Occurs when: Hook needs to read current taskState

**DispatchAgent**
- `agentName: str`, `projectDir: str`, `uow: UnitOfWork`, `dispatchedAt: ISO8601`
- Occurs when: Orchestrator dispatches an agent

**RunHook**
- `agentName: str`, `hookName: str`, `lifecycle: "Start" | "Stop"`, `projectDir: str`
- Occurs when: Hook is executed

**InstallRepoScripts**
- `orchestratorName: str`, `projectDir: str`, `installedAt: ISO8601`
- Occurs when: Repo scripts are installed to working repository

### Events

**RuneClaimed**
- `rune_id: str`
- `claimant: str`
- `timestamp: datetime`

**RuneUnclaimed**
- `rune_id: str`
- `previous_claimant: str`
- `reason: str` (error, skip, manual)
- `timestamp: datetime`

**RuneFulfilled**
- `rune_id: str`
- `claimant: str`
- `telemetry: ExecutionStats`
- `timestamp: datetime`

**RuneExecutionFailed**
- `rune_id: str`
- `claimant: str`
- `error: str`
- `timestamp: datetime`

**AgentDispatched**
- `agentName: str`, `taskStateSnapshot: Record<string, unknown>`, `renderedPromptHash: str`, `dispatchedAt: ISO8601`

**HookExecuted**
- `agentName: str`, `hookName: str`, `lifecycle: "Start" | "Stop"`, `exitCode: 0 | 1 | 2`, `stdout: str`, `durationMs: number`, `executedAt: ISO8601`

**AgentHalted**
- `agentName: str`, `reason: str`, `haltedAt: ISO8601`

**TaskStateValidationFailed**
- `agentName: str`, `missingFields: string[]`, `failedAt: ISO8601`

**RepoScriptInstalled**
- `agentName: str`, `hookName: str`, `targetPath: str`, `installedAt: ISO8601`

**RepoScriptAlreadyPresent**
- `agentName: str`, `hookName: str`, `targetPath: str`, `checkedAt: ISO8601`

**TaskStateUpdated**
- `task_id: str`, `updated_fields: string[]`, `updated_at: datetime`

**TaskStateInitialized**
- `task_id: str`, `initial_state: dict`, `initialized_at: datetime`

### Aggregates

**Rune**
- `id: str`
- `title: str`
- `description: str | None`
- `status: TaskStatus`
- `tags: list[str]`
- `claimant: str | None`
- `created_at: datetime | None`
- `updated_at: datetime | None`
- `priority: int`

**RuneDetail**
- Extends Rune
- `dependencies: list[DependencyRef]`
- `notes: list[NoteEntry]`
- `acceptance_criteria: list[ACEntry]`
- `retro: list[RetroEntry]`

**AgentExecution**
- `rune_id: str`
- `agent_name: str`
- `claimant: str`
- `started_at: datetime`
- `completed_at: datetime | None`
- `telemetry: ExecutionStats | None`
- `verdict: OrchestrationResult`

**AgentDefinition**
```typescript
type AgentDefinition = {
  name: string
  description: string
  tools: string[]
  toolClasses: string[]
  template: {
    parameters: Record<string, unknown>  // free-form; validated recursively at dispatch
  }
  hooks: {
    Start: HookSpec[]
    Stop: HookSpec[]
  }
  promptBody: string
}
```

**HookSpec**
```typescript
type HookSpec = {
  name: string
  scriptPath: string      // relative to agent dir
  specPath: string        // path to .md Gherkin spec
  isRepoScript: boolean   // true = installed to working repo; false = runs from framework packages
}
```

**RepoConfig**
```typescript
type RepoConfig = {
  languages: Array<{
    name: string
    version: string
    tools: Array<{
      toolClass: "formatter" | "linter" | "testFramework" | "build"
      name: string
      version?: string
    }>
  }>
}
```

**UnitOfWork**
```typescript
type UnitOfWork = {
  id: string
  agentName: string
  projectDir: string
  taskState: Record<string, unknown>
  createdAt: string
  dispatchedAt: string | null
}
```

**DispatchRecord**
```typescript
type DispatchRecord = {
  uowId: string
  agentName: string
  projectDir: string
  taskStateSnapshot: Record<string, unknown>
  renderedPromptHash: string
  hookResults: Array<{
    hookName: string
    lifecycle: "Start" | "Stop"
    exitCode: number
    durationMs: number
  }>
  outcome: "completed" | "halted"
  dispatchedAt: string
  completedAt: string | null
}
```

### Query Projections

**ReadyRunesQuery**
- Question: Which runes are available for claiming?
- Projection: `Rune` where `status == OPEN` AND `claimant == None`
- Used by: Task source polling

**RuneDetailQuery**
- Question: What is the full context for a specific rune?
- Projection: `RuneDetail` by `rune_id`
- Used by: Agent execution

**AgentExecutionHistoryQuery**
- Question: What executions have occurred for a rune?
- Projection: List of `AgentExecution` by `rune_id` ordered by `started_at`
- Used by: Debugging and audit

**ClaimantActiveTasksQuery**
- Question: What tasks is a claimant currently working on?
- Projection: List of `Rune` where `claimant == X` AND `status == IN_PROGRESS`
- Used by: Status monitoring

**AgentSchemaView**
- Question: What taskState shape, tools, and hook contracts does a named agent declare?
- Projection: `AgentDefinition` by `agentName`
- Used by: Dispatcher, validation

**UoWReadinessView**
- Question: Does a given UoW's taskState satisfy the target agent's parameter schema?
- Projection: Boolean result of schema validation
- Used by: Pre-dispatch validation

**HookHealthView**
- Question: Which hooks have failed (exit code ≥ 1) for a given agent in the last N dispatches?
- Projection: List of `HookExecuted` events filtered by failure
- Used by: Health monitoring

**RepoScriptInstallStatusView**
- Question: Which repo scripts have been installed to a given working repository, and which are missing?
- Projection: Set of installed script paths vs required script paths
- Used by: Install validation

**TaskStateView**
- Question: What is the current taskState for a given task?
- Projection: `taskState` dict by `task_id`
- Used by: Hook execution, follow-up loops

### Data Retention

- Rune events MUST be retained indefinitely (event sourcing)
- Rune aggregate MUST be rebuildable from event stream
- Completed runes MUST NOT be deleted from task source
- Agent execution history MUST be appended to rune as notes
- `DispatchRecord` and associated events: 90 days, then archived or deleted
- `AgentDefinition` snapshot captured at dispatch time: retained with its `DispatchRecord` for the same 90-day window
- `package.json` hash records: retained indefinitely (required for install-skip optimization)
- TaskState MUST be retained until task is completed and archived, then purged according to retention policy

---

## Out of Scope

- Multi-machine orchestration (single host only in v1)
- Dynamic agent registration (agents must be pre-configured in catalog)
- Real-time task streaming (polling only, no websockets)
- Task prioritization within the orchestrator (priority is metadata only)
- Automatic retry on failure (manual retry only)
- Task dependencies (dependencies are metadata only)
- Distributed locking across multiple orchestrator instances
- Custom scheduling algorithms (FIFO polling only)
- Agent sandboxing (agents run with same permissions as orchestrator)
- Web UI or API for orchestration management
- Level 5 meta-agent behavior: Automated prompt improvement, token-usage instrumentation, and eval-driven skill updates are out of scope. The schema must not prevent these being added later.
- Non-Node/Python hook runtimes in v1: Python, Bash, and Rust hooks are out of scope. The exit-code contract is language-agnostic and could support other runtimes in a future version.
- Agent-to-agent calls within a Level 3 task: Level 3 agents execute a single task. Inter-agent calls within a prompt belong to Level 4.
- GUI or web interface for agent authoring: Authoring is file-based (markdown + YAML).
- Agent definition versioning: Semantic versioning of AGENT.md files and compatibility guarantees between versions are out of scope for v1.
- Multi-language dispatch in a single agent invocation: Each dispatch targets one language at a time. Polyglot support comes from separate dispatches.
- Automated Gherkin test execution for hook specs: The `.md` Gherkin spec files are documentation and acceptance criteria only. They are not automatically parsed and run. Provided hook scripts ship with unit tests; teams writing replacement implementations test against the spec on their own.
- Scalar type enforcement in template.parameters: The type hints (e.g., `string`) in `template.parameters` values document intent but are not enforced at runtime in v1. Validation only checks presence and non-emptiness of required fields.
- Orchestrator responsibility for taskState derivation: The orchestrator validates; it does not populate. Whatever produces the UoW — human, CI, or another agent — is responsible for all `taskState` values.
- Dependency conflict isolation between agents via separate node_modules trees: npm workspace hoisting is the conflict resolution mechanism. Per-agent isolation via Docker or separate processes is out of scope for v1.
- Repo script upgrade path: When a newer version of the orchestrator program ships an updated repo script, there is no automated mechanism to update already-installed copies in working repositories. Teams update repo scripts manually. A future version may introduce a hash-comparison check with an explicit overwrite command.
- Malicious agent package supply chain: A compromised agent package could declare arbitrary dependencies installed into the shared orchestrator `node_modules`. The v1 mitigation is developer discipline — always review agent definitions and `package.json` before installing.

---

## Dependencies and Assumptions

### Dependencies

| Dependency | Purpose |
|---|---|
| `repoConfig.yaml` (working repo) | Toolchain declarations; read by processes that produce UoW taskState |
| Claude Code harness | Runtime enforcement of the `tools` allowlist |
| Python 3.12+ | Python runtime for orchestrator core |
| Node.js ≥24 | Node.js runtime for hook script execution |
| git | Working repository root resolution (`projectDir` detection) |
| npm workspaces | Agent dependency resolution and workspace test orchestration |
| uv | Python package manager and script executor |
| vitest (agent-level devDependency) | Running provided hook unit tests |
| Handlebars (or equivalent) | Prompt template rendering at dispatch time |
| Task State Store backend (Redis, filesystem, in-memory) | taskState persistence across hook executions |

### Assumptions

1. The Claude Code harness enforces the `tools` allowlist at the runtime level. An agent cannot bypass it via prompt instructions.
2. `repoConfig.yaml` is committed to the working repository and readable by any process that needs it.
3. Node.js ≥24 is available in the orchestrator program's execution environment for .mjs hooks.
4. Python 3.12+ is available in the orchestrator program's execution environment for core orchestration.
5. All hook scripts (framework and repo) are ES modules (`.mjs`) or executable shell scripts. CommonJS is not supported.
6. The orchestrator framework is an npm workspace monorepo. `npm install` at the root resolves all agent hook dependencies.
7. `taskState` fields of type `prompt` carry the full text of a skill prompt section as a string value. The UoW producer is responsible for loading skill content and writing it as a string — not a file path.
8. A Level 3 agent is stateless between dispatches. Per-dispatch state lives in `taskState` and is threaded through hook stdin.
9. `validate-args` is the first Start hook by convention. Its absence is an authoring warning, not a parse-time fatal error.
10. When two tools share the same `toolClass` in a `repoConfig.yaml` language entry, the first listed entry is used and a warning with line numbers is emitted.
11. Repo script installation is a one-time operation performed by `bf orchestrate` on first run against a working repository. Subsequent runs are safe and idempotent.
12. `bf orchestrate` is always invoked from inside a valid git repository. The git root is the working repository; no other mechanism for specifying `projectDir` exists.
13. Absent optional Handlebars tokens render as empty string. Prompt authors guard optional sections with `{{#if}}` blocks.
14. Task State Store is available and reachable during hook execution. Unavailability causes task failure.
15. Task State Store operations are atomic for single task_id writes.
16. Agent catalog exists: `.claude/agents/` directory contains agent definitions for legacy agents, or AGENT.md files for Level 3 agents.
17. Configuration file exists: `.bifrost.yaml` in project root or home directory.
18. Network connectivity: Task source API is reachable from orchestrator.
19. File system permissions: Orchestrator has read/write access to project directory.
20. Shell availability: `/bin/sh` or compatible shell is available for hook execution.
21. Claimant uniqueness: Each orchestrator instance has a unique claimant identifier.
22. Idempotent hooks: Hooks are safe to run multiple times (follow-up loops).
23. Hook timeouts: Hooks complete within reasonable time or are killed.
24. Agent model support: Specified model (sonnet/opus/haiku) is available in engine.

### External System Assumptions

- **Bifrost API**: Supports `/runes/ready`, `/runes/{id}`, `/runes/{id}/claim`, `/runes/{id}/unclaim`, `/runes/{id}/fulfill` endpoints
- **Claude Code CLI**: Supports executing agents with context and returning structured results
- **Agent catalog format**: YAML files follow the specified schema for legacy agents, AGENT.md for Level 3 agents
- **Task State Store backend**: Supports get/set/delete operations with appropriate performance characteristics

---

## Open Questions

### OQ-1: Multi-Instance Coordination

**Ambiguity**: How should multiple orchestrator instances coordinate to prevent duplicate work?

**Assumption**: The Bifrost API handles atomic claim operations, preventing race conditions between instances.

**Ideal Solution**: Implement distributed locking via the task source API. Each orchestrator instance has a unique claimant ID. Claim operations are atomic and return false if already claimed.

**Alternatives**:
1. **Central coordinator**: Single coordinator assigns tasks to workers (adds complexity)
2. **Database-backed locking**: Use Redis/Postgres for distributed locks (adds dependency)
3. **Single instance**: Run only one orchestrator instance (limits scalability)

**Comparison**: The atomic claim approach (ideal) balances simplicity with correctness. It leverages the existing task source API without additional infrastructure. The central coordinator alternative adds a single point of failure. Database locking adds operational overhead. Single instance limits horizontal scaling.

### OQ-2: Hook Failure Strategy

**Ambiguity**: Should hook failures always abort the entire orchestration?

**Assumption**: Hook failures in RuneStart abort immediately. Hook failures in RuneStop are logged but don't block completion unless exit code 2.

**Ideal Solution**: Configurable hook failure policy per hook: `continue_on_error`, `abort_on_error`, `warn_on_error`.

**Alternatives**:
1. **Strict mode**: Any hook failure aborts (current behavior for RuneStart)
2. **Best effort**: Log and continue regardless of hook outcome
3. **Conditional**: Different behavior for RuneStart vs RuneStop (current hybrid)

**Comparison**: Strict mode ensures correctness but may fail on non-critical hooks. Best effort may hide important failures. The current conditional approach treats RuneStart as validation (strict) and RuneStop as optional checks (permissive). Adding configurable policies would provide flexibility without sacrificing safety.

### OQ-3: Follow-Up Loop Limits

**Ambiguity**: Should there be a limit on follow-up iterations to prevent infinite loops?

**Assumption**: No limit currently exists. A poorly behaved hook could cause infinite follow-up loops.

**Ideal Solution**: Configurable maximum follow-up iterations (default 3) with exponential backoff between iterations.

**Alternatives**:
1. **No limit**: Trust hooks to eventually succeed (current behavior, risky)
2. **Hard limit**: Fixed maximum iterations (e.g., 5) with failure on exceed
3. **Timeout**: Maximum total time in follow-up loop regardless of iterations

**Comparison**: No limit is simplest but risks infinite loops. A hard limit provides safety but may cut off legitimate retries. A timeout-based approach balances safety with flexibility. The configurable limit with backoff offers the best balance of safety and configurability.

### OQ-4: Agent Selection Without Worker Tag

**Ambiguity**: What should happen when a rune has no `worker:*` tag?

**Assumption**: Rune is skipped (unclaimed) and not executed.

**Ideal Solution**: Configurable default agent that executes when no worker tag is present. If no default configured, skip the rune.

**Alternatives**:
1. **Skip always**: Current behavior, safe but may miss work
2. **Default agent**: Use a configured default agent (requires config)
3. **Round-robin**: Distribute untagged runes across available agents (complex)
4. **Reject**: Mark rune as failed for missing worker tag (strict)

**Comparison**: Skip always is safe but may require manual tagging. Default agent provides automation but requires configuration. Round-robin is complex and may not match agent capabilities. Reject is strict but may create noise. The default agent approach with skip fallback offers flexibility with safe defaults.

---

## Design Decisions and Feedback

This section records decisions made after the initial PRD creation and feedback received during review.

### Decision 1: Multi-Instance Coordination Responsibility

**Status**: Resolved — Out of scope for orchestrator

**Decision**: If a task is ready (emitted by the task source's async iterator), the orchestrator is free to work on it. The task source plugin (e.g., Bifrost API, database, queue) is responsible for ensuring two orchestrators don't work on the same task simultaneously.

**Rationale**: This is handled via atomic claim operations, distributed locks, or queue semantics at the task source level. The orchestrator is a thin dispatch layer — it trusts that if the task source emits a task, it's safe to work on.

### Decision 2: Hook Exit Code Semantics

**Status**: Resolved — Exit codes control continuation

**Decision**: Hooks control continuation via exit codes:
- `0`: Continue (success)
- `1`: Continue with warning (recoverable error, stdout passed as context)
- `2`: Abort agent execution (fatal error)

Exit code 2 aborts the agent execution for that unit of work, moving it to failed state. The orchestrator continues processing other tasks. The task source is responsible for not re-emitting failed tasks.

**Rationale**: It is not the orchestrator's job to inspect whether a task "can be worked on" — if the plugin emits it, the orchestrator dispatches it. Hooks provide the validation gate via exit codes.

### Decision 3: Follow-Up Loop Limits

**Status**: Resolved — Orchestrator-developer defined

**Decision**: The orchestrator framework does not enforce a hard-coded follow-up loop limit. An orchestrator-developer can implement this themselves if needed, or an agent-developer can enforce limits via custom hooks that track iteration count in taskState and abort after exceeding a threshold.

**Rationale**: This provides maximum flexibility. Different use cases have different requirements — some need unlimited retries, others need strict limits. Let the developer decide.

### Decision 4: Undispatchable Work Handling

**Status**: Resolved — Mark as failed and abort

**Decision**: Work that is emitted from the async iterator but cannot be dispatched for any reason (no worker tag, taskState fails agent schema validation, agent not found, etc.) MUST be marked as failed and aborted. The task source plugin is responsible for handling the failed state (not re-emitting, moving to dead-letter queue, etc.).

**Rationale**: The orchestrator should not silently skip work. If it can't dispatch, it should fail visibly so the task source can handle it appropriately.

### Feedback 1: Language Choice — TypeScript over Python

**Received**: The orchestrator PRD should use TypeScript as the primary language, not Python. The agent definition PRD already specifies TypeScript due to ease of loading .mjs hooks via dynamic import.

**Action for v2**: Rewrite orchestrator as TypeScript-only. Remove Python references.

### Feedback 2: Decouple from Bifrost and Claude

**Received**: The orchestrator PRD should not include "Bifrost" or "Claude" language. We want this to be 100% decoupled — Bifrost will merely be a plugin to the framework. For instance:
- "Rune" is a Bifrost term — the orchestrator should talk about "tasks"
- "Agents should be stored in `.claude/agents/<blah>`" is Claude-specific — the orchestrator framework would install agents into the monorepo per the agent definition PRD

**Action for v2**: 
- Remove all Bifrost-specific terminology (use "task" not "rune", generic task source terms)
- Remove all Claude-specific terminology (use generic agent catalog locations)
- Use generic "AI runtime" or "engine" terms instead of "Claude Code CLI"
- Configuration file should be `.orchestrator.yaml` not `.bifrost.yaml`
- CLI command should be generic, not `bf orchestrate`
