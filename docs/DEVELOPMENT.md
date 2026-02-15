# Developing Bifrost

## Architecture

Bifrost is built on event sourcing with a Go workspace monorepo:

| Module             | Purpose                                      |
|--------------------|----------------------------------------------|
| `core`             | Core interfaces (EventStore, ProjectionStore) |
| `domain`           | Domain logic, commands, events, projectors    |
| `providers/sqlite` | SQLite implementations of core stores         |
| `server`           | HTTP server, handlers, auth middleware         |
| `cli`              | Cobra-based CLI client                         |

## Configuration

### Server

The server is configured via environment variables:

| Variable                   | Description                          | Default          |
|----------------------------|--------------------------------------|------------------|
| `BIFROST_DB_DRIVER`        | Database driver                      | `sqlite`         |
| `BIFROST_DB_PATH`          | Path to the database file            | `./bifrost.db`   |
| `BIFROST_PORT`             | HTTP listen port (1–65535)           | `8080`           |
| `BIFROST_CATCHUP_INTERVAL` | Projection catch-up poll interval    | `1s`             |

### CLI

The CLI reads configuration from a `.bifrost.yaml` file and a credential store:

| Variable          | YAML key   | Description                | Default                  |
|-------------------|------------|----------------------------|--------------------------|
| `BIFROST_URL`     | `url`      | Server URL                 | `http://localhost:8080`  |

Authentication is managed via `bf login` / `bf logout`, which stores credentials in `~/.bifrost-credentials`.

**Config precedence** (highest wins):

1. Credential store (`bf login`)
2. Legacy `api_key` in `.bifrost.yaml` (deprecated)
3. Legacy `BIFROST_API_KEY` env var (deprecated)

Use `bf init` to create a per-repo `.bifrost.yaml` (see [CLI Usage](#cli-usage)).

## CLI Usage

The CLI binary is `bf` (or `bifrost`). All commands support `--human` for formatted output and `--json` (default) for JSON.

### Init Command

Initialize a repository for bifrost usage. Creates a `.bifrost.yaml` config file and an `AGENTS.md` template in the target directory.

```bash
# Initialize with required flags
bf init --realm <realm-name>

# Specify a custom server URL
bf init --realm my-project --url https://bifrost.example.com

# Overwrite existing files
bf init --realm my-project --force

# Initialize in a specific directory
bf init --realm my-project --dir /path/to/repo
```

| Flag         | Description                              | Default                 |
|--------------|------------------------------------------|-------------------------|
| `--realm`    | **Required.** Realm name                 | —                       |
| `--url`      | Bifrost server URL                       | `http://localhost:8080` |
| `--force`    | Overwrite existing `.bifrost.yaml`       | `false`                 |
| `--dir`      | Target directory                         | current working dir     |

The command will:
- Write `.bifrost.yaml` with `url` and `realm` fields
- Generate `AGENTS.md` from a template with the realm name and URL interpolated
- Append `.bifrost.yaml` to `.gitignore` if one exists (and the entry is not already present)
- Error if `.bifrost.yaml` already exists, unless `--force` is passed

### Rune Commands

```bash
# Create a rune
bf create "Fix login bug" -p 2 -d "Users can't log in" --parent <saga-id>

# List runes (with optional filters)
bf list --status open --priority 2 --assignee alice

# Show rune details
bf show <rune-id>

# Claim a rune (defaults to system username)
bf claim <rune-id> --as alice

# Mark a rune as fulfilled
bf fulfill <rune-id>

# Seal (close) a rune
bf seal <rune-id> --reason "completed"

# Update rune fields
bf update <rune-id> --title "New title" --priority 1

# Add a note to a rune
bf note <rune-id> --text "Started investigation"

# View event history for a rune
bf events <rune-id>

# List runes with no blockers
bf ready
```

### Dependency Commands

```bash
# Add a dependency (default type: blocks)
bf dep add <rune-id> <target-id> --type blocks

# Remove a dependency
bf dep remove <rune-id> <target-id> --type blocks

# List dependencies for a rune
bf dep list <rune-id> --human
```

Relationship types: `blocks`, `relates_to`, `duplicates`, `supersedes`, `replies_to`

### Admin Commands (Direct DB)

Admin commands operate directly on the database and do not require a running server.

```bash
# Create a realm
bf admin create-realm my-project

# List all realms
bf admin list-realms

# Create an account
bf admin create-account myuser

# Grant realm access to an account
bf admin grant myuser --realm <realm-id>

# Create an additional PAT for an account
bf admin create-pat myuser

# Suspend an account
bf admin suspend-account myuser
```

### Authentication Commands

```bash
# Log in with a PAT
bf login --url http://localhost:8080 --token <pat>

# Log out
bf logout
```

## API Reference

All endpoints return JSON. Errors use `{"error": "message"}`.

### Commands (POST) — Realm Auth

| Endpoint              | Body Fields                                              | Response          |
|-----------------------|----------------------------------------------------------|-------------------|
| `/create-rune`        | `title`, `priority`, `description?`, `parent_id?`        | `201` with rune   |
| `/update-rune`        | `id`, `title?`, `description?`, `priority?`              | `204`             |
| `/claim-rune`         | `id`, `claimant`                                         | `204`             |
| `/fulfill-rune`       | `id`                                                     | `204`             |
| `/seal-rune`          | `id`, `reason?`                                          | `204`             |
| `/add-dependency`     | `rune_id`, `target_id`, `relationship`                   | `204`             |
| `/remove-dependency`  | `rune_id`, `target_id`, `relationship`                   | `204`             |
| `/add-note`           | `rune_id`, `text`                                        | `204`             |

### Queries (GET) — Realm Auth

| Endpoint   | Query Params       | Response            |
|------------|--------------------|---------------------|
| `/runes`   | `status?`, `priority?`, `assignee?` | `200` with array |
| `/rune`    | `id`               | `200` with object   |

### Admin (POST/GET) — Admin Auth

| Endpoint             | Body / Params       | Response                        |
|----------------------|---------------------|---------------------------------|
| `POST /create-realm` | `name`             | `201` with `realm_id`           |
| `GET /realms`        | —                   | `200` with array                |

### Health

| Endpoint      | Auth | Response                    |
|---------------|------|-----------------------------|
| `GET /health` | None | `200` `{"status": "ok"}`    |

### Authentication

All authenticated endpoints require:
- `Authorization: Bearer <pat>` — a Personal Access Token
- `X-Bifrost-Realm: <realm-id>` — the target realm

The PAT must belong to an account with a grant for the requested realm. Admin endpoints require a grant for the `_admin` realm.

## Development

```bash
# Run all tests
make test

# Lint
make lint

# Build server + CLI
make build

# Build Docker image
make docker

# Clean build artifacts
make clean
```
