# Bifrost

Event-sourced rune management service for AI agents.

![Go](https://img.shields.io/badge/Go-1.25-00ADD8?logo=go&logoColor=white)
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
docker exec -it <container> bf admin grant myuser --realm <realm-id>

# If running locally:
./bin/bf admin create-realm my-project
./bin/bf admin create-account myuser
./bin/bf admin grant myuser --realm <realm-id>
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
bf create "Fix login bug" -p 2 -d "Users can't log in"
bf list
bf claim <rune-id>
bf fulfill <rune-id>
bf seal <rune-id>
```

## Glossary

| Term      | Meaning                                        |
|-----------|-------------------------------------------------|
| **Rune**  | A work item (issue, task, bug, etc.)            |
| **Saga**  | An epic; collection of related runes            |
| **Realm** | A tenant; isolated namespace with credentials   |

## Documentation

For configuration, full CLI reference, API reference, architecture, and development instructions, see **[Developing Bifrost](docs/DEVELOPMENT.md)**.
