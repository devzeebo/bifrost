# Orchestrator v2 — Documentation ↔ Implementation Gap Report

**Purpose:** Points where the design docs describe behavior the current code does not implement (or implements differently), for the author to reconcile. **No fixes applied** — observations, not prescriptions. Pure dead-code / unused-export items are kept out of the doc-gap sections and collected in §8 so the documentation audit stays focused.

**Scope:** `orchestrator-v2/docs/*` and package READMEs vs. `orchestrator-v2/packages/*/src/`, at the current `main` checkout. Each finding was read in the code; load-bearing ones were verified directly.

## Design grounding (the 8-stage maturity model)

Two design records ground this codebase (`devbox-8-stages-of-ai-maturity.pdf`, `bifrost-orchestrator-design.pdf`). They define the model `orchestrator-v2` implements: the **Trust Evolution — 8 stages** in three waves, where **layers alternate procedural / non-procedural** because _"prompts are guidance; the guarantee comes from the harness — wherever a guarantee is required, the layer must be procedural."_

| Stage | Name        | Nature         | In this repo                                                                                            |
| ----- | ----------- | -------------- | ------------------------------------------------------------------------------------------------------- |
| 3     | Task        | graded         | `agent-3-task` — one autonomous session, a single unit of work                                          |
| 4     | Workflow    | procedural     | `agent-4-workflow` (**planned**) — sequences Stage-3s with gates + adversarial review; _the_ hard layer |
| 5     | Delegate    | non-procedural | LLM picks which Stage-3/4 to run; no tools, may skip, framework-enforced kill limits                    |
| 6     | Coordinate  | procedural     | parallel Stage-5s (worktrees)                                                                           |
| 7     | Supervise   | non-procedural | consumes **telemetry from every level**, intervenes                                                     |
| 8     | Orchestrate | procedural     | structural changes to the harness itself                                                                |

**`orchestrator-v2` is the thin rebuild of Bifrost, the Stage-4 harness**, resting on two explicit premises: (1) **the iteration count moves into the task definition (default 1)**; (2) **agents may invoke a Stage-3 directly, without the grader loop.** Hence the engine is "dumb dispatch," agents are scripts, and the `TaskSource` owns readiness/dependencies/priority ("Bifrost is one task source; a Jira-JSON-blob backend is another"). Corollary: the `darker` tooling in this repo (`darker-challenger`/`-prober`/`-eye`, complexity/tier routing, TDD red/green) is a DevBox-lineage implementation of the same model — chiefly the Stage-4 adversarial-review layer.

**How this reframes findings below:**

- **G2** is not a doc/code drift but design **premise #1** — the single `engine.execute` call is intentional; the doc describes the **v1** model that looped. Re-annotated in §1.
- **Telemetry (Route A / E1, implemented)** is a **Stage-7 prerequisite** — but it lacks the branch/session attribution Stage 7 needs (new gap **T1**, below).
- **I1's blocking limitation** is the design's own open question (_"a Stage-4 must-finish blocks the framework; can-pause risks never resuming, pushing prioritization onto the higher levels"_) — a known tension, not an oversight.
- **`agent-4-workflow` unbuilt** (§6) is the hard procedural layer; the design holds **adversarial review mandatory** for it (the canonical DevBox failure: all tests green, DB fully mocked, migration missing, system dead).

**T1 (NEW, design-grounded) — telemetry has no branch/session attribution.** `ExecutionStats` carries `durationMs`/tokens/`totalCostUsd`/`numTurns` but nothing tying a run to a **work branch** or session. The design requires Stage-7 supervision telemetry to be _"session-aware and tied to a work branch — otherwise seven parallel red tasks all write to one log and you can't tell which maps to which branch."_ Route A now propagates telemetry to the task source, but without attribution it can't feed supervision. · design/telemetry · grounded-in-design

## What's solid (lead with this)

- **`docs/orchestrator.md`** and the **workspace/`docs` READMEs** are highly accurate — component names, option shapes, defaults, the RPC method table, `runner.yaml` keys, and every code example resolve against the code.
- **`docs/protocol.md`** has **no correctness gaps** (only the two minor completeness items and one clarity note in §3); the crypto / canonicalization / trust-model claims all hold, and it agrees with the protocol README.
- Config discovery, override precedence, heartbeat defaults, and error strings in the runner docs all match.

## Summary of gaps

| #   | Area                                |            Correctness            | Clarity | Minor |
| --- | ----------------------------------- | :-------------------------------: | :-----: | :---: |
| 1   | Task Agent (`agent-3-task`)         |                 0                 |    2    |   0   |
| 2   | Orchestrator                        |                 0                 |    1    |   1   |
| 3   | Protocol                            |                 0                 |    1    |   1   |
| 4   | Runner                              |                 0                 |    2    |   3   |
| 5   | Script tasks (`interfaces-task*`)   |                 2                 |    1    |   2   |
| 6   | Workflow Agent (`agent-4-workflow`) | — planned (readiness checklist) — |         |       |
| 7   | READMEs                             |                 0                 |    1    |   1   |

**2 correctness-level gaps, both in §5:** G12 (README `Task` type has the wrong field names) and G13 (`ScriptContext` doc omits the registries scripts actually use). §6 is a **planned, unbuilt** agent — a readiness checklist, not bugs. §8 lists implementation cleanup that is _not_ a documentation issue.

> **Update — implemented (Route A):** **E1** (telemetry propagation) and **G1** (failed-run session persistence) have been fixed end-to-end. Telemetry now travels as a terminal outcome to the task source, and failed runs persist their `sessionId`. Build clean, all **40 tests pass**, `vp lint` clean. Details in the Empirical validation section and §1. Changes are uncommitted.

**Legend** — _Type:_ `unimplemented` · `behavior-diverges` · `doc-stale` · `naming-mismatch` · `missing-from-doc`. _Confidence:_ `confirmed` (verified in code) · `needs-check` (interpretation-dependent).

---

## Empirical validation (live run)

Beyond static reading, I stood up a **real orchestrator + real runner + `TestEngine`** and dispatched two Task Agent tasks through the actual signed-WebSocket path — a path the test suite does **not** cover (`runner.spec` only exercises stub `"script"` agents, never `agent-3-task`). Findings:

- **The happy path works end-to-end** ✅ — signed handshake, heartbeat-gated availability, dispatch, task-agent execution against the engine, `setState`, `task.complete`.
- **G1 confirmed live → ✅ FIXED.** _Originally:_ the successful task persisted its `sessionId`; the task whose engine returned `success:false` was failed **without** persisting the returned `sessionId`. _Fix:_ `run-task-agent.ts` now persists `sessionId` **before** branching on outcome, so a failed run is resumable — re-verified live (the failed task now persists its session).
- **E1 (NEW) — telemetry is computed but never recorded → ✅ IMPLEMENTED (Route A).** _Originally:_ `runTaskAgent` returned `telemetry` in its `ScriptResult`, but the runner's dispatch handler forwarded only `{ taskId }` on `task.complete` (`dispatch-handler.ts:65`); tokens/cost/`numTurns` were dropped before reaching the task source. _Fix:_ telemetry now propagates as a **terminal outcome** — both `task.complete` and `task.fail` carry it (`dispatch-handler.ts`), the orchestrator's `ResultHandler` validates + forwards it (`readTelemetry`), and the `TaskSource` contract is widened to `completeTask(taskId, telemetry?)` / `failTask(taskId, error, telemetry?)` (`interfaces-task-source/src/types.ts`), with `ExecutionStats` unified as one canonical type in `interfaces-task-source`. Re-verified live: the source now receives telemetry on **both** success (`$0.005`) and failure (`$0.02`). · behavior-diverges · **resolved**
- **E2 (NEW) — `vp run ready` fails on a clean checkout.** From a fresh install (no `dist`), `vp run -r test` fails because cross-package `@bifrost-ai/*` imports resolve to unbuilt `dist/index.mjs` (e.g. `orchestrator.spec` can't resolve `@bifrost-ai/protocol`). The root `ready` script runs `test` **before** `build`, so `vp run ready` on a fresh clone fails at the test step. Running `vp run -r build` first makes all **40 tests pass**. · build/workflow · confirmed
- **E3 (NEW) — a task's output/message is not propagated; only telemetry is.** `task.complete` carries `{ taskId, telemetry }` and `TaskSource.completeTask(taskId, telemetry?)` records telemetry, but the task's `message` (the actual work output) is dropped — exactly as telemetry was before Route A. Surfaced by the **DAG dogfood**: chaining one task's result into a downstream task only worked because the **engine persisted its output via `ctx.setState`**; there is no built-in channel for a task's output to reach the orchestrator/source or a downstream step. This blocks output-chaining workflows and is the same shape as E1 (now fixed) but for the message. It reinforces the §6 workflow-readiness gaps: a real workflow must read child _outcomes_, not just telemetry. _(Candidate follow-up: a Route A-style extension carrying `message` on the terminal outcome, or a documented "engines persist output via setState" contract.)_ · behavior · confirmed

---

## Integration testing (architecture gaps)

A live multi-runner harness (real orchestrator + real runners + script agents) exercising paths the unit specs don't cover.

**Works correctly (no gap):** multi-runner **concurrency + back-pressure** (4 tasks / 2 runners / `maxInFlight=1` → 2 concurrent batches, ~624ms); **`maxInFlightPerPeer > 1`** (3 tasks concurrent on one runner, ~313ms); the **`paused`** terminal path; **disconnect cleanup** (orphaned task failed + slot freed); and **recovery by reconnection** — a fresh `Runner` (same identity) re-dials and resumes taking work. _(There is no **auto**-reconnect: a dropped `Runner` instance stays dropped; the app must construct a new one.)_

**I1 — No capability-aware routing; a runner's rejection is terminal.** The orchestrator dispatches each task to the _first available_ peer regardless of which agents that peer has registered (`peer-registry.ts` `getAvailablePeer`). If the chosen runner hasn't registered the task's agent, its dispatch handler replies `accepted:false` ("Unknown agent"), and `DispatchAckHandler.reject` **fails the task** (`dispatch-ack-handler.ts`) instead of re-dispatching to a capable peer. Demonstrated live: with **both** runners connected + available and only runner B registering the `special` agent, a task needing `special` was dispatched to runner A and **permanently failed** — `failTask(s1, "Unknown agent: special")` — runner B never got it. The design implicitly assumes **homogeneous runners** (every runner registers the same agents), but the per-runner `registerAgent` API permits heterogeneity and nothing documents or enforces the assumption. · behavior/architecture · confirmed

> **✅ Fixed (this session) — capability-aware routing.** Runners now advertise the `capabilityKey(agentType, agentName)` of every registered agent in their heartbeat (optional field; `protocol` owns the canonical key format). The orchestrator's `PeerRegistry` records each peer's advertised capability set, and `getAvailablePeer`/`waitForAvailablePeer` filter by the task's required capability — so a task only dispatches to a peer that can run it. **Backward compatible:** a runner that advertises nothing (e.g. the stub runners used in tests) is treated as capable-of-anything. Verified live (a task needing `special` now routes to the runner that has it instead of failing on an incapable one), guarded by a new `peer-registry.spec.ts` (2 tests). 43/43 tests pass. _Known limitation: the dispatch loop is still sequential, so a task requiring a capability that **no** connected runner advertises now **waits** (blocking later tasks) rather than fail-fast — a concurrent dispatch loop or a route-timeout is a separate follow-up._

**I2 — A mid-task runner disconnect is a terminal task failure, with no retry.** When a runner drops mid-task, the orchestrator fails the orphaned task (`failTask(taskId, "Runner disconnected")`, `result-handler.ts` `handleDisconnect`) and does not re-dispatch it. Confirmed live. Consistent with the "thin orchestrator" design (retries are meant to live at the workflow/child level per `agent-4-workflow.md`), **but that layer doesn't exist yet** (§6) — so today a transient runner blip permanently fails a bare task with no recovery anywhere in the system. · behavior/resilience · confirmed

**I3 — Task-source callbacks have no error handling; a single throw wedges the peer, leaks its slot, and escapes as an unhandled rejection.** The orchestrator's RPC handlers `await` the task source and only _then_ release the slot / respond — `handleComplete` runs `await taskSource.completeTask(...)` **before** `registry.markTerminal(...)` and `sendRpcResponse(...)` (`result-handler.ts`). A real source does DB/network I/O, so a rejecting callback is expected eventually — and when it happens: (a) `markTerminal` is skipped → the peer's in-flight slot is **leaked**, so that peer is permanently unavailable and every later task routed to it hangs on `waitForAvailablePeer`; (b) `sendRpcResponse` is skipped → the runner's terminal RPC never resolves; (c) the rejection is **unhandled** — `RpcRouter.handle` invokes `route(...)` with no `await`/`.catch` (`rpc-router.ts`), so it escapes as an unhandled promise rejection (process-fatal on default Node). Demonstrated live: a `completeTask` that threw on `f1` left the peer wedged, `f2` never dispatched, the orchestrator's `done` never resolved (timed out), and exactly one unhandled rejection surfaced. Same shape for `failTask`/`pauseTask` (slot leak) and `taskSource.setState` (hung RPC + unhandled rejection; no slot leak since it isn't terminal). · behavior/robustness · confirmed

> **✅ Fixed (this session).** The orchestrator now guards every task-source/scheduler callback. A `settle()` helper in `result-handler.ts` runs each terminal source call in `try/catch/finally`, so slot release (`markTerminal`) and the runner response **always** happen even if the source throws; `handleDisconnect`, `dispatch-ack-handler.reject`, and `rpc-router`'s `setState`/`scheduler.call` are likewise guarded; and `RpcRouter.handle` adds a `.catch` net so a rejecting handler can never escape as an unhandled rejection. Source failures are surfaced via `console.error` (not silently swallowed). Verified live — a throwing `completeTask` no longer wedges the peer (`f2` still dispatches, `done` resolves, **0** unhandled rejections) — and guarded by a new regression test (`orchestrator.spec.ts` → "does not wedge the peer when a task source callback throws"). 41/41 tests pass. _Follow-up: a real `onError` option would beat `console.error` for a library._

---

## 1. Task Agent — `docs/agent-3-task.md` ↔ `packages/agent-3-task`

The implementation is 4 small files. The core (`run-task-agent.ts`) makes a **single `engine.execute()` call** — the behaviors the doc attributes to "the agent" mostly live in the `Engine`.

### Clarity

**G1 — Session/telemetry checkpointing is engine-dependent, not agent-provided; the agent also drops a failed-result `sessionId`.**

- **Doc says:** §Running — the agent "may checkpoint progress (session ID, partial telemetry) so that if something goes wrong mid-flight, a retry can pick up where it left off"; §3 — a parent retries "with the same session id."
- **Code does:** `runTaskAgent` persists `sessionId` **only after success** (`run-task-agent.ts:53-58`); both failure exits (`:41-44` catch, `:46-51` `!success`) return without `setState` and ignore any `sessionId`/`stats` on the returned `EngineResult`. So resume after a failure is possible **only if the engine checkpoints itself** via the `setState` it's handed in `EngineContext` (`engine/src/types.ts:28`, wired at `run-task-agent.ts:37`). Accurate framing: _the doc attributes checkpointing to the agent, but the agent contributes none beyond post-success persistence and discards a `sessionId` returned on a failed result — mid-run/after-failure resume depends entirely on engine-side checkpointing._
- **Type:** behavior-diverges · **Confidence:** confirmed (**demonstrated in the live run — see Empirical validation**)
- **Status: ✅ Implemented (Route A).** `run-task-agent.ts` now persists `sessionId` _before_ the success/failure branch (failed runs are resumable) and returns telemetry on the failure path; paired with E1's propagation, a failed run's partial telemetry reaches the task source. 40/40 tests pass. _(The broader §Running "checkpointing is the agent's job" framing remains a doc-wording question; the concrete failed-run data loss is fixed.)_

**G2 — The doc's "turn loop / maximum turn limit inside the agent" describes the pre-rebuild (v1) model.** §Running describes a 5-step turn loop "inside the agent" with a "configured maximum turn limit"; `runTaskAgent` calls `engine.execute()` exactly **once** (`run-task-agent.ts:29`) — no loop or turn-limit anywhere in `agent-3-task`. This is **intended**, not a divergence: the thin-rebuild premise moves the iteration count into the task definition (**default 1**) and keeps the engine "dumb" (see _Design grounding_). The v1 orchestrator _did_ loop (`orchestrator/…/core/orchestrator.ts` `runEngineLoop`, `maxFollowUps=10`); the doc still describes that older shape. The fix is to the **doc**, not the code — and, if per-task iteration is ever wanted, it belongs in the task definition/`TaskSource`, not the agent. · doc-stale (describes v1) · confirmed

> **Undocumented contract (worth adding):** task agents register under agentType `"task"`, keyed by `agent.name` (`runner.ts:28`); dispatch resolves `agents.get(agentType).get(agentName)` (`dispatch-handler.ts:49`). A Task Agent task must be created with `agentType: "task"`, `agentName: "<agent.name>"`.

_(Two unused-artifact items from this package — `skipFulfill`, the `agentDefinition` registry registration — are in §8.)_

---

## 2. Orchestrator — `docs/orchestrator.md` ↔ `packages/orchestrator`

The most accurate doc in the set — no correctness or behavior gaps. Only completeness omissions.

### Clarity

**G3 — `orchestrator.md` doesn't enumerate the `taskSource.setState` RPC.** The doc lists `dispatch` + `task.complete`/`fail`/`pause` + `scheduler.call`, but omits `taskSource.setState`, which `RpcRouter` handles and proxies (`rpc-router.ts:308-310, 317-325`). **Note:** this is an _orchestrator-doc_ completeness issue — `docs/protocol.md:95` already documents the method in its RPC table, so it is not a globally undocumented RPC. · missing-from-doc · confirmed

### Minor

**G4 — `runOrchestrator`'s `abortSignal` option isn't in the Configuration block.** The run entry point is `OrchestratorOptions & { abortSignal?: AbortSignal }` (`orchestrator.ts:381`) and the signal drives graceful shutdown/drain-abort (`:414-436`); the doc's options block never mentions it. · missing-from-doc · confirmed

_(Dead code `isRpcResponse` is in §8.)_

---

## 3. Protocol — `docs/protocol.md` + `packages/protocol/README.md` ↔ `packages/protocol`

**No correctness gaps** — the two docs agree with each other and with code. The items below are a clarity note and a completeness omission.

### Clarity

**G5 — README's "bad base64 → false" case relies on dead error-handling.** README says `verifyEnvelope` returns `false` on "bad base64." `sign.ts:63-65` wraps `Buffer.from(sig, "base64")` in a `try/catch`, but `Buffer.from` decodes leniently and never throws, so the `catch` is unreachable. The observable result still holds (`crypto.verify` returns `false` at `sign.ts:69`) — only the implied explicit base64 handling is dead. · doc-stale · confirmed

### Minor

**G6 — Ephemeral-port discovery is undocumented.** README says `port: 0` binds an ephemeral port but never says how to learn it: `OrchestratorPeer.address = { host, port }` (`types.ts:68`, `orchestrator.ts`). The returned peer shape is never spelled out. · missing-from-doc · confirmed

> **Checked — not a gap:** the `heartbeat` frame's "keep peer alive" purpose _is_ realized — the runner sends heartbeats on a timer (`runner/src/heartbeat.ts:16`) and the orchestrator uses them for liveness (`peer-registry.ts:49,109`). Distributed across packages, not the protocol package.

_(Unused/test-only exports — `signRawMaterial`, `loadTrustedPublicKey`, `SIGNING_ALGORITHM` — are in §8.)_

---

## 4. Runner — `docs/runner.md` + `packages/runner/README.md` ↔ `packages/runner`

Docs largely accurate; gaps are documentation-completeness, no correctness.

### Clarity

**G7 — Doc says a "scheduler" is reachable over RPC, but no scheduler surface exists at the script layer.** "Task source and scheduler are reached over RPC." (`docs/runner.md:128`). The `ScriptContext` built for scripts exposes only `data`, `agents`, `setState` (`script-context.ts:24-38`); no scheduler handle, and the interface has no scheduler field. `scheduler.call` exists on the orchestrator side (see §6/G18) but nothing in the runner reaches it. Reads as a forward-reference that isn't wired. · doc-stale / unimplemented · confirmed

**G8 — The "RPC-backed ScriptContext" field table omits `agents`.** The table lists `taskId`, `agentType`, `agentName`, `taskState`, `metadata`, `data`, `setState` (`docs/runner.md:118-127`), but the context also populates `agents` (`script-context.ts:24-31`), a required interface field. · missing-from-doc · confirmed

### Minor

**G9 — Dispatch diagram omits the malformed-task rejection path.** The diagram shows only unknown-agent vs. known; code rejects a `validateTask` failure first, with a `missingTaskFields` reason (`dispatch-handler.ts:40-47`). · missing-from-doc · confirmed

**G10 — Dispatch diagram attributes signature verification to the runner; it happens in the protocol layer** (`verifyEnvelope` in the connection layer, before any subscriber). The prose trust-model section is correct, so this is diagram imprecision. · doc-stale · confirmed

**G11 — Undocumented (but live) public surface:** `RunnerOptions.abortSignal` (wired to `close()`, `runner.ts:60-64`), `Runner.getAgent`/`hasAgent` (`runner.ts:31-37`), and the `discoverConfigPath` export. · missing-from-doc · confirmed

---

## 5. Script tasks — `docs/script-tasks.md` + `packages/interfaces-task-source/README.md` ↔ `interfaces-task*`

The execution-primitive docs have drifted from the current `Task`/`ScriptContext` shapes — **both correctness gaps in this report are here.**

### Correctness

**G12 — The task-source README's `Task` type has the wrong field names.**

- **Doc says:** `Task = { id; scriptName; taskState; metadata }`, with a field table and prose "the runner uses `scriptName` to look up the script" (`interfaces-task-source/README.md:27-28, 36-37, 41, 100`).
- **Code does:** `Task = { taskId; agentType; agentName; taskState; metadata }` (`interfaces-task-source/src/types.ts:3-9`). No `id`, no `scriptName`; validation requires `["taskId","agentType","agentName"]` (`types.ts:19`), and the runner resolves by `agentType`+`agentName` (`dispatch-handler.ts:49`). Code written from this README fails `validateTask`. (The `TaskSource` _method_ signatures in the same README are correct — only the `Task` type and the `scriptName` prose are stale.)
- **Type:** naming-mismatch + behavior-diverges · **Confidence:** confirmed

**G13 — `script-tasks.md`'s `ScriptContext` omits the registries scripts actually use.**

- **Doc says:** `ScriptContext = { taskState; readonly metadata; setState }`, presented as the contract (`docs/script-tasks.md:21-24`).
- **Code does:** `ScriptContext<TData>` also has `taskId`, `agentType`, `agentName`, `readonly data: DataRegistry`, and `readonly agents: AgentRegistry` (`interfaces-task/src/types.ts:35-44`). `data` is load-bearing — the Task Agent reads `ctx.data.get(ENGINE_DATA_TYPE)` (`run-task-agent.ts:22`). The documented contract is a strict subset that would leave a reader unable to write an engine-backed agent.
- **Type:** doc-stale / missing-from-doc · **Confidence:** confirmed

### Clarity

**G14 — "`taskState` mutations persist" overstates behavior.** `docs/script-tasks.md:73` says mutations persist, but `taskState` is a getter over local state; persistence happens only inside `setState` → `Object.assign` + `rpc.call("taskSource.setState")` (`script-context.ts:32-42`). A direct `ctx.taskState` mutation without a following `setState` never goes over the wire. (The doc's own behavior table at `:42` is precise — internal tension.) · behavior-diverges · needs-check

### Minor

**G15 — "types only" claims are inaccurate — both packages ship runtime functions.** `script-tasks.md:53` calls `interfaces-task` "types only," but it exports the runtime guard `isScriptTaskDefinition` (`interfaces-task/src/types.ts:58-65`). The task-source README says "pure interface package — types only, no runtime logic" (`:150`), but it exports `validateTask`, `missingTaskFields`, `missingTaskFieldsMessage`, used by the runner (`dispatch-handler.ts:40-46`). · doc-stale · confirmed

**G16 — Modeling omissions:** `ScriptTaskDefinition`/`ScriptContext` are generic over `TData` in code but shown non-generic; `setState` semantics (it **merges** via `Object.assign` and transmits the full accumulated state) are undocumented. · missing-from-doc · needs-check

---

## 6. Workflow Agent — `docs/agent-4-workflow.md` (planned, no package)

**Status: ~0% implemented, honestly labeled "Planned (#39)"** — no `packages/agent-4-workflow`, and a repo-wide grep for `workflow`/`agent-4` finds only `docs/`. Its unbuilt state is _acknowledged_, not hidden. The value is a **readiness checklist**: the enabling mechanisms it leans on are missing or half-built.

**G17 — TaskSource lacks every capability the "schedule" step needs.** The doc has the workflow "create all child tasks, wire dependency edges, promote the ready ones, register every child as a blocker" (`agent-4-workflow.md:41-47, 82-99, 180-199`). But `TaskSource` has only `watchTasks`/`completeTask`/`failTask`/`pauseTask`/`setState` (`interfaces-task-source/src/types.ts:11-17`) — no create-child / dependency / promote / blocker method anywhere. · unimplemented · confirmed (whether these belong on the interface or inside a concrete source is `needs-check`)

**G18 — `scheduler.call` is server-side only, unconsumed, and unreachable from scripts.** The natural channel a workflow script would use. Receiving side exists (`Scheduler` type `orchestrator/src/types.ts:5`; routed at `rpc-router.ts:42,76`; required option `types.ts:13`), **but** nothing sends `scheduler.call` (grep: only `rpc-router.ts`), the only implementation is `createNoopScheduler` (`test-helpers.ts:54`), and `ScriptContext` exposes no scheduler handle. Directly connects to runner-doc gap **G7**. · unused-artifact / unimplemented · confirmed

**G19 — The doc's own "permanent child failure" trigger is marked "TO BE RESOLVED"** (`agent-4-workflow.md:201-207`) and is unimplemented — consistent with the doc. · unimplemented · confirmed

> **Correctly builds on existing primitives:** `ScriptTaskDefinition`, the child Task Agent, and the `TaskSource` streaming/outcome interface all exist; the doc's cross-links resolve.

---

## 7. READMEs — `docs/README.md` + workspace `README.md`

Highly accurate — package table, code examples, the 5-method RPC table, `runner.yaml` keys, and prerequisites all check out. Two small gaps:

### Clarity

**G20 — `ctx.data.get(type)` returns a _read-only_ registry, but the README calls it `Registry<T>`.** `README.md:58` says `get(type)` returns `Registry<T>`; the actual return is `ReadonlyRegistry<T[K]>` (`get`/`has` only, `interfaces-task/src/types.ts:23`). `Registry<T>` is a distinct mutable type with `register()` — the runner hands scripts a read-only view on purpose. Could mislead a reader into thinking a script can `.register()` into `ctx.data`. · naming-mismatch · confirmed

### Minor

**G21 — Runner dependency sentence omits `interfaces-task-source`.** `docs/README.md:78` says the runner "consumes `protocol` and `interfaces-task`," but `runner/package.json` declares `interfaces-task-source` as a third workspace dep. Not wrong, just incomplete. · doc-stale · needs-check

---

## 8. Implementation cleanup — NOT documentation gaps

Dead code / unused exports / a latent code smell surfaced during the audit. Independent of the docs; listed separately so the gap report above stays about documentation.

- **C1 — `EngineResult.skipFulfill` is never consumed.** Defined and returned by engines (`engine/src/types.ts:34`) but `runTaskAgent` never reads it.
- **C2 — The `agentDefinition` registry registration is unused on the run path.** `enrollTaskAgent` registers the `AgentDefinition` into `data[agentDefinition]` (`enroll-task-agent.ts:14`), but `runTaskAgent` uses the closured `agent`, never `ctx.data.get(AGENT_DEFINITION_DATA_TYPE)`. That registration and the `isAgentDefinition` guard are unconsumed within the package.
- **C3 — `isRpcResponse` is dead code.** Exported from `orchestrator/src/types.ts:356`, never imported/called, not re-exported from `index.ts`, and byte-identical to `isDispatchAck` — the predicate actually used (`orchestrator.ts:410`).
- **C4 — Unused / test-only protocol exports.** `signRawMaterial` (`sign.ts`, used only by a spec), `loadTrustedPublicKey` (`keys.ts`, unreferenced anywhere), and `SIGNING_ALGORITHM` — either prune or, if intended as public API, document them.
- **C5 — `protocol/src/runner.ts` references `connection` before its `const` declaration** inside the socket `error` handler. Works only because the handler fires asynchronously after initialization; a synchronous error would hit the temporal dead zone. Worth a defensive reorder.
- **C6 — Half-wired `scheduler.call` (see G18)** is dead in the current system, not just undocumented — no sender, noop-only implementation.
