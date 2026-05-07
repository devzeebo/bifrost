# PRD: Level 3 Agent Definition Schema — v4

**Status:** Draft  
**Authors:** Eric Siebeneich, Matthew Wright, Alexander Reeves  
**Date:** 2026-05-07

---

## Product Description

This system defines the **agent schema** and **orchestration contract** for Level 3 (**task agents**) in a multi-level AI factory model. The model has distinct levels:

- **Level 2 (skill):** Language- or tool-specific knowledge capsule. Contains a prompt describing how to write code in a specific language, a **toolClass** registry mapping roles (formatter, linter, testFramework, build) to named tools, and file-level hooks that validate output. A skill is agnostic to any task — it only answers: "how do you write X?"
- **Level 3 (task agent):** A **parameterized, task-focused agent** that accepts a **unit of work (UoW)** with pre-populated `taskState` and executes one discrete workflow (e.g., BDD Red phase). It is language-agnostic by design — language, framework, and style arrive via `taskState` at dispatch time.
- **Level 4 (orchestrator program):** Built using the orchestrator framework. Validates that the incoming UoW `taskState` satisfies the target agent's parameter schema, then dispatches the agent. The orchestrator does NOT derive or populate `taskState` values — that is the responsibility of whoever produced the UoW (a human, a CI system, another UoW agent, etc.).
- **Level 5 (meta-agent):** Can augment or modify skill and agent definitions (e.g., add timing hooks, update prompts after evals).

An **agent definition** is a markdown file with YAML frontmatter (the **AGENT.md**) that fully describes the contract a Level 3 agent exposes. A **hook** is a Node.js `.mjs` script that runs at defined lifecycle points (Start, Stop) to validate preconditions or postconditions. Hooks communicate via **stdin/stdout/exit codes**.

The **orchestrator framework** is a Node.js monorepo with `workspaces: ["packages/**"]` that provides the scaffolding for building an orchestrator program. Agent packages are installed by symlinking them under `./packages/<agent-name>`. npm workspace dependency resolution handles hoisting and conflict resolution. Provided hook scripts are tested via `npm run test -ws`.

An **orchestrator program** is a specific orchestrator built using the framework — it embeds a chosen set of agents and is invoked via `bf orchestrate` from within a working repository. `projectDir` is resolved automatically as the git root of the directory `bf orchestrate` was run in. On first run against a working repository, the orchestrator program installs all built-in agent repo scripts into that repository automatically.

A **repo script** is a hook script that belongs to a specific working repository rather than the orchestrator. It is installed (hard-copied) into the working repo at `<working-repo>/.ai/<agent-name>/hooks/<lifecycle>.d/<hook-name>.mjs` and committed to version control. The orchestrator program dynamically imports it at runtime. Repo script dependencies are declared in the orchestrator program's `package.json` and resolved from its `node_modules`.

A **repoConfig** (e.g., `repoConfig.yaml`) is committed to the working repository and declares which languages and tools the project uses.

---

## Problem

Marcus is a senior engineer building an AI-assisted development workflow. He wants to automate the BDD Red phase across his polyglot monorepo. He writes a BDD-Red agent prompt that hard-codes Python and pytest — but three weeks later the team adds a C# service. Marcus must now maintain two nearly identical agents. When a teammate writes a BDD-Green agent, they hard-code it for TypeScript/Vitest. The agents are not composable: changing the test framework means editing every agent. Hooks that enforce correctness are written as ad-hoc shell scripts with no documented contract, so no one knows which exit code means what. The whole thing collapses when a new engineer joins and tries to wire up a Go service.

## Goal

Marcus defines one BDD-Red agent. Its AGENT.md declares the `taskState` fields it requires: `language`, `testFramework`, and `testStyle`. Whatever process creates the UoW — a human, a CI trigger, or another agent — fills those fields before handing it to the orchestrator. The orchestrator validates the schema and dispatches. The same BDD-Red agent handles the C# service when a UoW arrives with C# / XUnit / Gherkin in `taskState`. Hooks are declared in the AGENT.md with a defined stdin schema and exit code contract. Provided hook scripts ship with their own tests and a Gherkin spec `.md` for teams who want to write their own implementation. When Marcus runs `bf orchestrate` in a new working repository for the first time, repo scripts are automatically installed and committed. Marcus's team ships BDD Red across every language without touching the agent definition.

---

## User Stories

### Story 1: Define a task agent
So that task agents are composable and language-agnostic,  
As a developer authoring a new Level 3 agent,  
I want to write an AGENT.md with a documented parameter schema, allowed tools, hook lifecycle specs, and a Handlebars prompt body.

**AC 1.1 — AGENT.md parses correctly**
```
Given an AGENT.md file with valid YAML frontmatter
  And a prompt body containing Handlebars tokens matching declared template parameters
When an orchestrator program reads the file
Then the agent name, description, tools, toolClasses, template parameter schema, and prompt body are all accessible as structured data
```

**AC 1.2 — Missing required frontmatter fields fail at parse time**
```
Given an AGENT.md missing a required frontmatter field (name, description, or tools)
When an orchestrator program reads the file
Then parsing fails with a descriptive error naming the missing field
  And the agent is not dispatched
```

**AC 1.3 — Optional parameter declared with trailing ?**
```
Given an AGENT.md template.parameters section where a field name ends with ?
When the parameter schema is parsed
Then that field is marked optional
  And the Handlebars renderer does not error if that field is absent from taskState
  And an absent optional field renders as empty string
```

**AC 1.4 — Optional object with required sub-fields**
```
Given a template parameter declared as optional (name ends with ?)
  And that parameter is an object with one or more sub-fields whose names do not end with ?
When taskState provides that optional parameter
Then all non-? sub-fields of that object must be present and non-empty
  And validation fails naming any absent required sub-field by its dot-notation path
When taskState omits the optional parameter entirely
Then no validation error is raised for that parameter or any of its sub-fields
```

**AC 1.5 — Undeclared Handlebars tokens are a parse error**
```
Given a prompt body referencing a Handlebars token not declared in template.parameters
When the AGENT.md is parsed
Then parsing fails identifying the undeclared token by name
```

---

### Story 2: Install an agent into an orchestrator framework
So that agents are available for dispatch without managing dependency conflicts manually,  
As an orchestrator framework maintainer,  
I want to symlink an agent directory into `./packages/<agent-name>` and run `npm install` once to resolve all hook dependencies.

**AC 2.1 — Agent symlinked as workspace package**
```
Given an orchestrator framework monorepo with workspaces: ["packages/**"]
  And an agent directory symlinked under ./packages/<agent-name>
  And a valid package.json in the agent directory
When npm install runs at the orchestrator root
Then the agent's declared dependencies are resolved into the shared node_modules
  And version conflicts are resolved by npm workspace hoisting rules
```

**AC 2.2 — All provided agent tests run via workspace test command**
```
Given one or more agents installed as workspace packages
  And each agent package declares a "test" script in its package.json
When npm run test -ws runs from the orchestrator root
Then each installed agent's test suite executes
  And test results are attributed to their package by name
```

---

### Story 3: projectDir resolved from git root of CWD
So that running the orchestrator requires no path arguments and works from any subdirectory,  
As a developer running `bf orchestrate` from within a working repository,  
I want the orchestrator program to automatically resolve the working repository root by walking up from the current working directory.

**AC 3.1 — Git root resolved from CWD**
```
Given a developer runs bf orchestrate from a directory inside a git repository
When the orchestrator program starts
Then projectDir is set to the git root of the directory bf orchestrate was invoked from
  And no --projectDir argument is required
```

**AC 3.2 — Not inside a git repo is a fatal error**
```
Given a developer runs bf orchestrate from a directory that is not inside any git repository
When the orchestrator program starts
Then it exits with a descriptive error stating that no git root could be found
  And no agent dispatch occurs
```

**AC 3.3 — Subdirectory invocation resolves to the same root**
```
Given a git repository rooted at /home/user/myrepo
  And a developer runs bf orchestrate from /home/user/myrepo/src/lib
When the orchestrator program starts
Then projectDir is /home/user/myrepo
```

---

### Story 4: First run installs repo scripts into the working repository
So that working repositories are ready for agent dispatch without manual file management,  
As a developer running `bf orchestrate` against a working repository for the first time,  
I want repo scripts for all built-in agents to be automatically hard-copied into the working repository and staged for commit.

**AC 4.1 — Repo scripts installed on first run**
```
Given an orchestrator program with one or more built-in agents that have repo scripts
  And a working repository that has not previously been initialized by this orchestrator
When bf orchestrate runs against the working repository for the first time
Then each repo script is hard-copied to .ai/<agent-name>/hooks/<lifecycle>.d/<hook-name>.mjs
  And no symlinks are created
  And the orchestrator logs each installed path
```

**AC 4.2 — Already-installed scripts are not overwritten**
```
Given a working repository that has already been initialized
  And a repo script already exists at the expected path
When bf orchestrate runs again
Then the existing script is not overwritten
  And the orchestrator logs that the script is already present
```

**AC 4.3 — Installed scripts are ready to commit**
```
Given repo scripts installed by bf orchestrate
When a developer runs git status in the working repository
Then the installed .mjs files appear as new untracked files
  And no other files in the working repository are modified by the install step
```

---

### Story 5: Dispatch an agent with a pre-populated unit of work
So that the orchestrator remains a thin validation and dispatch layer,  
As a Level 4 orchestrator program,  
I want to validate an incoming UoW's `taskState` against the target agent's parameter schema and dispatch only when all required fields are satisfied.

**AC 5.1 — Valid taskState: agent dispatches**
```
Given a Level 3 agent with a declared template.parameters schema
  And a UoW whose taskState satisfies all required parameters recursively
When the orchestrator program dispatches
Then the rendered prompt is injected into the agent's context
  And the agent begins work
```

**AC 5.2 — Missing required field: dispatch fails before agent starts**
```
Given a UoW whose taskState is missing a required parameter
When the orchestrator program attempts dispatch
Then the Start hook validate-args exits with code 2
  And the agent does not execute any prompt
  And the error identifies the missing field by its dot-notation path
```

**AC 5.3 — Missing required sub-field of present optional object**
```
Given a template parameter that is an optional object (name ends with ?)
  And the UoW taskState provides that object
  And the object is missing a required sub-field (sub-field name does not end with ?)
When validate-args runs
Then validation fails identifying the missing sub-field by its dot-notation path
```

**AC 5.4 — Empty string treated as missing**
```
Given a UoW taskState where a required field is present but set to empty string
When validate-args runs
Then validation fails as if the field were absent
```

**AC 5.5 — Orchestrator does not derive taskState values**
```
Given a UoW with an incomplete taskState
When the orchestrator program receives it
Then the orchestrator does not read repoConfig, inspect the workspace, or call any external service to fill in missing values
  And it fails validation and returns the error to the caller
```

---

### Story 6: Lifecycle hooks enforce preconditions and postconditions
So that agents produce correct, validated output,  
As a developer defining a Level 3 agent,  
I want to declare Start and Stop hooks in the AGENT.md that run `.mjs` scripts at defined lifecycle points with a documented stdin/stdout/exit-code contract.

**AC 6.1 — Start hooks run before the agent prompt**
```
Given an AGENT.md with a hooks.Start section containing one or more hook specs
When the agent is dispatched with a valid UoW
Then each Start hook executes in declaration order before the agent receives its prompt
  And exit code 0 allows the agent to proceed
  And exit code 1 passes hook stdout to the agent as a warning and continues
  And exit code 2 halts the agent and surfaces the error to the orchestrator
```

**AC 6.2 — Stop hooks run after agent completes**
```
Given an AGENT.md with a hooks.Stop section
When the agent's prompt execution finishes
Then each Stop hook executes in declaration order
  And exit code 1 returns stdout to the agent for remediation
  And exit code 2 halts and reports the error
```

**AC 6.3 — Hook receives UoW context via stdin**
```
Given a running hook
When stdin is read
Then the hook receives a JSON object containing: projectDir (string), params (the resolved taskState values), taskState (full UoW taskState object)
  And the rendered prompt is NOT present in stdin
```

**AC 6.4 — Cross-hook state passes through taskState**
```
Given a Start hook that writes data into taskState (e.g., snapshot-tests writes file hashes)
  And a Stop hook that reads that data (e.g., check-new-tests reads file hashes)
When both hooks run within the same dispatch
Then the Stop hook receives taskState as modified by all preceding hooks
```

**AC 6.5 — validate-args rejects invalid taskState**
```
Given a Start hook of type validate-args
  And a UoW taskState failing schema validation (missing or empty required field)
When the hook executes
Then the hook exits with code 2
  And stdout identifies the failing field by its dot-notation path
```

**AC 6.6 — snapshot-tests records existing test state into taskState**
```
Given an agent that will write new tests
  And test files already existing in the project
When the snapshot-tests Start hook executes
Then taskState contains a hash of each existing test file's content keyed by relative file path
```

**AC 6.7 — check-new-tests validates new tests were written**
```
Given taskState containing the pre-dispatch test file snapshot
When the check-new-tests Stop hook executes
Then the hook compares current test files against the snapshot
  And exits 2 if no new test file was added and no existing file's hash changed
  And exits 0 if at least one new test file exists or at least one existing file's hash changed
```

---

### Story 7: Hook behavior is specified via Gherkin scenarios in markdown
So that teams can implement their own hook scripts and know exactly what behavior is required,  
As a developer onboarding an agent into their orchestrator,  
I want a Gherkin spec `.md` file co-located with each provided hook script that serves as the acceptance spec for custom implementations.

**AC 7.1 — Spec file is co-located with each provided script**
```
Given a provided hook script at hooks/<lifecycle>.d/<hook-name>.mjs
When the agent directory is inspected
Then a co-located hooks/<lifecycle>.d/<hook-name>.md exists
  And it contains at least one Scenario block with Given/When/Then steps
  And it contains no implementation-specific details (no function names, no line numbers)
```

**AC 7.2 — Provided scripts have unit tests**
```
Given a provided hook script at hooks/<lifecycle>.d/<hook-name>.mjs
When the agent package's test suite runs
Then at least one test case exercises the script's behavior directly
  And all provided tests pass against the provided implementation
```

**AC 7.3 — Spec is the sole reference for custom implementations**
```
Given a developer who replaces a provided script with their own implementation
When they read the co-located .md file
Then the Gherkin scenarios fully specify the required input/output/exit-code behavior
  And no additional documentation is required to produce a conforming replacement
```

---

### Story 8: repoConfig toolClass conflicts emit a warning with location
So that misconfigured repos are caught early without silently producing wrong behavior,  
As a developer maintaining a repoConfig.yaml,  
I want the orchestrator program to warn me when multiple tools are registered for the same toolClass within one language entry, including the exact line numbers of both conflicting entries.

**AC 8.1 — First match used, warning emitted with line numbers**
```
Given a repoConfig.yaml where a language entry lists two tools with the same toolClass
When the orchestrator program reads repoConfig
Then the first matching tool entry is used
  And a warning is emitted identifying the language name, the conflicting toolClass, and the line numbers of both conflicting entries
```

**AC 8.2 — No warning when each toolClass appears exactly once**
```
Given a repoConfig.yaml where each language entry has at most one tool per toolClass
When the orchestrator program reads repoConfig
Then no toolClass conflict warning is emitted
```

---

## Functional Requirements

### Agent Definition File (AGENT.md)

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

### template.parameters Schema Rules

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

### projectDir Resolution

`projectDir` is not passed as a CLI argument. When `bf orchestrate` is invoked, the orchestrator program walks up from the current working directory to find the nearest ancestor directory containing a `.git` folder. That directory becomes `projectDir` for the duration of the run. If no git root is found, the program exits with a fatal error.

### Orchestrator Framework and Orchestrator Program

The **orchestrator framework** is a Node.js monorepo:

```
orchestrator-framework/
  package.json              # workspaces: ["packages/**"]
  node_modules/             # shared, hoisted
  packages/
    bdd-red -> /path/to/bdd-red    # symlink
    bdd-green -> /path/to/bdd-green
```

An **orchestrator program** is built on this framework and embeds a chosen set of agents. When `bf orchestrate` runs against a working repository for the first time, it performs a one-time install of all built-in repo scripts before any dispatch occurs.

### Working Repository Layout (after install)

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

### Agent Package Layout

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

### Hook Contract

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

**Script format:** `.mjs` (ES module). Executed in the orchestrator program's Node.js context via dynamic `import()`.

### Built-in Hook Specs

| Hook | Lifecycle | Type | Purpose |
|---|---|---|---|
| `validate-args` | Start | framework | Assert all required taskState fields are non-empty per declared schema |
| `snapshot-tests` | Start | framework | Hash existing test files into taskState |
| `check-new-tests` | Stop | framework | Assert at least one new test was added since snapshot |
| `lint` | Stop | repo script | Run project linter (resolved from repoConfig `linter` toolClass) |
| `format` | Stop | repo script | Run project formatter (resolved from repoConfig `formatter` toolClass) |

Framework hooks run from the orchestrator's `packages/` context. Repo scripts are loaded from the working repository's `.ai/` directory via dynamic `import()`.

### repoConfig.yaml

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

### Level Hierarchy Constraints

- Level 2 skills do not know about Level 3 task workflows.
- Level 3 task agents do not know about Level 4 orchestrators and do not read repoConfig directly.
- Level 3 agents MUST NOT embed language names, framework names, or version numbers directly in their prompt bodies.
- Level 4 orchestrator programs validate UoW `taskState` but do NOT derive or populate parameter values.
- The `tools` allowlist is enforced by the runtime harness, not the prompt.

---

## Non-Functional Requirements

1. **Parse performance:** AGENT.md parsing completes in under 100ms for files under 10KB. No I/O outside the agent directory is performed during parsing.

2. **Install idempotency:** Running `bf orchestrate` multiple times against the same working repository produces the same result. Already-present repo scripts are not overwritten. No errors are raised for already-installed scripts.

3. **Dependency resolution:** Agent hook dependency conflicts are surfaced as npm version resolution warnings at `npm install` time, not as runtime failures. The orchestrator framework's single `node_modules` is authoritative.

4. **Validation fail-fast:** `validate-args` executes before any tool calls are made. An agent must not consume tokens on a task it cannot complete.

5. **Reproducibility:** Given the same AGENT.md, the same `taskState`, and the same `projectDir`, two dispatches produce identical rendered prompts.

6. **Error clarity:** Every validation failure, hook exit-2, and parse error must name the specific field or file path that caused the failure, using dot-notation for nested fields. Generic messages are not acceptable.

7. **Observability:** The orchestrator program emits structured JSON log entries for: git root resolution, agent load, taskState validation result, hook start, hook exit (with exit code and duration), and agent dispatch. Log level is configurable.

8. **Security (tools allowlist):** The `tools` allowlist is enforced by the runtime harness. A prompt that instructs the agent to use an unlisted tool is rejected before execution.

---

## Data & Storage

### Commands

| Command | Fields |
|---|---|
| `DispatchAgent` | `agentName: string`, `projectDir: string`, `uow: UnitOfWork`, `dispatchedAt: ISO8601` |
| `RunHook` | `agentName: string`, `hookName: string`, `lifecycle: "Start" \| "Stop"`, `projectDir: string` |
| `InstallRepoScripts` | `orchestratorName: string`, `projectDir: string`, `installedAt: ISO8601` |

### Events

| Event | Fields |
|---|---|
| `AgentDispatched` | `agentName: string`, `taskStateSnapshot: Record<string, unknown>`, `renderedPromptHash: string`, `dispatchedAt: ISO8601` |
| `HookExecuted` | `agentName: string`, `hookName: string`, `lifecycle: "Start" \| "Stop"`, `exitCode: 0 \| 1 \| 2`, `stdout: string`, `durationMs: number`, `executedAt: ISO8601` |
| `AgentHalted` | `agentName: string`, `reason: string`, `haltedAt: ISO8601` |
| `TaskStateValidationFailed` | `agentName: string`, `missingFields: string[]`, `failedAt: ISO8601` |
| `RepoScriptInstalled` | `agentName: string`, `hookName: string`, `targetPath: string`, `installedAt: ISO8601` |
| `RepoScriptAlreadyPresent` | `agentName: string`, `hookName: string`, `targetPath: string`, `checkedAt: ISO8601` |

### Aggregates

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

| Projection | Question answered |
|---|---|
| `AgentSchemaView` | What taskState shape, tools, and hook contracts does a named agent declare? |
| `UoWReadinessView` | Does a given UoW's taskState satisfy the target agent's parameter schema? |
| `HookHealthView` | Which hooks have failed (exit code ≥ 1) for a given agent in the last N dispatches? |
| `RepoScriptInstallStatusView` | Which repo scripts have been installed to a given working repository, and which are missing? |
| `DispatchHistoryView` | What is the full hook timeline and outcome for a given dispatch (by UoW id)? |

### Data Retention

- `DispatchRecord` and associated events: 90 days, then archived or deleted.
- `AgentDefinition` snapshot captured at dispatch time: retained with its `DispatchRecord` for the same 90-day window.
- `package.json` hash records: retained indefinitely (required for install-skip optimization).

---

## Out of Scope

- **Level 5 meta-agent behavior:** Automated prompt improvement, token-usage instrumentation, and eval-driven skill updates are out of scope. The schema must not prevent these being added later.

- **Non-Node hook runtimes in v1:** Python, Bash, and Rust hooks are out of scope. The exit-code contract is language-agnostic and could support other runtimes in a future version.

- **Agent-to-agent calls within a Level 3 task:** Level 3 agents execute a single task. Inter-agent calls within a prompt belong to Level 4.

- **GUI or web interface for agent authoring:** Authoring is file-based (markdown + YAML).

- **Agent definition versioning:** Semantic versioning of AGENT.md files and compatibility guarantees between versions are out of scope for v1.

- **Multi-language dispatch in a single agent invocation:** Each dispatch targets one language at a time. Polyglot support comes from separate dispatches.

- **Automated Gherkin test execution for hook specs:** The `.md` Gherkin spec files are documentation and acceptance criteria only. They are not automatically parsed and run. Provided hook scripts ship with vitest unit tests; teams writing replacement implementations test against the spec on their own.

- **Scalar type enforcement in template.parameters:** The type hints (e.g., `string`) in `template.parameters` values document intent but are not enforced at runtime in v1. Validation only checks presence and non-emptiness of required fields.

- **Orchestrator responsibility for taskState derivation:** The orchestrator validates; it does not populate. Whatever produces the UoW — human, CI, or another agent — is responsible for all `taskState` values.

- **Dependency conflict isolation between agents via separate node_modules trees:** npm workspace hoisting is the conflict resolution mechanism. Per-agent isolation via Docker or separate processes is out of scope for v1.

- **Repo script upgrade path:** When a newer version of the orchestrator program ships an updated repo script, there is no automated mechanism to update already-installed copies in working repositories. Teams update repo scripts manually. A future version may introduce a hash-comparison check with an explicit overwrite command.

- **Malicious agent package supply chain:** A compromised agent package could declare arbitrary dependencies installed into the shared orchestrator `node_modules`. The v1 mitigation is developer discipline — always review agent definitions and `package.json` before installing. A future mitigation is a long-running agent process scoped to `<working-repo>/.ai/` that isolates the orchestrator process from untrusted hook code while avoiding per-invocation startup overhead. That architecture is not designed here.

---

## Dependencies and Assumptions

### Assumptions

1. The Claude Code harness enforces the `tools` allowlist at the runtime level. An agent cannot bypass it via prompt instructions.
2. `repoConfig.yaml` is committed to the working repository and readable by any process that needs it.
3. Node.js ≥24 is available in the orchestrator program's execution environment.
4. All hook scripts (framework and repo) are ES modules (`.mjs`). CommonJS is not supported.
5. The orchestrator framework is an npm workspace monorepo. `npm install` at the root resolves all agent hook dependencies.
6. `taskState` fields of type `prompt` carry the full text of a skill prompt section as a string value. The UoW producer is responsible for loading skill content and writing it as a string — not a file path.
7. A Level 3 agent is stateless between dispatches. Per-dispatch state lives in `taskState` and is threaded through hook stdin.
8. `validate-args` is the first Start hook by convention. Its absence is an authoring warning, not a parse-time fatal error.
9. When two tools share the same `toolClass` in a `repoConfig.yaml` language entry, the first listed entry is used and a warning with line numbers is emitted.
10. Repo script installation is a one-time operation performed by `bf orchestrate` on first run against a working repository. Subsequent runs are safe and idempotent.
11. `bf orchestrate` is always invoked from inside a valid git repository. The git root is the working repository; no other mechanism for specifying `projectDir` exists.
12. Absent optional Handlebars tokens render as empty string. Prompt authors guard optional sections with `{{#if}}` blocks.

### Dependencies

| Dependency | Purpose |
|---|---|
| `repoConfig.yaml` (working repo) | Toolchain declarations; read by processes that produce UoW taskState |
| Claude Code harness | Runtime enforcement of the `tools` allowlist |
| Node.js ≥24 | Hook script execution and orchestrator program runtime |
| git | Working repository root resolution (`projectDir` detection) |
| npm workspaces | Agent dependency resolution and workspace test orchestration |
| vitest (agent-level devDependency) | Running provided hook unit tests via `npm run test -ws` |
| Handlebars (or equivalent) | Prompt template rendering at dispatch time |
