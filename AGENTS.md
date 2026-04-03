# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Agent Instructions

# Banned Commands

You are NEVER allowed to use the following commands:

- `go test`
- `go vet`
- `go tool golangci-lint`
- `go <anything>`
- `npx`

## Acceptable Alternatives

- go commands: You MUST use the `make` command instead of any of the above commands.
- npx: You MUST use the `npm run <script-name>` command instead of any of the above commands.

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
bf note <id> <text>         # Add a note to a rune
bf retro <id>              # View retrospective for a rune or saga
bf retro <id> <text>       # Add a retro item to a rune (allowed in all states)
bf events <id>             # View rune event history
bf ready                   # List runes ready for work
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

**NEVER run `go test`, `go build`, `go vet`, or `go tool golangci-lint` directly.** Always use `make`.

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

# Before starting a task

Use `make deps` to install all dependencies so you don't get errors for missing libraries

# Before completing a task

You MUST ensure that all quality gates are passed before completing a task, including linting, testing, and building.

# NEVER USE FORCE PUSH

You are NEVER allowed to use --force or --force-with-lease. If there is a conflict on the remote, you must pull and rebase and fix it.

# Architecture

## What Bifrost Is

Bifrost is an **event-sourced rune (work item) management service** designed for AI agents. It provides rune lifecycle management, multi-tenant isolation via realms, RBAC, and a CLI + HTTP API + admin UI.

## Go Workspace Structure

7 modules in a Go workspace (`go.work`):

| Module | Purpose |
|--------|---------|
| `core` | Event sourcing primitives: EventStore, ProjectionStore, ProjectionEngine |
| `domain` | Business logic: rune commands, events, handlers, projectors |
| `domain/integration` | Integration tests for domain module |
| `providers/sqlite` | SQLite implementations of core interfaces |
| `providers/postgres` | PostgreSQL implementations of core interfaces |
| `server` | HTTP API server + admin UI embedding |
| `cli` | Cobra-based CLI client (`bf` command) |

## Event Sourcing Pattern

All state changes flow through events:

1. **Command** arrives at a domain handler (e.g., `HandleCreateRune`)
2. Handler validates and emits **Events** (e.g., `RuneCreated`)
3. Events are **appended** to EventStore (append-only, versioned per aggregate stream)
4. **ProjectionEngine** feeds events to Projectors (sync after append, async catch-up background)
5. Projectors write **read models** into ProjectionStore (key-value tables per realm)

The `_admin` realm is special — it stores accounts, PATs, and realm metadata.

## Rune Lifecycle

```
draft → [forge] → open → [claim] → claimed → [fulfill] → fulfilled
                        ↓
                       [seal] → sealed
```

## Key Projectors

| Projector | Table | Purpose |
|-----------|-------|---------|
| `RuneSummaryProjector` | `rune_summary` | List view |
| `RuneDetailProjector` | `rune_detail` | Full detail + dependencies + notes |
| `DependencyCycleCheckProjector` | `dependency_cycle_check` | Prevents circular deps |
| `AccountAuthProjector` | `account_auth` (in `_admin`) | PAT → account auth mapping |
| `RealmDirectoryProjector` | `realm_directory` (in `_admin`) | Realm metadata |

## Server Request Flow

```
Request → AuthMiddleware (JWT cookie or Bearer + X-Bifrost-Realm header)
        → RequireRole middleware (per-route minimum role)
        → Handler → Domain logic → EventStore.Append → ProjectionEngine.RunSync
        → Response
```

RBAC tiers: `viewer < member < admin < owner`. Role checked against the requesting account's role in the target realm.

## UI Architecture

React 19 + Vike (file-based router) + Tailwind CSS 4.2, located in `ui/`.

- `ui/src/pages/` — file-based routes (Vike convention)
- `ui/src/components/` — shared components
- `ui/src/lib/api.ts` — `ApiClient` wraps all HTTP calls, injects `X-Bifrost-Realm` header
- `ui/src/lib/auth.tsx` — `AuthContext` for session state (JWT via HttpOnly cookie)
- `ui/src/lib/realm.tsx` — `RealmContext` for active realm selection

The compiled UI is embedded in the server binary. During `make dev`, the Vike dev server proxies API calls to the Go server.

