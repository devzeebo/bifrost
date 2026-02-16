# Agent Instructions

This project uses **Bifrost** for rune (issue) management in realm **bifrost**.

## Quick Reference

```bash
bf create <title>     # Create a new rune
bf list               # List runes
bf show <id>          # View rune details
bf claim <id>         # Claim a rune
bf fulfill <id>       # Mark a rune as fulfilled
bf seal <id>          # Seal (close) a rune that won't be implemented
bf update <id>        # Update a rune
bf note <id> <text>   # Add a note to a rune
bf events <id>        # View rune event history
bf ready              # List runes ready for work
```

## Dependency Commands

```bash
bf dep add <id> <relationship> <dep>     # Add a dependency to a rune
bf dep remove <id> <relationship> <dep>  # Remove a dependency from a rune
bf dep list <id>                         # List dependencies of a rune
```

Valid relationships: blocks, relates_to, duplicates, supersedes, replies_to.
Inverse forms are also accepted: blocked_by, duplicated_by, superseded_by, replied_to_by.

## Completing a Rune

**When ending a work session**, you MUST complete ALL steps below.

**MANDATORY WORKFLOW:**

1. **File runes for remaining work** — Create new runes for anything that needs follow-up
2. **Run quality gates** (if code changed) — Tests, linters, builds
3. **Update rune status** — Fulfill finished rune
4. **Commit and Push** — create a commit with your changes
   a. If there is a remote configured, push to the remote repository. Otherwise, you can skip this step
5. **Hand off** — Provide context for next session

**CRITICAL RULES:**
- NEVER stop before completing all steps above
- If quality gates fail, fix them before finishing

## Glossary

- **Rune** — a work item (issue, task, bug, etc.)
- **Saga** — an epic (a collection of related runes)
- **Realm** — a tenant namespace for organizing runes
