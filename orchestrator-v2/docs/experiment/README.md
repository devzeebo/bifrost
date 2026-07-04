# Orchestrator v2 — hardening experiment

This directory captures an exploratory session that **audited, hardened, and dogfooded** the
Orchestrator v2 rebuild. It lives on the `refactor/orchestrator-v2-hardening` branch; it is not a
merge-ready change set but a documented investigation with working code behind it.

## What's in the branch

**Code (fixes + tests, all with green build/lint and 43/43 tests):**

|               | What                                                                                                                                                           | Where                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Route A**   | Telemetry propagates engine → `ScriptResult` → RPC → `TaskSource` as a terminal outcome; `ExecutionStats` unified in `interfaces-task-source`.                 | `runner`, `orchestrator`, `interfaces-task*`, `agent-3-task`                   |
| **G1**        | A failed run persists its `sessionId` (and telemetry), so retries are resumable.                                                                               | `agent-3-task/run-task-agent.ts`                                               |
| **I3**        | A throwing task-source callback can no longer wedge a peer or escape as an unhandled rejection (`settle` / `recordBestEffort` guards + a `route().catch` net). | `orchestrator/{result-handler,rpc-router,dispatch-ack-handler,best-effort}.ts` |
| **I1**        | Capability-aware routing: runners advertise their agents in the heartbeat; the orchestrator only dispatches to a capable peer.                                 | `protocol`, `runner`, `orchestrator/peer-registry.ts`                          |
| **Packaging** | `@bifrost-ai/orchestrator`'s `./test-helpers` export fixed via `publishConfig.exports`.                                                                        | `orchestrator/package.json`, `publish.js`                                      |

Two `/simplify` passes and a runnable example (`examples/claude-engine/`) accompany the fixes.

## The documents

- **[lessons.md](./lessons.md)** — the retrospective: what shipped, what we learned, recommended next steps. Start here.
- **[gap-report.md](./gap-report.md)** — the detailed doc↔code + integration audit (findings G1–G26, I1–I3, E1–E3), with fixed items marked.
- **[dogfood-runs.md](./dogfood-runs.md)** — three escalating real-`claude`-engine runs with telemetry receipts (incl. the G1 resume payoff).

## The headline lesson

> Orchestrator v2 is a solid dispatch skeleton whose terminal boundary dropped everything but
> `taskId`. Telemetry (E1), crash-resilience (I3), and capability (I1) all had to be threaded
> deliberately — and the task's **output** (E3) still isn't. The layer that would _consume_ rich
> outcomes (`agent-4-workflow`) doesn't exist yet.

## Top follow-ups (from the lessons)

1. **E3** — propagate task output (a Route A-style change, or a documented `setState` contract).
2. Reconcile the 3 correctness-level **doc gaps** (README `Task` shape, `ScriptContext` omissions).
3. Build **`agent-4-workflow`** + a `TaskSource` read-side, so the DAG/retry we hand-rolled has a home.
