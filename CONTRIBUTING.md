# Contributing

Thanks for contributing to Bifrost.

## Layout

| Path | Role |
|------|------|
| `net/Bifrost.Domain` | Event-sourced domain: aggregates, commands, events, projections, services |
| `net/Bifrost.Api` | ASP.NET host, Wolverine HTTP endpoints, Marten wiring |
| `net/Bifrost.Domain.Tests` | Integration tests (Testcontainers Postgres + `WebApplicationFactory`) |
| `docs/` | Design and pattern documentation |

Domain work is organized by **aggregate root**. How to structure and extend an aggregate is documented in [docs/ddd-aggregate-roots.md](docs/ddd-aggregate-roots.md).

## Prerequisites

- .NET 10 SDK
- Docker (for integration tests)

## Build and test

```bash
dotnet build net/Bifrost.Api/Bifrost.Api.csproj
dotnet test net/Bifrost.Domain.Tests/Bifrost.Domain.Tests.csproj
```

Integration tests start a Postgres container; Docker must be available.

## Local API

Set a Marten connection string (for example via `ConnectionStrings:Marten` in configuration or user secrets), then:

```bash
dotnet run --project net/Bifrost.Api/Bifrost.Api.csproj
```

Commands are `POST` with a JSON body; reads use Wolverine `QUERY` endpoints. See `QUERY /commands` on a running API for the current surface.

## Domain conventions (short)

- **Commands** live under `{Aggregate}/Commands` — Wolverine handlers with a nested `Command` record. They are the public write API of the domain.
- **Services** live under `{Aggregate}/Services` — Wolverine handlers with a nested `Message` record. They are domain services (same Marten session as the calling command), not HTTP/commands.
- Fail validation with `CommandValidationException` (mapped to HTTP 400 by the API).
- Register new Marten projections / document identities in `MartenConfiguration`.
- Expose new commands from `Bifrost.Api/Endpoints/Endpoints.cs` via `IMessageBus.InvokeAsync`.

Prefer matching an existing aggregate’s shape over inventing a parallel style. Details: [docs/ddd-aggregate-roots.md](docs/ddd-aggregate-roots.md).

## Pull requests

- Keep changes focused; one concern per PR when practical.
- Include or update tests when behavior changes.
- Follow the aggregate-folder layout above for domain code.
- Do not commit secrets, connection strings with credentials, or local-only config.
