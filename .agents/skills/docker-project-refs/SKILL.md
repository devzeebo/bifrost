---
name: docker-project-refs
description: >-
  Keep domain Dockerfiles in sync with .csproj ProjectReferences. Use when adding
  a new .csproj, changing ProjectReference entries, editing a Dockerfile under
  net/, or when a Docker build fails because a referenced project was not found.
---

# Docker project references

Domain images copy dependency projects **explicitly**. A local `dotnet build`
succeeding does **not** mean the image will build.

## When this applies

- Add/remove/rename a project under `net/`
- Add/remove/change `<ProjectReference>` in a `.csproj`
- Add a new publishable service with a `Dockerfile`
- Docker/`docker compose` errors like `Skipping project ... because it was not found` or `MSB9008`

## Checklist

1. Identify every publishable project whose dependency graph changed (walk `<ProjectReference>` transitively).
2. Open that project's `Dockerfile` (next to the `.csproj`, or as referenced from `bifrost-server/docker-compose.yml`).
3. Ensure every referenced project directory has a matching `COPY` **before** `dotnet publish`, e.g.:

   ```dockerfile
   COPY net/Infrastructure/Bifrost.Ai net/Infrastructure/Bifrost.Ai
   ```

4. Copy **transitive** deps too (if A→B→C and the image builds A, COPY B and C).
5. If the project is new and compose-hosted, add it to `bifrost-server/docker-compose.yml` and `bifrost-server/bifrost-server.slnx` when appropriate.
6. Verify with a build from the repo root:

   ```bash
   docker build -f net/Domains/<Service>/Dockerfile -t <service>-test .
   ```

## Current image owners

| Dockerfile | Publishes |
|---|---|
| `net/Domains/Bifrost.Skills/Dockerfile` | Skills |
| `net/Domains/Bifrost.Orchestrator/Dockerfile` | Orchestrator |
| `net/Domains/Bifrost.WorkItems/Dockerfile` | WorkItems |
| `net/Domains/Bifrost.Workflows/Dockerfile` | Workflows |
| `net/Domains/Bifrost.WorkerNode/Dockerfile` | WorkerNode |
| `net/Infrastructure/Bifrost.MessageBus.RabbitMq/Dockerfile` | Message bus |

## Do not

- Assume the whole `net/` tree is in the build context for compile — only `COPY`ed paths are
- Fix only the leaf project and skip Infrastructure/Contracts deps
