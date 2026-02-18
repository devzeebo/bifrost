# Agent Instructions

This project uses **Bifrost** for rune (issue) management in realm **bifrost**.

## Quick Reference

```bash
bf create <title>     # Create a new rune
bf forge <id>         # Forge a rune (move from draft to open)
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

## Development Commands

**ALWAYS use `make`** instead of raw `go test`, `go vet`, or `go tool golangci-lint` commands. This project is a Go workspace with multiple modules; running `go test ./...` from the root will not work correctly.

```bash
make test                              # Test all modules
make test MODULES=core                 # Test a single module
make test MODULES="core domain"        # Test multiple modules
make test MODULES=core ARGS="-v -count=1"  # Pass extra flags
make lint                              # Lint all modules
make lint MODULES=server               # Lint a single module
make vet                               # Vet all modules
make tidy                              # go mod tidy in all modules
make build                             # Build server + CLI
make build-admin-ui                    # Build Vike admin-ui for production
make dev                               # Start Go server + Vike dev server
make list                              # List available modules
```

Available modules: `core`, `domain`, `domain/integration`, `providers/sqlite`, `server`, `cli`.

**NEVER run `go test`, `go vet`, or `go tool golangci-lint` directly.** Always use `make`.

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
