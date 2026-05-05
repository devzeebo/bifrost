# Bifrost

Event-sourced rune management service for AI agents.

![CI](https://github.com/devzeebo/bifrost/actions/workflows/ci.yml/badge.svg)
![Release](https://github.com/devzeebo/bifrost/actions/workflows/release.yml/badge.svg)
![Go](https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

## Quickstart

### 1. Run the server

**Docker (recommended):**

```bash
docker build -t bifrost:latest .

docker run -d -p 8080:8080 \
  -v bifrost-data:/data \
  bifrost:latest
```

**Or build locally:**

```bash
make build
./bin/bifrost-server
```

The server listens on port **8080** by default.

### 2. Set up a realm and account

```bash
# If using Docker:
docker exec -it <container> bf admin create-realm my-project
docker exec -it <container> bf admin create-account myuser
docker exec -it <container> bf admin grant myuser <realm-id>

# If running locally:
./bin/bf admin create-realm my-project
./bin/bf admin create-account myuser
./bin/bf admin grant myuser <realm-id>
```

### 3. Authenticate

```bash
bf login --url http://localhost:8080 --token <pat>
```

### 4. Initialize a repo

```bash
bf init --realm my-project
```

This creates a `.bifrost.yaml` and `AGENTS.md` in your repo.

### 5. Start using runes

```bash
bf create "Fix login bug" -p 2 -d "Users can't log in" -b feature/fix-login
bf ready
bf claim <rune-id>
bf fulfill <rune-id>
```

### Branch tracking

Runes can be associated with a Git branch:

- **`-b, --branch <name>`** — associate a branch with the rune
- **`--no-branch`** — explicitly create a rune without a branch

Top-level runes require either `--branch` or `--no-branch`. Child runes (created with `--parent`) inherit the parent's branch by default.

## Roles

Bifrost uses per-realm role-based access control (RBAC). Each account is assigned one role per realm:

| Role       | Level | Can do                                           |
|------------|-------|--------------------------------------------------|
| `owner`    | 4     | Everything, including managing owners             |
| `admin`    | 3     | Assign/revoke roles, plus all member actions      |
| `member`   | 2     | Create and manage runes                           |
| `viewer`   | 1     | Read-only access                                  |

`bf admin grant` assigns the `member` role by default. Use `bf admin assign-role` for a specific role. See **[Developing Bifrost](docs/DEVELOPMENT.md#roles--rbac)** for full details.

## Configuration

The server loads configuration in this order (later sources override earlier):

1. **Defaults** (hardcoded)
2. **User config**: `~/.config/bifrost/server.yaml`
3. **System config**: `/etc/bifrost/server.yaml`
4. **Environment variables**

**Example `server.yaml`:**

```yaml
db_driver: postgres
db_path: postgres://user:pass@localhost/bifrost?sslmode=disable
port: 8080
catchup_interval: 1s
jwt_signing_key: your_base64_encoded_key_here
```

**Environment variables** (override config file):

| Variable                   | Description                          | Default          |
|----------------------------|--------------------------------------|------------------|
| `BIFROST_DB_DRIVER`        | Database driver (`sqlite`, `postgres`) | `sqlite`       |
| `BIFROST_DB_PATH`          | Database path/connection string      | `./bifrost.db`   |
| `BIFROST_PORT`             | HTTP listen port                     | `8080`           |
| `BIFROST_CATCHUP_INTERVAL` | Projection catch-up poll interval    | `1s`             |
| `ADMIN_JWT_SIGNING_KEY`    | JWT signing key (base64-encoded)     | generated temp   |

### JWT Authentication

The server uses JWT tokens for admin authentication. Configure the signing key using one of these methods (in priority order):

1. **Environment variable**: `ADMIN_JWT_SIGNING_KEY=your_base64_key`
2. **YAML config**: `jwt_signing_key: your_base64_key` in `server.yaml`
3. **Auto-generation**: Server generates a temporary key (sessions invalidate on restart)

Generate a secure key:
```bash
openssl rand -base64 32
```

## Arch Linux

Bifrost is available in the AUR:

- **[bifrost-go](https://aur.archlinux.org/packages/bifrost-go)** — stable releases
- **[bifrost-go-git](https://aur.archlinux.org/packages/bifrost-go-git)** — development version

```bash
# Install
yay -S bifrost-go

# Configure
sudoedit /etc/bifrost/server.yaml

# Enable and start
sudo systemctl enable --now bifrost
```

The package installs:
- `/usr/bin/bf` — CLI client
- `/usr/bin/bifrost-server` — server
- `/etc/bifrost/server.yaml` — config file (backup on upgrade)
- `/var/lib/bifrost/` — data directory

## Skills Integration

Bifrost includes a skill for AI agents that plan and execute work using Bifrost runes. The skill provides structured workflows for any agent system that supports the skills standard.

### What the Skill Does

The `bifrost-rune-workflow` skill provides structured workflows for:

- **Planning**: Create runes, group them into sagas (epics), set dependencies, and organize work
- **Execution**: Find available runes, claim them, track progress, and fulfill tasks
- **Agent Routing**: Use tags to route work to specialized agents (implementer, tester, debugger, etc.)
- **Orchestration**: Automatically dispatch ready runes to appropriate agents

### Core Concepts Covered

- Rune lifecycle (draft → forge → open → claim → fulfill → seal)
- Saga (epic) creation and child rune management
- Dependency relationships (blocks, relates_to, duplicates, supersedes, replies_to)
- Tag-based agent specialization and routing
- Branch tracking and Git integration
- Quality gates and completion workflows

### Installation

Install the skill directly from the Bifrost repository:

```bash
npx skills add https://github.com/devzeebo/bifrost/skills/bifrost-rune-workflow.md
```

This registers the skill for all detected agents and places it in `.agents/skills/bifrost-rune-workflow/skill.md`. Once installed, agents can load the skill using their skill-loading mechanism.

See the [skill documentation](./skills/bifrost-rune-workflow.md) for complete usage details, command reference, and pitfalls.

## Glossary

|| Term      | Meaning                                        |
||-----------|-------------------------------------------------|
|| **Rune**  | A work item (issue, task, bug, etc.)            |
|| **Saga**  | An epic; collection of related runes            |
|| **Realm** | A tenant; isolated namespace with credentials   |

## Documentation

For configuration, full CLI reference, API reference, architecture, and development instructions, see **[Developing Bifrost](docs/DEVELOPMENT.md)**.
