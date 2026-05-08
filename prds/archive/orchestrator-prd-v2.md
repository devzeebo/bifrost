# Unified Orchestrator PRD v2

**Status:** Draft  
**Authors:** Eric Siebeneich, Matthew Wright, Alexander Reeves  
**Date:** 2026-05-07  
**Version:** 2.0

---

## Product Description, Problem, and Goal

### Product Description

The **Orchestrator Framework** is a TypeScript-based distributed task execution system that coordinates **AI agents** to perform work across multiple projects. It provides a plugin architecture with **Task Sources** (providers of work), **Engines** (executors of work), and **Task State Stores** (task state persistence), connected by a core orchestration layer that manages task lifecycle, state transitions, and telemetry.

The system implements a **multi-level AI factory model**:

- **Level 2 (skill):** Language- or tool-specific knowledge capsule. Contains a prompt describing how to write code in a specific language, a **toolClass** registry mapping roles (formatter, linter, testFramework, build) to named tools, and file-level hooks that validate output. A skill is agnostic to any task — it only answers: "how do you write X?"
- **Level 3 (task agent):** A **parameterized, task-focused agent** that accepts a **unit of work (UoW)** with pre-populated `taskState` and executes one discrete workflow (e.g., BDD Red phase). It is language-agnostic by design — language, framework, and style arrive via `taskState` at dispatch time.
- **Level 4 (orchestrator program):** Built using the orchestrator framework. Validates that the incoming UoW `taskState` satisfies the target agent's parameter schema, then dispatches the agent. The orchestrator does NOT derive or populate `taskState` values — that is the responsibility of whoever produced the UoW (a human, a CI system, another UoW agent, etc.).
- **Level 5 (meta-agent):** Can augment or modify skill and agent definitions (e.g., add timing hooks, update prompts after evals).

**Key Terms:**

- **Task**: A unit of work to be executed by an agent, containing title, description, tags, and metadata
- **Agent**: An AI worker with specific capabilities (model, tools, prompt) that executes tasks
- **AGENT.md**: Markdown file with YAML frontmatter that fully describes a Level 3 agent's contract
- **taskState**: Free-form object containing all context for a single task execution, including language, framework, and cross-hook state
- **Task Source**: Plugin that discovers, claims, and fulfills tasks from an external system (e.g., API, database, queue)
- **Engine**: Plugin that executes tasks using a specific mechanism (e.g., AI runtime, CLI tool)
- **Task State Store**: Plugin that persists and retrieves taskState across hook executions
- **Hook**: Shell command or Node.js script executed before (Start) or after (Stop) agent execution
- **repo script**: Hook script that belongs to a specific working repository, installed to `.ai/<agent>/hooks/`
- **repoConfig**: YAML file committed to working repository declaring languages and tools
- **toolClass**: Role identifier (formatter, linter, testFramework, build) for tool resolution
- **Claimant**: Identifier for the agent instance currently working on a task
- **projectDir**: Git root of the working repository, resolved automatically
- **Orchestration**: The process of coordinating hooks, engine execution, and follow-up loops
- **Follow-up**: Additional agent execution triggered by Stop hooks to address issues
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

With the Orchestrator Framework, Sarah builds orchestrator instances tailored to her infrastructure. She configures a **Task Source** that connects to her task management system, an **Engine** that uses her preferred AI runtime, and a **Task State Store** that persists taskState in Redis. When a task is ready, the orchestrator:

1. Receives the task from the Task Source's async iterator
2. Loads agent definition from AGENT.md (template parameters, hooks, prompt)
3. Validates taskState against agent's parameter schema
4. Runs **Start hooks** (validate-args, snapshot-tests, project-specific validation)
5. Renders Handlebars prompt with taskState values
6. Executes the task with the appropriate agent (model, tools from agent catalog)
7. Runs **Stop hooks** (check-new-tests, lint, format, custom checks)
8. If hooks report issues (exit code 1), triggers a **follow-up** loop to address them
9. If hooks report fatal errors (exit code 2), marks the UoW as failed
10. Persists updated taskState (including cross-hook state) via Task State Store
11. Marks the task complete with full telemetry (tokens used, duration, cost)

Marcus defines one BDD-Red agent. Its AGENT.md declares the `taskState` fields it requires: `language`, `testFramework`, and `testStyle`. Whatever process creates the UoW — a human, a CI trigger, or another agent — fills those fields before handing it to the orchestrator. The orchestrator validates the schema and dispatches. The same BDD-Red agent handles the C# service when a UoW arrives with C# / XUnit / Gherkin in taskState. Hooks are declared in the AGENT.md with a defined stdin schema and exit code contract. Repo scripts are automatically installed to the working repository's `.ai/` directory on first run. Hooks communicate via taskState, so snapshot-tests writes file hashes that check-new-tests reads.

Sarah now has reliable, scalable, composable automation. She can deploy multiple agents knowing the Task Source provides coordination (claiming, locking, or queue semantics). She has full visibility into execution. She trusts the automation because hooks validate work before completion. Marcus's team ships BDD Red across every language without touching the agent definition.

---

## User Stories / Use Cases

### US-1: Define a task agent with AGENT.md

**As an** agent author  
**I want** to write an AGENT.md with a documented parameter schema, allowed tools, hook lifecycle specs, and a Handlebars prompt body  
**So that** task agents are composable and language-agnostic

**Acceptance Criteria:**

```
Given an AGENT.md file with valid YAML frontmatter
  And a prompt body containing Handlebars tokens matching declared template parameters
When the orchestrator reads the file
Then the agent name, description, tools, toolClasses, template parameter schema, and prompt body are all accessible as structured data
```

```
Given an AGENT.md missing a required frontmatter field (name, description, or tools)
When the orchestrator reads the file
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

### US-2: Task Source emits available tasks

**As a** task source plugin author  
**I want** to emit available tasks via an async iterator  
**So that** the orchestrator can dispatch them

**Acceptance Criteria:**

```
Given a task is available for processing
  And the task source has exclusive ownership (via claim, lock, or queue dequeue)
When the orchestrator polls the task source
Then the task source yields the task via its async iterator
```

```
Given a task source supports concurrent polling
  And two orchestrator instances poll simultaneously
When both poll the task source
Then each task is yielded to at most one orchestrator
  And the task source handles coordination (atomic claims, distributed locks, or queue semantics)
```

```
Given a task source yields a task
When the orchestrator receives the task
Then the orchestrator dispatches the task without checking ownership
  And ownership is the task source's responsibility
```

### US-3: Agent Operator - Dispatch agent on task

**As an** agent operator  
**I want** to dispatch a task with the appropriate agent  
**So that** work is completed

**Acceptance Criteria:**

```
Given a task is yielded from the task source
  And the task has a "worker:reviewer" tag
  And the reviewer agent is configured in the agent catalog
When the orchestrator receives the task
Then Start hooks are executed in sequence
  And the reviewer agent is invoked with the task context
  And Stop hooks are executed in sequence
  And the task is marked complete
  And execution telemetry is recorded
```

```
Given a task has no worker tag (no "worker:*" in tags)
When the orchestrator receives the task
Then the task is marked as failed
  And the orchestrator logs the reason
  And the task source is notified of the failure
```

```
Given a task's taskState fails agent schema validation
When the orchestrator receives the task
Then the task is marked as failed
  And the orchestrator logs the validation error
  And the task source is notified of the failure
```

### US-4: Project Maintainer - Extend Agent with Hooks

**As a** project maintainer  
**I want** to attach shell commands to agent lifecycle events  
**So that** agents can validate work and augment prompts

**Acceptance Criteria:**

```
Given an AGENT.md with a hooks.Start section containing one or more hook specs
When the agent is dispatched with a valid UoW
Then each Start hook executes in declaration order before the agent receives its prompt
  And exit code 0 allows the agent to proceed
  And exit code 1 passes hook stdout to the agent as a warning and continues
  And exit code 2 halts the agent, marks UoW as failed, and surfaces the error to the task source
```

```
Given an AGENT.md with a hooks.Stop section
When the agent's prompt execution finishes
Then each Stop hook executes in declaration order
  And exit code 1 returns stdout to the agent for remediation (follow-up loop)
  And exit code 2 halts, marks UoW as failed, and reports the error to the task source
```

```
Given a running hook
When stdin is read
Then the hook receives a JSON object containing: projectDir (string), params (the resolved taskState values), taskState (full UoW taskState object)
  And the rendered prompt is NOT present in stdin
```

```
Given a Start hook that writes data into taskState (e.g., snapshot-tests writes file hashes)
  And a Stop hook that reads that data (e.g., check-new-tests reads file hashes)
When both hooks run within the same dispatch
Then the Stop hook receives taskState as modified by all preceding hooks
```

### US-5: First run installs repo scripts into the working repository

**As a** developer running the orchestrator against a working repository for the first time  
**I want** repo scripts for all built-in agents to be automatically hard-copied into the working repository and staged for commit  
**So that** working repositories are ready for agent dispatch without manual file management

**Acceptance Criteria:**

```
Given an orchestrator program with one or more built-in agents that have repo scripts
  And a working repository that has not previously been initialized by this orchestrator
When the orchestrator runs against the working repository for the first time
Then each repo script is hard-copied to .ai/<agent-name>/hooks/<lifecycle>.d/<hook-name>.mjs
  And no symlinks are created
  And the orchestrator logs each installed path
```

```
Given a working repository that has already been initialized
  And a repo script already exists at the expected path
When the orchestrator runs again
Then the existing script is not overwritten
  And the orchestrator logs that the script is already present
```

```
Given repo scripts installed by the orchestrator
When a developer runs git status in the working repository
Then the installed .mjs files appear as new untracked files
  And no other files in the working repository are modified by the install step
```

### US-6: Dispatch an agent with a pre-populated unit of work

**As a** Level 4 orchestrator program  
**I want** to validate an incoming UoW's `taskState` against the target agent's parameter schema and dispatch only when all required fields are satisfied  
**So that** the orchestrator remains a thin validation and dispatch layer

**Acceptance Criteria:**

```
Given a Level 3 agent with a declared template.parameters schema
  And a UoW whose taskState satisfies all required parameters recursively
When the orchestrator dispatches
Then the rendered prompt is injected into the agent's context
  And the agent begins work
```

```
Given a UoW whose taskState is missing a required parameter
When the orchestrator attempts dispatch
Then the Start hook validate-args exits with code 2
  And the agent does not execute any prompt
  And the error identifies the missing field by its dot-notation path
  And the UoW is marked as failed
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
When the orchestrator receives it
Then the orchestrator does not read repoConfig, inspect the workspace, or call any external service to fill in missing values
  And it fails validation, marks the UoW as failed, and returns the error to the task source
```

### US-7: Platform Engineer - Observe Agent Execution

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
And telemetry is appended as a completion note on the task
```

```
Given an agent executes with follow-up
When multiple engine executions occur
Then telemetry is accumulated across all executions
And cumulative telemetry is reported on completion
```

### US-8: System Administrator - Configure Multiple Sources and Engines

**As a** system administrator  
**I want** to configure task sources, engines, and task state stores via YAML  
**So that** the orchestrator works with different backends

**Acceptance Criteria:**

```
Given a .orchestrator.yaml configuration file
And orchestrate.task_source.type is "api"
And orchestrate.task_source.settings.base_url is "https://api.example.com"
And orchestrate.task_source.settings.poll_interval is 30
When the orchestrator loads configuration
Then an APITaskSource is created with the specified base_url
And the task source polls every 30 seconds
```

```
Given a .orchestrator.yaml configuration file
And orchestrate.engine.type is "ai-runtime"
And orchestrate.engine.settings.endpoint is "https://ai.example.com"
When the orchestrator loads configuration
Then an AIRuntimeEngine is created with the specified endpoint
```

```
Given a .orchestrator.yaml configuration file
And orchestrate.task_state_store.type is "redis"
And orchestrate.task_state_store.settings.url is "redis://localhost:6379"
When the orchestrator loads configuration
Then a RedisTaskStateStore is created with the specified URL
```

```
Given an unknown task source type is configured
When the orchestrator attempts to create the task source
Then an error is raised with message "Unknown task source type: {type}"
```

### US-9: Developer - List Available Agents

**As a** developer  
**I want** to list all configured agents and their capabilities  
**So that** I can choose the right agent for a task

**Acceptance Criteria:**

```
Given the agent catalog contains agents
And agent "reviewer" has description, model, tools, and hooks
When the orchestrator CLI is invoked with --list-agents
Then each agent name is printed
And agent description is printed if present
And agent model is printed if present
And agent tools are printed as comma-separated list if present
And start_hooks are printed as comma-separated list if present
And stop_hooks are printed as comma-separated list if present
```

```
Given the agent catalog is empty
When the orchestrator CLI is invoked with --list-agents
Then "No agents found." is printed to stderr
```

### US-10: projectDir resolved from git root of CWD

**As a** developer running the orchestrator from within a working repository  
**I want** the orchestrator program to automatically resolve the working repository root by walking up from the current working directory  
**So that** running the orchestrator requires no path arguments and works from any subdirectory

**Acceptance Criteria:**

```
Given a developer runs the orchestrator from a directory inside a git repository
When the orchestrator program starts
Then projectDir is set to the git root of the directory the orchestrator was invoked from
  And no --projectDir argument is required
```

```
Given a developer runs the orchestrator from a directory that is not inside any git repository
When the orchestrator program starts
Then it exits with a descriptive error stating that no git root could be found
  And no agent dispatch occurs
```

```
Given a git repository rooted at /home/user/myrepo
  And a developer runs the orchestrator from /home/user/myrepo/src/lib
When the orchestrator program starts
Then projectDir is /home/user/myrepo
```

### US-11: Task State persistence across hook executions

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
And the UoW is marked as failed
```

---

## Functional Requirements

### FR-1: Task Source Interface

The system MUST implement the `TaskSource` interface with the following methods:

- `async watchTasks(): AsyncIterator<Task>`: Yield available tasks. The task source is responsible for coordination (claiming, locking, queue semantics) to ensure each task is yielded to at most one orchestrator instance.
- `async getTaskDetail(taskId: string): Promise<TaskDetail>`: Retrieve full task details
- `async completeTask(taskId: string): Promise<boolean>`: Mark task as fulfilled
- `async failTask(taskId: string, error: string): Promise<boolean>`: Mark task as failed

Task Status enum values:
- `OPEN`: Task is available for processing
- `IN_PROGRESS`: Task is being executed
- `COMPLETED`: Task is fulfilled
- `FAILED`: Task execution failed
- `CANCELLED`: Task was cancelled

The task source plugin is responsible for:
- Ensuring tasks yielded via `watchTasks()` are not simultaneously yielded to other orchestrators
- Not re-emitting tasks that have been marked as `FAILED`
- Handling coordination via atomic claims, distributed locks, queue dequeue, or other mechanisms

### FR-2: Engine Interface

The system MUST implement the `Engine` interface with the following methods:

- `async execute(context: EngineContext, taskData: TaskData): Promise<EngineResult>`: Execute a task
- `async sendFollowUp(message: string): Promise<EngineResult>`: Optional method for follow-up execution

EngineContext MUST contain:
- `taskId: string`: Unique task identifier
- `workingDir: string`: Project directory for execution
- `agentName: string`: Name of the agent to use
- `verbose: boolean`: Enable verbose logging

EngineResult MUST contain:
- `success: boolean`: Whether execution succeeded
- `skipFulfill: boolean`: Whether to skip marking the task complete
- `lastMessage: string | null`: Final message from the agent
- `stats: ExecutionStats | null`: Telemetry data

ExecutionStats MUST contain:
- `durationMs: number`: Execution duration in milliseconds
- `inputTokens: number`: Input tokens consumed
- `outputTokens: number`: Output tokens consumed
- `cacheReadTokens: number`: Cache read tokens
- `cacheCreationTokens: number`: Cache creation tokens
- `totalCostUsd: number`: Total cost in USD
- `numTurns: number`: Number of conversation turns

### FR-3: Task State Store Interface

The system MUST implement the `TaskStateStore` interface with the following methods:

- `async loadTaskState(taskId: string): Promise<Record<string, unknown> | null>`: Load taskState for a task
- `async saveTaskState(taskId: string, taskState: Record<string, unknown>): Promise<boolean>`: Persist taskState for a task
- `async deleteTaskState(taskId: string): Promise<boolean>`: Delete taskState for a task
- `async initializeTaskState(taskId: string, initialState: Record<string, unknown>): Promise<boolean>`: Initialize taskState for a new task

TaskStateStore implementations MUST be thread-safe and support concurrent access.

### FR-4: Agent Definition File (AGENT.md)

Format: Markdown file with YAML frontmatter delimited by `---`. The prompt body follows the closing `---`.

Required frontmatter fields:

| Field | Type | Description |
|---|---|---|
| `name` | string | Unique agent identifier (kebab-case) |
| `description` | string | One-line description used for orchestrator routing |
| `tools` | string[] | Explicit allowlist of tools this agent may use |
| `toolClasses` | string[] | Optional. Tool role types this agent requires. Informational — documents what must be available. |
| `template.parameters` | object | Free-form YAML shape declaring the taskState structure this agent expects |

The `tools` list is a strict allowlist enforced by the runtime. Any tool not listed is denied regardless of what the prompt requests.

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

`projectDir` is not passed as a CLI argument. When the orchestrator is invoked, it walks up from the current working directory to find the nearest ancestor directory containing a `.git` folder. That directory becomes `projectDir` for the duration of the run. If no git root is found, the program exits with a fatal error.

### FR-7: Orchestrator Framework and Orchestrator Program

The **orchestrator framework** is a TypeScript monorepo supporting npm workspaces:

```
orchestrator-framework/
  package.json              # workspaces: ["packages/**"]
  node_modules/             # shared, hoisted
  packages/
    bdd-red -> /path/to/bdd-red    # symlink
    bdd-green -> /path/to/bdd-green
```

An **orchestrator program** is built on this framework and embeds a chosen set of agents. Agents are installed by symlinking them under `./packages/<agent-name>`. npm workspace dependency resolution handles hoisting and conflict resolution.

When the orchestrator runs against a working repository for the first time, it performs a one-time install of all built-in repo scripts before any dispatch occurs.

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
| 1 | Recoverable error | Hook stdout passed to agent as context; execution continues (triggers follow-up for Stop hooks) |
| 2 | Fatal error | Agent halts; UoW marked as failed; error surfaced to task source |

**Script format:** `.mjs` (ES module) or executable shell script. Executed via dynamic `import()` (Node.js) or subprocess (shell).

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

Configuration file `.orchestrator.yaml` MUST support:

```yaml
orchestrate:
  task_source:
    type: string          # Plugin name
    settings:
      # Plugin-specific settings
  
  engine:
    type: string          # Plugin name
    settings:
      # Plugin-specific settings
  
  task_state_store:
    type: string          # "redis" | "memory" | "file"
    settings:
      # Type-specific settings
  
  concurrency: number
  claimant: string | null
  logging: "normal" | "verbose"
```

### FR-14: Orchestration Lifecycle

The orchestrator MUST execute the following sequence:

1. Receive task from Task Source's async iterator
2. Load agent definition from AGENT.md based on `worker:*` tag
3. Load/initialize taskState from Task State Store
4. Execute Start hooks with taskState
5. If any hook exits with code 2: mark UoW as failed, notify task source, continue to next task
6. Validate taskState against template.parameters
7. If validation fails: mark UoW as failed, notify task source, continue to next task
8. Render Handlebars prompt with taskState values
9. Build EngineContext and taskData
10. Execute engine
11. Execute Stop hooks
12. If any Stop hook exits with code 1: loop back to step 9 with follow-up message
13. If any Stop hook exits with code 2: mark UoW as failed, notify task source, continue to next task
14. Save final taskState to Task State Store
15. Mark task as complete via Task Source
16. Append completion note with telemetry
17. Continue to next task

### FR-15: Level Hierarchy Constraints

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
- The orchestrator MUST survive process restart and resume polling
- Task State Store MUST be thread-safe and support concurrent access
- Task State persistence failures MUST be logged and cause UoW failure

### NFR-3: Monitoring and Observability

- All task source operations MUST be logged with task ID
- All hook executions MUST be logged with command and exit code
- Engine execution MUST log telemetry on completion
- Task State Store operations MUST be logged with task ID
- Log levels MUST be configurable (normal, verbose)
- Structured JSON log entries for: git root resolution, agent load, taskState validation result, hook start, hook exit (with exit code and duration), agent dispatch

### NFR-4: Concurrency

- The orchestrator MUST support configurable worker concurrency
- Task Source MUST handle coordination (no built-in locking in orchestrator)
- Task State Store MUST support concurrent reads and writes to the same task_id

### NFR-5: Error Handling

- Invalid JSON on stdin MUST result in exit code 1
- Unknown agent name MUST result in UoW being marked as failed
- Agent without model MUST result in UoW being marked as failed
- Task source unavailability MUST be logged and retried
- Hook execution exceptions MUST be caught, logged, and result in exit code 2
- Task State Store unavailability MUST cause UoW failure with descriptive error
- Every validation failure, hook exit-2, and parse error must name the specific field or file path that caused the failure, using dot-notation for nested fields

### NFR-6: Install Idempotency

- Running the orchestrator multiple times against the same working repository produces the same result
- Already-present repo scripts are not overwritten
- No errors are raised for already-installed scripts
- Task State Store initialization is idempotent

### NFR-7: Reproducibility

- Given the same AGENT.md, the same `taskState`, and the same `projectDir`, two dispatches produce identical rendered prompts
- Handlebars rendering is deterministic and side-effect free

### NFR-8: Security

- The `tools` allowlist is enforced by the runtime
- A prompt that instructs the agent to use an unlisted tool is rejected before execution
- Repo scripts are executed with the same permissions as the orchestrator
- Task State Store does not execute code from stored taskState values

---

## Data & Storage

### Commands

**CompleteTask**
- `taskId: string`
- Occurs when: Worker completes a task successfully

**FailTask**
- `taskId: string`
- `error: string`
- Occurs when: Worker fails a task (validation error, hook exit code 2, etc.)

**AppendCompletionNote**
- `taskId: string`
- `note: string` (JSON serialized ExecutionStats)
- Occurs when: Worker completes execution with telemetry

**InitializeTaskState**
- `taskId: string`
- `initialState: Record<string, unknown>`
- Occurs when: Task is received for the first time

**UpdateTaskState**
- `taskId: string`
- `updates: Record<string, unknown>`
- Occurs when: Hook modifies taskState

**LoadTaskState**
- `taskId: string`
- Occurs when: Hook needs to read current taskState

**DispatchAgent**
- `agentName: string`, `projectDir: string`, `uow: UnitOfWork`, `dispatchedAt: ISO8601`
- Occurs when: Orchestrator dispatches an agent

**RunHook**
- `agentName: string`, `hookName: string`, `lifecycle: "Start" | "Stop"`, `projectDir: string`
- Occurs when: Hook is executed

**InstallRepoScripts**
- `orchestratorName: string`, `projectDir: string`, `installedAt: ISO8601`
- Occurs when: Repo scripts are installed to working repository

### Events

**TaskCompleted**
- `taskId: string`
- `claimant: string`
- `telemetry: ExecutionStats`
- `timestamp: Date`

**TaskFailed**
- `taskId: string`
- `claimant: string`
- `error: string`
- `timestamp: Date`

**AgentDispatched**
- `agentName: string`, `taskStateSnapshot: Record<string, unknown>`, `renderedPromptHash: string`, `dispatchedAt: ISO8601`

**HookExecuted**
- `agentName: string`, `hookName: string`, `lifecycle: "Start" | "Stop"`, `exitCode: 0 | 1 | 2`, `stdout: string`, `durationMs: number`, `executedAt: ISO8601`

**AgentHalted**
- `agentName: string`, `reason: string`, `haltedAt: ISO8601`

**TaskStateValidationFailed**
- `agentName: string`, `missingFields: string[]`, `failedAt: ISO8601`

**RepoScriptInstalled**
- `agentName: string`, `hookName: string`, `targetPath: string`, `installedAt: ISO8601`

**RepoScriptAlreadyPresent**
- `agentName: string`, `hookName: string`, `targetPath: string`, `checkedAt: ISO8601`

**TaskStateUpdated**
- `taskId: string`, `updatedFields: string[]`, `updatedAt: Date`

**TaskStateInitialized**
- `taskId: string`, `initialState: Record<string, unknown>`, `initializedAt: Date`

### Aggregates

**Task**
- `id: string`
- `title: string`
- `description: string | null`
- `status: TaskStatus`
- `tags: string[]`
- `claimant: string | null`
- `createdAt: Date | null`
- `updatedAt: Date | null`
- `priority: number`

**TaskDetail**
- Extends Task
- `dependencies: DependencyRef[]`
- `notes: NoteEntry[]`
- `acceptanceCriteria: ACEntry[]`
- `retro: RetroEntry[]`

**AgentExecution**
- `taskId: string`
- `agentName: string`
- `claimant: string`
- `startedAt: Date`
- `completedAt: Date | null`
- `telemetry: ExecutionStats | null`
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

**TaskDetailQuery**
- Question: What is the full context for a specific task?
- Projection: `TaskDetail` by `taskId`
- Used by: Agent execution

**AgentExecutionHistoryQuery**
- Question: What executions have occurred for a task?
- Projection: List of `AgentExecution` by `taskId` ordered by `startedAt`
- Used by: Debugging and audit

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
- Projection: `taskState` dict by `taskId`
- Used by: Hook execution, follow-up loops

### Data Retention

- Task events MUST be retained indefinitely (event sourcing)
- Task aggregate MUST be rebuildable from event stream
- Completed tasks MUST NOT be deleted from task source
- Agent execution history MUST be appended to task as notes
- `DispatchRecord` and associated events: 90 days, then archived or deleted
- `AgentDefinition` snapshot captured at dispatch time: retained with its `DispatchRecord` for the same 90-day window
- `package.json` hash records: retained indefinitely (required for install-skip optimization)
- TaskState MUST be retained until task is completed and archived, then purged according to retention policy

---

## Out of Scope

- Multi-machine coordination (handled by Task Source plugin)
- Dynamic agent registration (agents must be installed in monorepo)
- Real-time task streaming (polling only, no websockets)
- Task prioritization within the orchestrator (priority is metadata only)
- Automatic retry on failure (manual retry only)
- Task dependencies (dependencies are metadata only)
- Custom scheduling algorithms (FIFO polling only)
- Agent sandboxing (agents run with same permissions as orchestrator)
- Web UI or API for orchestration management
- Level 5 meta-agent behavior: Automated prompt improvement, token-usage instrumentation, and eval-driven skill updates are out of scope. The schema must not prevent these being added later.
- Non-Node.js hook runtimes in v1: Python, Bash, and Rust hooks are out of scope. The exit-code contract is language-agnostic and could support other runtimes in a future version.
- Agent-to-agent calls within a Level 3 task: Level 3 agents execute a single task. Inter-agent calls within a prompt belong to Level 4.
- GUI or web interface for agent authoring: Authoring is file-based (markdown + YAML).
- Agent definition versioning: Semantic versioning of AGENT.md files and compatibility guarantees between versions are out of scope for v1.
- Multi-language dispatch in a single agent invocation: Each dispatch targets one language at a time. Polyglot support comes from separate dispatches.
- Automated Gherkin test execution for hook specs: The `.md` Gherkin spec files are documentation and acceptance criteria only. They are not automatically parsed and run. Provided hook scripts ship with unit tests; teams writing replacement implementations test against the spec on their own.
- Scalar type enforcement in template.parameters: The type hints (e.g., `string`) in `template.parameters` values document intent but are not enforced at runtime in v1. Validation only checks presence and non-emptiness of required fields.
- Orchestrator responsibility for taskState derivation: The orchestrator validates; it does not populate. Whatever produces the UoW — human, CI, or another agent — is responsible for all `taskState` values.
- Repo script upgrade path: When a newer version of the orchestrator program ships an updated repo script, there is no automated mechanism to update already-installed copies in working repositories. Teams update repo scripts manually. A future version may introduce a hash-comparison check with an explicit overwrite command.
- Malicious agent package supply chain: A compromised agent package could declare arbitrary dependencies installed into the shared orchestrator `node_modules`. The v1 mitigation is developer discipline — always review agent definitions and `package.json` before installing.

---

## Dependencies and Assumptions

### Dependencies

| Dependency | Purpose |
|---|---|
| `repoConfig.yaml` (working repo) | Toolchain declarations; read by processes that produce UoW taskState |
| TypeScript runtime | Orchestrator framework execution |
| Node.js ≥24 | Runtime for hook script execution and orchestrator program |
| git | Working repository root resolution (`projectDir` detection) |
| npm workspaces | Agent dependency resolution and workspace test orchestration |
| vitest (agent-level devDependency) | Running provided hook unit tests |
| Handlebars (or equivalent) | Prompt template rendering at dispatch time |
| Task State Store backend (Redis, filesystem, in-memory) | taskState persistence across hook executions |

### Assumptions

1. The runtime enforces the `tools` allowlist at the execution level. An agent cannot bypass it via prompt instructions.
2. `repoConfig.yaml` is committed to the working repository and readable by any process that needs it.
3. Node.js ≥24 is available in the orchestrator program's execution environment.
4. All hook scripts (framework and repo) are ES modules (`.mjs`) or executable shell scripts.
5. The orchestrator framework is an npm workspace monorepo. `npm install` at the root resolves all agent hook dependencies.
6. `taskState` fields of type `prompt` carry the full text of a skill prompt section as a string value. The UoW producer is responsible for loading skill content and writing it as a string — not a file path.
7. A Level 3 agent is stateless between dispatches. Per-dispatch state lives in `taskState` and is threaded through hook stdin.
8. `validate-args` is the first Start hook by convention. Its absence is an authoring warning, not a parse-time fatal error.
9. When two tools share the same `toolClass` in a `repoConfig.yaml` language entry, the first listed entry is used and a warning with line numbers is emitted.
10. Repo script installation is a one-time operation performed by the orchestrator on first run against a working repository. Subsequent runs are safe and idempotent.
11. The orchestrator is always invoked from inside a valid git repository. The git root is the working repository; no other mechanism for specifying `projectDir` exists.
12. Absent optional Handlebars tokens render as empty string. Prompt authors guard optional sections with `{{#if}}` blocks.
13. Task State Store is available and reachable during hook execution. Unavailability causes UoW failure.
14. Task State Store operations are atomic for single task_id writes.
15. Configuration file exists: `.orchestrator.yaml` in project root or home directory.
16. Network connectivity: Task source is reachable from orchestrator.
17. File system permissions: Orchestrator has read/write access to project directory.
18. Shell availability: `/bin/sh` or compatible shell is available for hook execution.
19. Idempotent hooks: Hooks are safe to run multiple times (follow-up loops).
20. Hook timeouts: Hooks complete within reasonable time or are killed.

### External System Assumptions

- **Task Source**: Implements coordination (atomic claims, distributed locks, or queue semantics) to ensure tasks are not yielded to multiple orchestrators simultaneously. Does not re-emit failed tasks.
- **AI Runtime**: Supports executing agents with context and returning structured results.
- **Agent catalog format**: AGENT.md files following the specified schema for Level 3 agents.
- **Task State Store backend**: Supports get/set/delete operations with appropriate performance characteristics.

---

## Decisions

This section records design decisions made to resolve the open questions below. These decisions establish clear boundaries between the orchestrator framework and its plugins, and inform the v3 iteration.

### D-1: Task Source Concurrency

**Decision:** Task Source coordination is entirely out of scope for the orchestrator framework.

**Rationale:** The orchestrator consumes tasks via the `TaskSource.watchTasks()` async iterator. It does not manage claiming, locking, or queue semantics. The Task Source plugin developer is responsible for all coordination concerns.

**Implications:**
- Orchestrator implements no distributed locking
- Orchestrator does not detect or handle duplicate task dispatch
- Task Source plugins must ensure each task yielded to at most one consumer
- Coordination for multiple orchestrator instances is the Task Source's responsibility

### D-2: Task State Persistence and Reconnection

**Decision:** Task state persistence is the Task Source's responsibility. Orchestrator recreates Task Source instance on iterator failure.

**Rationale:** When the Task Source's async iterator dies (throws, crashes, disconnects), the orchestrator should reconnect automatically rather than requiring manual restart. Persistence of task state across restarts is the Task Source plugin's concern.

**Behavior:**
1. If `watchTasks()` async iterator terminates, wait 1 minute
2. Create new Task Source instance with same configuration
3. Call `watchTasks()` again
4. Log the reconnection attempt
5. Continue indefinitely until explicit shutdown

**Implications:**
- Orchestrator does not persist task state across restarts
- Task Source must handle its own persistence requirements
- Reconnection delay fixed at 1 minute for v1
- Orchestrator does not distinguish error types — all trigger same retry logic

### D-3: Task State Size Limits

**Decision:** Orchestrator does not enforce taskState size limits. This is the Task State Store's responsibility.

**Rationale:** The orchestrator treats taskState as an opaque object beyond parameter schema validation. Size limits, if any, are enforced by the Task State Store implementation.

**Implications:**
- Orchestrator does not validate taskState size
- If Task State Store rejects due to size, UoW marked as failed
- Different implementations may have different limits
- Store error messages surfaced to task source

### D-4: Task State Update Atomicity

**Decision:** Task State Store operations are assumed to be atomic. Orchestrator implements no additional consistency mechanisms.

**Rationale:** The `loadTaskState`/`saveTaskState` interface is treated as atomic. Either update succeeds or fails. Orchestrator does not implement transactions, versioning, or conflict resolution.

**Implications:**
- Each `saveTaskState` call is single atomic operation
- Save failure = UoW marked as failed
- Orchestrator does not retry failed saves
- Concurrent writes follow Store's semantics (last-write-wins, error, etc.)

### D-5: Hook Timeout Configuration and Handling

**Decision:** Hook timeouts configured per-hook in AGENT.md frontmatter. Timeout results in exit code 2 (fatal error).

**Configuration:**
```yaml
hooks:
  Start:
    - name: validate-args
      scriptPath: hooks/Start.d/validate-args.mjs
      timeout: 300000  # milliseconds, optional
```

**Behavior:**
- Hook exceeds timeout = execution terminated
- Treated as exit code 2 (fatal error)
- Logged: "Hook {hookName} exceeded timeout of {timeout}ms"
- UoW marked as failed
- Default if not specified: 5 minutes (300000ms)

**Implications:**
- Each hook specifies own timeout
- Orchestrator terminates execution at timeout (subprocess kill)
- Partial state changes from timed-out hook not persisted

---

## Open Questions

### OQ-1: Task State Store Concurrency

**Ambiguity**: How should multiple concurrent hook executions coordinate access to the Task State Store to prevent race conditions?

**Assumption**: Task State Store implementations provide atomic operations for single task_id updates. Race conditions are handled by last-write-wins semantics.

**Ideal Solution**: Implement optimistic locking via version field in taskState. Each update includes version, and updates fail if version has changed. This prevents silent overwrites while supporting distributed execution.

**Alternatives**:
1. **Last-write-wins**: Simple but may lose updates (current assumption)
2. **Pessimistic locking**: Lock task_id during dispatch (blocks parallelism)
3. **Queue-based execution**: Single worker processes tasks sequentially (limits scalability)

**Comparison**: Optimistic locking balances correctness with scalability. Last-write-wins is simple but risks data loss. Pessimistic locking eliminates race conditions but blocks parallelism. Queue-based execution is simple but doesn't leverage multi-instance capabilities. Optimistic locking provides the best balance for v1.

### OQ-2: Task State Storage Backend for Offline Operations

**Ambiguity**: Should taskState persist across orchestrator restarts? What happens if Task State Store is unavailable?

**Assumption**: taskState persists across restarts. Task State Store unavailability causes UoW failure.

**Ideal Solution**: Configurable persistence policy with three modes: `persist` (survives restarts), `ephemeral` (in-memory only), `hybrid` (file-based fallback for unavailability). Unavailability handling configurable: `fail` (current), `continue_with_warning`, `fallback_to_file`.

**Alternatives**:
1. **Always persist, fail on unavailable**: Current behavior, safe but may halt all work
2. **In-memory only, survive restart via task source**: Complex but resilient
3. **File-based fallback**: Adds complexity but provides resilience

**Comparison**: Configurable persistence policy provides flexibility for different deployment scenarios. Always persist is safest but creates dependency. In-memory only simplifies but loses state on restart. File-based fallback provides resilience but adds implementation complexity. Configurable policy with fail default offers safety with option for resilience.

### OQ-3: Task State Size Limits

**Ambiguity**: Are there limits on taskState size? What happens when hooks store large amounts of data?

**Assumption**: No explicit limits in v1. Large taskState may cause performance issues or store failures.

**Ideal Solution**: Configurable size limits with enforcement at save time. Defaults: 1MB for in-memory store, 10MB for Redis, 100MB for file store. Exceeding limit causes UoW failure with descriptive error.

**Alternatives**:
1. **No limits**: Simple but risks resource exhaustion (current)
2. **Hard limits**: Prevents resource exhaustion but may block legitimate use cases
3. **Soft limits with warning**: Allows exceeding but warns on large taskState

**Comparison**: Configurable limits with enforcement prevents resource exhaustion while allowing operators to adjust for their needs. No limits is risky. Hard limits may be too restrictive. Soft limits don't prevent problems. Configurable limits with reasonable defaults offers best balance.

### OQ-4: Cross-Hook State Consistency

**Ambiguity**: What happens when a hook fails midway through updating taskState? Is partial state saved?

**Assumption**: taskState is saved only on successful hook completion (exit code 0). Failed hooks do not persist state changes.

**Ideal Solution**: Transactional taskState updates within a hook execution. Either all changes persist or none do. Hook can explicitly commit mid-execution if needed.

**Alternatives**:
1. **Save only on success**: Current behavior, simple but prevents incremental progress
2. **Save on each write**: Complex but provides more granular recovery
3. **Explicit commit model**: Flexible but requires hook author awareness

**Comparison**: Save only on success is simple and prevents inconsistent state. Save on each write provides recovery but may persist invalid state. Explicit commit model offers flexibility but increases complexity. Save on success is appropriate for v1; explicit commit can be added later if needed.

### OQ-5: Hook Timeout Handling

**Ambiguity**: What happens to taskState when a hook times out? Are partial changes persisted?

**Assumption**: Hook timeout is treated as failure (exit code 2). No taskState changes are persisted.

**Ideal Solution**: Configurable timeout policy: `rollback` (discard changes, current default), `commit` (persist partial changes), `checkpoint` (periodic commits during execution).

**Alternatives**:
1. **Always rollback**: Current behavior, safe but loses progress
2. **Always commit**: Preserves progress but may persist inconsistent state
3. **Configurable per hook**: Flexible but complex to configure

**Comparison**: Always rollback is safest and simplest. Always commit risks inconsistent state. Configurable per hook provides flexibility but increases complexity. Always rollback with configurable timeout duration is appropriate for v1.
