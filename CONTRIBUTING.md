# Contributing

Thanks for contributing to Bifrost.

## Layout

| Path | Role |
|------|------|
| `net/Bifrost.Contracts` | Shared `{Operation}Api` classes with nested `Command` / `Query` / `Response` |
| `net/Bifrost.ControlPlane` | HTTP API deployable — forwards requests over `IBifrostBus` |
| `net/Bifrost.DataPlane` | Event store deployable — Marten + Wolverine handlers, no HTTP |
| `net/Bifrost.MessageBus.Abstractions` | `IBifrostBus`, envelopes, RPC wire contracts, provider surface |
| `net/Bifrost.MessageBus.ZeroMq` | ZeroMQ bus sidecar deployable (`IMessageBusProvider`) |
| `net/Bifrost.Tests` | All tests in one project (`Api/`, `MessageBus/`, `Rpc/`, `Support/`) |
| `net/Bifrost.Rpc` | `RpcHost` / `RpcPeer`, options, hosted services |
| `net/Bifrost.Rpc.Abstractions` | `IRpcContract`, `IRpc<T>`, `RpcSession`, `AddRpc` / `AddRpcHandler` |
| `net/Bifrost.Rpc.Generators` | Source generator for contract proxies and bindings |
| `net/Bifrost.Rpc.TestPeer` | Peer executable the host launches in process-boundary tests |
| `docs/` | Design and pattern documentation |

RPC protocol: [docs/rpc.md](docs/rpc.md).

Control and data planes share a message bus sidecar over a unix-socket volume; the two sidecars bridge over ZeroMQ. Plane images never reference NetMQ.

Domain work is organized by **aggregate root**. How to structure and extend an aggregate is documented in [docs/ddd-aggregate-roots.md](docs/ddd-aggregate-roots.md).

## Prerequisites

- .NET 10 SDK
- Docker (for integration tests)

## Build and test

```bash
dotnet build bifrost-server/bifrost-server.slnx
dotnet test bifrost-server/bifrost-server.slnx
```

Integration tests start a Postgres container; Docker must be available. API tests substitute an in-process `IBifrostBus` via the test host (see `Support/LoopbackBifrostBus`) — ControlPlane always uses RPC in production.

## Full Docker topology

```bash
docker compose -f bifrost-server/docker-compose.yml up --build
```

## Domain conventions (short)

- **API contracts** live in `Bifrost.Contracts` as `static class {Operation}Api` with nested `Command` / `Query` / `Response`.
- **Handlers** live under `{Aggregate}/Commands` or `{Aggregate}/Queries` in the data plane — named `{Operation}Handler`, taking the shared Api types. No HTTP attributes.
- Fail validation with `CommandValidationException` (data plane) or `ContractValidationException` (value objects). Both map to bus error code `validation` → HTTP 400.
- Register new Marten projections / document identities in `MartenConfiguration`.

Prefer matching an existing aggregate’s shape over inventing a parallel style. Details: [docs/ddd-aggregate-roots.md](docs/ddd-aggregate-roots.md).

## Pull requests

- Keep changes focused; one concern per PR when practical.
- Include or update tests when behavior changes.
- Follow the aggregate-folder layout above for domain code.
- Do not commit secrets, connection strings with credentials, or local-only config.
- New broker bindings belong in their own deployable referencing only `Bifrost.MessageBus.Abstractions` (peer of `Bifrost.MessageBus.ZeroMq`).
