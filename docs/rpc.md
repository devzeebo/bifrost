# Bifrost RPC protocol

Bifrost RPC speaks **JSON-RPC 2.0** over a **Unix domain socket** (AF_UNIX file socket), using **newline-delimited JSON** (NDJSON): one UTF-8 JSON object per line, no pretty-printing.

## Topology

- The **host** (`RpcHost`) binds and listens on a single socket path.
- Each **instance** (primary or shadow) connects with its own stream via `RpcPeer`.
- Instances do not talk to each other.
- Both sides communicate through one concrete type: **`RpcSession`** (`Bifrost.Rpc.Abstractions`).
- `RpcHost` and `RpcPeer` both implement **`IRpcEndpoint`**, so contract registration is identical on either side.

### Shadow ops routing

| Direction                       | Behavior                                                                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Host → instances (request)      | Host calls through `IRpcEndpoint.GroupSession`, a **multiplex** `RpcSession` that **broadcasts** to all connected instances and **returns only the primary** response. Shadow responses are drained and discarded. |
| Host → instances (notification) | Broadcast to all; no response expected.                                                                                                                                                                            |
| Instance → host (request)       | Handled on that instance's `RpcSession`; reply is **point-to-point**.                                                                                                                                              |
| Instance → host (notification)  | Host handles; no reply.                                                                                                                                                                                            |

Exactly one instance is configured as `primary`. There is no automatic failover in v1. `GroupSession` resolves its members per call, so it stays valid across reconnects and surfaces a missing primary as error `-32001` at invoke time.

## Contracts (`IRpcContract`)

Define an interface that extends `IRpcContract`. The source generator emits a proxy, an `IRpcBinding<T>`, and a module initializer that registers the binding in `RpcBindings`:

```csharp
public interface IWorkRunner : IRpcContract
{
    Task<RunResult> Run(RunRequest request, CancellationToken ct = default);
}
```

- RPC method name: `{InterfaceName}.{MethodName}` verbatim (`IWorkRunner.Run`).
- Override with `[RpcMethod("custom.name")]`.
- Return-type convention:
  - `Task` / `ValueTask` → JSON-RPC **notification** (fire-and-forget)
  - `Task<T>` / `ValueTask<T>` → JSON-RPC **request** (await response)
  - `Task<Unit>` / `ValueTask<Unit>` → awaitable request with no result payload
- Params are a JSON object with **named properties** matching parameter names.

Any assembly that declares contracts must reference `Bifrost.Rpc.Generators` as an analyzer. That happens automatically for package consumers; inside this repo it is an explicit `ProjectReference` with `OutputItemType="Analyzer"`, because analyzers do not flow transitively through project references.

## Dependency injection

Both sides use the same two registrations. `AddRpcHost` / `AddRpcPeer` decides which endpoint they bind to.

```csharp
// Host process
services.AddRpcHost(options =>
{
    options.Instances =
    [
        new RpcInstanceOptions { Id = "primary", Role = RpcRole.Primary, Executable = "./runner" },
        new RpcInstanceOptions { Id = "shadow", Role = RpcRole.Shadow, Executable = "./runner-next" },
    ];
});

// Peer process — reads --bifrost-socket / BIFROST_SOCKET and friends
services.AddRpcPeer();
```

| Registration                                  | Effect                                                                                                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AddRpc<TContract>()`                         | `IRpc<TContract>` (singleton) calls the group: broadcast, primary response. `IEnumerable<IRpc<TContract>>` (transient) yields one handle per currently connected instance. |
| `AddRpcHandler<TContract, TImplementation>()` | Registers the implementation and serves inbound calls with it. Use `AddRpcHandler<TContract>()` when the implementation is already registered.                             |

```csharp
sealed class Scheduler(IRpc<IWorkRunner> rpc)
{
    readonly IWorkRunner _runner = rpc.Object;   // generated proxy over the socket
}
```

Handlers are attached to each session **before** its read loop starts, so an inbound call can never race registration.

## Launch contract

The host passes connection info via argv and environment (both are set):

| Purpose     | Argv                             | Environment           |
| ----------- | -------------------------------- | --------------------- |
| Socket path | `--bifrost-socket <path>`        | `BIFROST_SOCKET`      |
| Instance id | `--bifrost-instance-id <id>`     | `BIFROST_INSTANCE_ID` |
| Role        | `--bifrost-role primary\|shadow` | `BIFROST_ROLE`        |

## Handshake

After connect, the peer **must** send:

```json
{
  "jsonrpc": "2.0",
  "method": "bifrost.ready",
  "params": { "instanceId": "primary", "role": "primary" },
  "id": "1"
}
```

The host replies with a normal JSON-RPC result (e.g. `{"ok":true}`). The host rejects unknown `instanceId` values. `RpcPeer` retries the dial until its connect timeout, since a launched process can be ready before the host finishes binding.

## Well-known methods

| Method             | Direction   | Kind         | Notes                                 |
| ------------------ | ----------- | ------------ | ------------------------------------- |
| `bifrost.ready`    | peer → host | request      | Required after connect                |
| `bifrost.shutdown` | host → peer | notification | Host is stopping; peer should exit    |
| `bifrost.ping`     | either      | request      | Liveness; answered with `{"ok":true}` |

These are reserved; contracts must not claim them. `RpcMethods` holds the constants.

## Framing

- One JSON-RPC message per line, terminated by `\n`
- Request `id` may be string or number; multiplex broadcasts reuse the same `id` string per connection
- Correlation is always per-connection

## Error codes

Standard JSON-RPC codes, plus:

| Code     | Meaning             |
| -------- | ------------------- |
| `-32001` | Primary unavailable |
| `-32002` | Endpoint not ready  |
| `-32003` | Process failed      |

## Shutdown

1. Host sends `bifrost.shutdown` notification on each connection
2. `AddRpcPeer` wires that to `IHostApplicationLifetime.StopApplication()`
3. Host waits briefly, then kills remaining processes
4. Host unlinks the socket file

## Packages

| Package                    | Role                                                                                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Bifrost.Rpc.Abstractions` | `IRpcContract`, `IRpc<T>`, `IRpcBinding<T>`, `RpcBindings`, `IRpcEndpoint`, `IRpcSubscription`, `RpcSession`, `Unit`, `[RpcMethod]`, connection keys, `AddRpc` / `AddRpcHandler` |
| `Bifrost.Rpc`              | `RpcHost` (listen, launch, supervise) and `RpcPeer` (connect), options, hosted services, `AddRpcHost()` / `AddRpcPeer()`                                                         |
| `Bifrost.Rpc.Generators`   | Source generator (analyzer)                                                                                                                                                      |

A contracts-only library can reference `Bifrost.Rpc.Abstractions` plus the generator without pulling in process supervision. Both runtime packages live in the single `Bifrost.Rpc` namespace, so consumers need one `using`.

Non-.NET peers only need to implement connect + NDJSON JSON-RPC as described above.
