---
name: bifrost-rune-workflow
description: Plan and execute work using Bifrost (bf) CLI — create runes, group into sagas (epics), set dependencies, claim, work, and fulfill runes.
category: productivity
---

# Bifrost Rune Workflow

Bifrost is an event-sourced task management system for AI agents. This skill covers two phases: **Planning** (creating runes, grouping into sagas/epics, setting dependencies) and **Execution** (finding, claiming, working, and fulfilling runes).

## Prerequisites

- `bf` CLI installed and authenticated (`bf login`)
- `.bifrost.yaml` initialized in the repo (`bf init --realm <realm>`)
- Realm configured in `.bifrost.yaml`

## Core Concepts

### Rune Types

| Type Field | Meaning |
|------------|---------|
| `rune` (default) | Standard task |
| `saga` | Epic/parent rune — groups child runes |

A saga is any rune that has children. When a rune has child runes, `bf ready --sagas` and `bf list --saga <id>` will include it. The `is_saga` filter on the server side checks for the existence of a `rune_child_count` projection entry.

### Rune Lifecycle

```
draft → [forge] → open → [claim] → claimed → [fulfill] → fulfilled
                        ↓
                       [seal] → sealed
```

- **draft** — initial state after `bf create`
- **open** — after `bf forge`, ready to be claimed
- **claimed** — someone is actively working on it
- **fulfilled** — work is complete
- **sealed** — cancelled/won't do (can have a reason)
- **shattered** — irreversible tombstone (deleted from projections)

### Dependencies

Relationships between runes:
- `blocks` / `blocked_by` — execution dependency
- `relates_to` — loose association
- `duplicates` / `duplicated_by` — one supersedes another
- `supersedes` / `superseded_by` — replaces another (auto-seals the target)
- `replies_to` / `replied_to_by` — response/feedback relationship

Cycle detection is built-in for `blocks` relationships.

### Tags

Tags are normalized to lowercase, deduplicated, and sorted. They can be used to:
- Identify specialized agents: `tester`, `implementer`, `debugger`, `ux-design`, `infra`, `security`, `documentation`
- Categorize work: `bug`, `feature`, `refactor`, `performance`
- Mark priority context: `urgent`, `nice-to-have`

Tags are set at creation with `--tag` and can be added/removed later with `bf update --add-tag` / `--remove-tag`.

### Priority

Integer 0–4, where lower is more important.

### Branch Tracking

Runes can be associated with Git branches:
- Top-level runes require `--branch` or `--no-branch`
- Child runes inherit the parent's branch by default
- Use `--branch` on child to override

---

## Phase 1: Planning

### Create a Saga (Epic)

```bash
bf create "Implement user authentication" --no-branch -p 3 --tag saga --tag feature
```

This creates a top-level saga rune. Note the `--no-branch` since sagas don't need a code branch.

### Create Child Runes Under a Saga

```bash
bf create "Add login endpoint" --parent <saga-id> -d "POST /auth/login with JWT" -p 2 --tag implementer --tag backend
bf create "Add logout endpoint" --parent <saga-id> -d "POST /auth/logout, invalidate token" -p 1 --tag implementer
bf create "Write auth integration tests" --parent <saga-id> -p 2 --tag tester
```

Child runes inherit the parent's branch (if any). They get IDs like `<saga-id>.1`, `<saga-id>.2`, etc.

### Set Dependencies

```bash
# Login must be done before logout (logout blocks nothing, login blocks logout)
bf dep add <login-id> blocks <logout-id>

# Tests are blocked by implementation
bf dep add <login-id> blocks <test-id>
# Or equivalently:
bf dep add <test-id> blocked_by <login-id>

# Mark something as related
bf dep add <rune1> relates_to <rune2>
```

### Check Dependencies

```bash
bf dep list <rune-id>          # Show all dependencies for a rune
bf dep list <rune-id> --human  # Human-readable table
bf ready                       # Shows unblocked, unclaimed runes
bf ready --human               # Table format
bf ready --sagas               # Include sagas in output
```

### View Full Plan

```bash
bf list --human                          # All runes in a table
bf list --saga <saga-id> --human         # All children of a saga
bf list --tag tester --human             # Filter by tag (agent specialization)
bf list --status open --human            # Only open runes
bf show <rune-id>                        # Full detail including deps, notes, tags
bf show <rune-id> --human                # Human-readable detail
```

### Add Notes to a Rune

```bash
bf note <rune-id> "Implementation should use refresh tokens with 7-day expiry"
```

### Update a Rune

```bash
bf update <rune-id> --title "New title"
bf update <rune-id> --description "Updated description"
bf update <rune-id> --priority 3
bf update <rune-id> --add-tag urgent
bf update <rune-id> --remove-tag nice-to-have
```

### Forge a Rune (Ready for Work)

```bash
bf forge <rune-id>     # Moves from draft → open
```

When forging a saga, all child runes are recursively forged.

---

## Phase 2: Execution

### Find Available Work

```bash
bf ready --json         # Machine-readable list of ready runes
bf ready --human        # Table view
bf ready --saga <id>    # Only runes in a specific saga
```

`bf ready` returns runes that are:
- Status: `open`
- Not blocked by unfulfilled dependencies
- Not already claimed
- Not sagas (unless `--sagas` flag)

### Claim a Rune

```bash
bf claim <rune-id>
bf claim <rune-id> --as "agent-name"   # Specify claimant
```

Only one agent can claim a rune at a time.

### Work on a Rune

During work, use these to track progress:

```bash
bf note <rune-id> "Started implementing, ran into CORS issue"
bf note <rune-id> "Fixed CORS, writing tests now"
bf retro <rune-id> "Should have designed the API contract first"
```

### Fulfill a Rune

```bash
bf fulfill <rune-id>
```

Requirements:
- Must be in `claimed` status
- Cannot fulfill sealed or shattered runes

### Seal a Rune (Cancel)

```bash
bf seal <rune-id> --reason "Out of scope"
bf seal <rune-id> --reason "Duplicate of <other-id>"
```

### Unclaim a Rune

```bash
bf unclaim <rune-id>
```

Use when work cannot proceed or is being handed off.

### Shatter a Rune (Irreversible Delete)

```bash
bf shatter <rune-id>
```

Removes the rune from all projections. Cannot be undone.

---

## Tag-Based Agent Routing

Tags are the primary mechanism for routing work to specialized agents:

| Tag Convention | Agent Role |
|----------------|-----------|
| `implementer` | Code implementation |
| `tester` | Writing and running tests |
| `debugger` | Investigating and fixing bugs |
| `ux-design` | UI/UX work |
| `infra` | Infrastructure/DevOps |
| `security` | Security review/fixes |
| `documentation` | Docs and comments |
| `reviewer` | Code review |
| `planner` | Architecture and planning |

### Workflow: Agent-Dispatched Execution

When using `bf orchestrate`, a dispatcher script receives rune data on stdin and returns a command to execute:

```bash
# Dispatch ready runes to agents
bf orchestrate --dispatcher ./dispatch.sh --once
bf orchestrate --dispatcher ./dispatch.sh --dry-run    # Preview without executing
bf orchestrate --dispatcher ./dispatch.sh --concurrency 3  # Parallel workers
```

The dispatcher script receives JSON on stdin:

```json
{
  "id": "bf-01",
  "title": "Add login endpoint",
  "description": "POST /auth/login with JWT",
  "status": "open",
  "priority": 2,
  "tags": ["implementer", "backend"],
  "notes": [...],
  "dependencies": [...]
}
```

And must return JSON on stdout:

```json
{
  "command": "python",
  "args": ["run_agent.py", "--task", "implement"],
  "env": {"AGENT_ROLE": "implementer"}
}
```

If `command` is empty, the rune is skipped and unclaimed.

---

## Quick Reference: All bf Commands

```
bf create <title>              Create a new rune
bf forge <id>                  Move rune from draft to open (recursively for sagas)
bf claim <id>                  Claim a rune for work
bf fulfill <id>                Mark a claimed rune as complete
bf seal <id>                   Cancel a rune
bf shatter <id>                Irreversibly delete a rune
bf unclaim <id>                Release a claimed rune
bf update <id>                 Modify rune properties
bf show <id>                   Show full rune details
bf list                        List all runes
bf ready                       List unblocked, unclaimed runes
bf dep add <id> <rel> <target> Add a dependency
bf dep list <id>               Show dependencies
bf dep remove <id> <rel> <target> Remove a dependency
bf note <id> <text>            Add a note
bf retro <id> [text]           Add/view retro items
bf events <id>                 Show raw event stream
bf init --realm <name>         Initialize repo for bifrost
bf orchestrate                 Poll and dispatch ready runes
bf sweep                       Clean up unreferenced sealed/fulfilled runes
```

### Common Flags

- `--human` — human-readable output (default is JSON)
- `--json` — force JSON output
- `--tag <tag>` — apply or filter by tag (repeatable)
- `--parent <id>` — create as child of another rune
- `--saga <id>` — filter by parent saga
- `--status <status>` — filter by status (open|claimed|fulfilled|sealed)
- `--priority <0-4>` — set or filter priority
- `--branch <name>` — associate with git branch
- `--no-branch` — explicitly no branch
- `--description` or `-d` — rune description

---

## Pitfalls

- **Cannot claim draft runes** — must `bf forge` first
- **Cannot fulfill unclaimed runes** — must claim first
- **Top-level runes require --branch or --no-branch** — child runes inherit parent branch
- **`bf dep add` with `blocked_by` is inverse** — `bf dep add A blocked_by B` creates `B blocks A`
- **Tags are case-insensitive** — all normalized to lowercase
- **`supersedes` auto-seals the target** — adding this relationship automatically seals the superseded rune
- **Shattered runes are tombstones** — they cannot be recreated with the same ID
- **`bf forge` on a saga recursively forges all children** — including shattered ones (skipped silently)
- **`bf ready` excludes sagas by default** — use `--sagas` to include them
- **Only one rune can be in_progress at a time** — follow the workflow: claim → work → fulfill before claiming another
