# Contributing

Thanks for contributing to Bifrost.

## Layout

| Path | Role |
|------|------|
| `net/Bifrost` | ASP.NET host + event-sourced domain: aggregates, commands, events, projections, services, Wolverine HTTP endpoints, Marten wiring |
| `net/Bifrost.Tests` | Integration tests (Testcontainers Postgres + `WebApplicationFactory`) |
| `net/Bifrost.Rpc` | `RpcHost` (listen, launch/supervise peer processes) and `RpcPeer` (connect), options, hosted services, `AddRpcHost()` / `AddRpcPeer()` |
| `net/Bifrost.Rpc.Abstractions` | `IRpcContract`, `IRpc<T>`, `IRpcBinding<T>`, `RpcBindings`, `IRpcEndpoint`, `RpcSession`, `Unit`, `AddRpc` / `AddRpcHandler` |
| `net/Bifrost.Rpc.Generators` | Source generator for contract proxies and bindings |
| `net/Bifrost.Rpc.Tests` | RPC host / peer / contract integration tests |
| `net/Bifrost.Rpc.TestPeer` | Peer executable the host launches in process-boundary tests |
| `docs/` | Design and pattern documentation |

RPC protocol: [docs/rpc.md](docs/rpc.md).

Domain work is organized by **aggregate root**. How to structure and extend an aggregate is documented in [docs/ddd-aggregate-roots.md](docs/ddd-aggregate-roots.md).

## Prerequisites

- .NET 10 SDK
- Docker (for integration tests)

## Build and test

```bash
dotnet build net/Bifrost/Bifrost.csproj
dotnet test net/Bifrost.Tests/Bifrost.Tests.csproj
```

Integration tests start a Postgres container; Docker must be available.

## Local API

Set a Marten connection string (for example via `ConnectionStrings:Marten` in configuration or user secrets), then:

```bash
dotnet run --project net/Bifrost/Bifrost.csproj
```

Commands are `POST` with a JSON body; reads use Wolverine `QUERY` endpoints. See `QUERY /commands` on a running API for the current surface.

## Domain conventions (short)

- **Commands** live under `{Aggregate}/Commands` — Wolverine handlers with a nested `Command` record. They are the public write API; expose them with `[WolverinePost]` / `EmptyResponse` on `Handle`.
- **Services** live under `{Aggregate}/Services` — Wolverine handlers with a nested `Message` record. They are domain services (same Marten session as the calling command), not HTTP/commands.
- Fail validation with `CommandValidationException` (mapped to HTTP 400 by the host).
- Register new Marten projections / document identities in `MartenConfiguration`.
- **Queries** live under `{Aggregate}/Queries` — one file per query. Get-by-id uses route `{id}` and `[Document]`.

Prefer matching an existing aggregate’s shape over inventing a parallel style. Details: [docs/ddd-aggregate-roots.md](docs/ddd-aggregate-roots.md).

## Pull requests

- Keep changes focused; one concern per PR when practical.
- Include or update tests when behavior changes.
- Follow the aggregate-folder layout above for domain code.
- Do not commit secrets, connection strings with credentials, or local-only config.
