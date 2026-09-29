# Contributing

Thanks for contributing to Bifrost.

## Layout

| Path | Role |
|------|------|
| `net/Bifrost.WorkItems.Contracts` | Shared `{Operation}Api` classes with nested `Command` / `Query` / `Response` |
| `net/Bifrost.WorkItems` | Work Item bounded context — HTTP, Marten, and Wolverine handlers. Marten schema `work_items` |
| `net/Bifrost.Orchestrator.Contracts` | Worker registration and heartbeat messages the orchestrator subscribes to |
| `net/Bifrost.Orchestrator` | Decides where work executes — HTTP, Marten, and Wolverine. Marten schema `orchestrator` |
| `net/Bifrost.WorkerNode` | Registers itself and heartbeats. Wolverine with a local SQLite outbox, no Postgres or Marten. Sends through `IBifrostBus` |
| `net/Bifrost.MessageBus.Abstractions` | `IBifrostBus`, envelopes, RPC wire contracts, provider surface |
| `net/Bifrost.MessageBus.Wolverine` | Wolverine transport over `IBifrostBus`. Hosts publish through the outbox and listen with `Handle` methods |
| `net/Bifrost.MessageBus.ZeroMq` | ZeroMQ bus sidecar deployable (`IMessageBusProvider`) |
| `net/Bifrost.MessageBus.RabbitMq` | RabbitMQ bus sidecar deployable (`IMessageBusProvider`). Compose runs this against a RabbitMQ container |
| `net/Bifrost.Tests` | All tests in one project (`Api/`, `MessageBus/`, `Rpc/`, `Support/`) |
| `net/Bifrost.Rpc` | `RpcHost` / `RpcPeer`, options, hosted services |
| `net/Bifrost.Rpc.Abstractions` | `IRpcContract`, `IRpc<T>`, `RpcSession`, `AddRpc` / `AddRpcHandler` |
| `net/Bifrost.Rpc.Generators` | Source generator for contract proxies and bindings |
| `net/Bifrost.Rpc.TestPeer` | Peer executable the host launches in process-boundary tests |
| `docs/` | Design and pattern documentation |

RPC protocol: [docs/rpc.md](docs/rpc.md).

Each context uses its own Marten schema (`work_items`, `orchestrator`) in the shared Postgres database. The worker node does not use that database; its durable outbox is a local SQLite file. The Work Item host shares a message bus sidecar over a unix-socket volume. The orchestrator and the worker each have their own sidecar. Compose connects those sidecars to RabbitMQ, which keeps a durable queue per service until the sidecar acks. Host images never reference NetMQ or RabbitMQ.Client. The ZeroMQ sidecar remains in the repo.

Domain work is organized by **aggregate root**. How to structure and extend an aggregate is documented in [docs/ddd-aggregate-roots.md](docs/ddd-aggregate-roots.md).

## Prerequisites

- .NET 10 SDK
- Docker (for integration tests)

## Build and test

```bash
dotnet build bifrost-server/bifrost-server.slnx
dotnet test bifrost-server/bifrost-server.slnx
```

Integration tests start a Postgres container; Docker must be available. API tests drop the RPC bus host so they do not need a sidecar (see `BifrostApiFactory`). The host uses RPC in production. HTTP is served by Wolverine on the work-item process.

## Full Docker topology

```bash
docker compose -f bifrost-server/docker-compose.yml up --build
```

## Domain conventions (short)

- **API contracts** live in `Bifrost.WorkItems.Contracts` as `static class {Operation}Api` with nested `Command` / `Query` / `Response`.
- **Handlers** live under `{Aggregate}/Commands` or `{Aggregate}/Queries` in the work-item host — named `{Operation}Handler`, taking the shared Api types. Writes carry `[WolverinePost]` / `EmptyResponse`. Reads carry `[WolverineQuery]`.
- Fail validation with `CommandValidationException` (work-item host) or `ContractValidationException` (value objects). Both map to HTTP 400. Inbound bus failures use error code `validation`.
- Register new Marten projections / document identities in `MartenConfiguration`.

Prefer matching an existing aggregate’s shape over inventing a parallel style. Details: [docs/ddd-aggregate-roots.md](docs/ddd-aggregate-roots.md).

## Pull requests

- Keep changes focused; one concern per PR when practical.
- Include or update tests when behavior changes.
- Follow the aggregate-folder layout above for domain code.
- Do not commit secrets, connection strings with credentials, or local-only config.
- New broker bindings belong in their own deployable referencing only `Bifrost.MessageBus.Abstractions` (peer of `Bifrost.MessageBus.ZeroMq`).
