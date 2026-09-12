# Aggregate roots in Bifrost.Domain

Bifrost models the write side with **event-sourced aggregate roots**, Wolverine message handlers, and Marten for the event store and read models.

This document describes **how to work inside a single aggregate root folder**. It is the pattern to follow for every aggregate under `net/Bifrost.Domain`.

## Mental model

```
HTTP / other callers
        │
        ▼
   Command handler          ← public write intent (Commands/)
        │
        ├─ Validate
        ├─ call Services/   ← same Marten session, not a separate transaction
        └─ append events    ← StartStream or AggregateHandler
                │
                ├─ Aggregate Apply(...)     ← rebuild write-model state
                └─ Projections / documents  ← read models (inline or in-command)
```

- **Commands** are the only entry points intended for the API (or other hosts) to invoke.
- **Services** are domain operations that commands compose. They are Wolverine handlers, but they are **not** commands and must not be exposed as HTTP endpoints.
- **Events** are the source of truth. Aggregates and projections evolve from events.
- **Projections** (and some documents maintained in-command) are for queries and invariants that need denormalized lookups.

## Folder layout

Each aggregate root is a top-level folder under `Bifrost.Domain`:

```
{AggregateName}/
  Aggregate/
  Commands/
  Events/
  Projections/
  Services/        # optional — only when needed
  ValueObjects/    # optional — only when needed
```

Namespaces match folders: `Bifrost.Domain.{AggregateName}.{Layer}`.

| Layer | Required? | Responsibility |
|-------|-----------|----------------|
| `Aggregate/` | yes | Event-sourced root; state via `Apply` |
| `Commands/` | yes | Public write handlers (`Command` + `Validate` + `Handle`) |
| `Events/` | yes | Domain event records appended to the stream |
| `Projections/` | yes* | Read models and lookup documents |
| `Services/` | no | Same-session domain services (`Message` + `Handle`) |
| `ValueObjects/` | no | Small typed values owned by this aggregate |

\*An aggregate without reads yet may still introduce `Projections/` as soon as anything is queried or looked up.

Cross-cutting types that are not owned by one aggregate (for example shared enums or `CommandValidationException`) live at the `Bifrost.Domain` root, not inside an aggregate folder.

---

## Aggregate/

**What belongs here:** the aggregate root type whose stream Marten loads for writing.

**Rules:**

- One primary root type per aggregate folder.
- State is updated only through `Apply(SomeEvent e)` methods (and trivial helpers that read state, such as “does this edge exist?”).
- No I/O, no Marten sessions, no Wolverine types.
- Prefer simple mutable properties that projections and handlers can reason about (`Id`, flags like active/deleted, collections of edges, and so on).

**Naming:** file and type share the aggregate name (`Aggregate/{Name}.cs` → `{Name}`).

---

## Events/

**What belongs here:** immutable facts that have happened on this aggregate’s stream.

**Rules:**

- `public sealed record` types.
- Past-tense names (`…Created`, `…Changed`, `…Retired`, `…Deleted`).
- Use `required` / `init` properties for payload; an empty record is fine when the fact alone is enough.
- Events are the contract between commands, the aggregate, and projections — keep them stable and intentional.

**Naming:** one event type per file; file name matches the type.

---

## Commands/

**What belongs here:** Wolverine handlers that express **user/system intent** against this aggregate. This is the aggregate’s write API.

**Shape:**

```csharp
public static class DoSomethingHandler
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        // ...
    }

    public static Task Validate(Command command, /* aggregate and/or IQuerySession */)
    {
        // throw CommandValidationException on failure
    }

    // create:
    public static IStartStream Handle(Command command, IDocumentSession session) =>
        MartenOps.StartStream<TheAggregate>(command.Id, new SomethingHappened { ... });

    // or mutate:
    [AggregateHandler]
    public static MartenEvents Handle(Command command, TheAggregate aggregate, IDocumentSession session) =>
        [ new SomethingHappened { ... } ];
}
```

**Rules:**

- File name is the action (`DoSomething.cs`); type is `DoSomethingHandler`.
- Nested type is always named **`Command`** — that marks it as a public write message.
- Put validation in `Validate` (Wolverine runs it before `Handle`). Throw `CommandValidationException`.
- **Create:** return `MartenOps.StartStream<T>(…)`. Do not use `[AggregateHandler]`.
- **Mutate:** decorate `Handle` with `[AggregateHandler]`; Wolverine/Marten loads the aggregate and appends returned events.
- Return one event, or `Wolverine.Marten.Events` (`MartenEvents`) when appending several.
- Need shared write-side work (indexes, related documents)? Call a **Service** handler’s `Handle(Message, session)` with the **same** `IDocumentSession` — do not open a new unit of work.
- Cross-aggregate effects in the same transaction use the session’s event APIs (for example `FetchForWriting` + `AppendOne`) when that is part of this command’s consistency boundary.

**Do not** put non-command domain helpers here. If it is not a command, it belongs in `Services/` (or is private to the command file if trivial and one-off).

---

## Services/

**What belongs here:** domain services expressed as Wolverine handlers that **commands compose**. One service operation per file.

These are not HTTP commands and must not be registered as API endpoints.

**Shape:**

```csharp
public static class ClaimSomethingHandler
{
    public sealed record Message
    {
        // ...
    }

    public static void Handle(Message message, IDocumentSession session)
    {
        // session.Store(...) / other same-session side effects
    }
}
```

**Rules:**

- Nested type is **`Message`**, never `Command`.
- One handler class per file (one service operation).
- Always participate in the **caller’s** Marten session. Services exist to keep in-command document updates and similar work cohesive and reusable, not to start a new transaction.
- Invoke from commands by calling `SomeServiceHandler.Handle(new SomeServiceHandler.Message { ... }, session)` (or an equivalent same-session Wolverine invoke if you introduce one later).
- Prefer services when the same write-side choreography is shared by multiple commands, or when the choreography is large enough to obscure the command.

**When to skip `Services/`:** tiny, single-command private helpers can stay as `private static` methods on the command handler.

---

## Projections/

**What belongs here:** anything the read side or command validation needs that is **not** the aggregate stream itself.

Two common forms:

### 1. Marten stream projections

`SingleStreamProjection<TModel, TId>` (or related Marten projection types) with a nested `Model` record and `Create` / `Apply` methods driven by this aggregate’s events.

Register them in `MartenConfiguration` (typically `ProjectionLifecycle.Inline` in this project).

Used by query endpoints and by `Validate` when existence or denormalized state must be checked.

### 2. Documents maintained in-command

Plain document types stored via `IDocumentSession` inside a command or service (for example unique lookup indexes). These are not `SingleStreamProjection` classes, but they still live under `Projections/` because they are read/lookup models owned by the aggregate.

Configure identity mapping in `MartenConfiguration` when Marten cannot infer it.

**Rules:**

- Prefer projections for views derived purely from the event stream.
- Use in-command documents when you need strong, same-transaction invariants (uniqueness, immediate lookup) that must commit with the command’s events.
- Nest the read model as `SomethingView.Model` (or `SomethingIndex.Model`) for projection types.

---

## ValueObjects/

**What belongs here:** small immutable types that give meaning and invariants to primitive values used by this aggregate (words, identifiers with format rules, and so on).

**Rules:**

- Keep them focused: normalization, equality, validation.
- Throw `CommandValidationException` (or fail fast in construction) when a value is invalid.
- Optional folder — omit it until a real value object appears.
- Namespace should match the folder (`…ValueObjects`).

---

## Wiring outside the aggregate folder

When you add or change an aggregate’s surface:

1. **Marten** — register new projections / document identities in `MartenConfiguration`.
2. **API** — map new commands with Wolverine HTTP (`[WolverinePost]`, `EmptyResponse`, `bus.InvokeAsync(command)`). Keep query endpoints thin: load projection `Model` types from `IQuerySession`.
3. **Tests** — prefer integration coverage through the API when command + projection behavior matters together.

## Checklist: adding a new command

1. Add the domain event(s) under `Events/`.
2. Extend the aggregate with `Apply` for those events.
3. Update or add projections / lookup documents as needed; register in `MartenConfiguration`.
4. Add `Commands/{Action}.cs` with `Command`, `Validate`, and `Handle`.
5. Extract shared same-session work into `Services/` (one file per operation) when appropriate.
6. Expose the command from the API endpoints.
7. Add or extend tests.
