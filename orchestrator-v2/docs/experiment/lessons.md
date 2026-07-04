# Orchestrator v2 — Session Retrospective & Lessons

A working session that audited, hardened, and dogfooded the Orchestrator v2 rebuild. This
captures what changed, what we learned, and where it should go next. Companion to the
detailed **[gap report](./gap-report.md)**.

---

## 1. What we shipped (all uncommitted, on the working tree)

| Area                                     | Change                                                                                                                                                                                                                                                                               | Proof                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| **Route A — telemetry propagation**      | Telemetry now flows engine → `ScriptResult` → RPC → `TaskSource` as a terminal outcome: `task.complete`/`task.fail` carry it, `ResultHandler` reads+forwards it, `TaskSource.completeTask/failTask` widened with `telemetry?`, `ExecutionStats` unified in `interfaces-task-source`. | Live demo + 40→43 tests                        |
| **G1 — failed-run session persistence**  | `run-task-agent.ts` persists `sessionId` _before_ the success/failure branch, so a failed run is resumable; returns telemetry on failure too.                                                                                                                                        | Live demo                                      |
| **I3 — task-source callback resilience** | A throwing `completeTask`/`failTask`/`pauseTask`/`setState` no longer wedges the peer (leaked slot) or escapes as an unhandled rejection. New `settle()` + `recordBestEffort()` guards; `.catch` net on `route()`.                                                                   | New `orchestrator.spec` regression test + live |
| **I1 — capability-aware routing**        | Runners advertise `capabilityKey(agentType, agentName)` in the heartbeat; the orchestrator only dispatches a task to a peer that can run it. Backward compatible (unadvertised = capable-of-anything).                                                                               | New `peer-registry.spec` + live                |
| **Packaging fix**                        | `@bifrost-ai/orchestrator` `./test-helpers` export pointed at `src` (dead in the tarball); fixed via `publishConfig.exports` + a build entry.                                                                                                                                        | `pnpm pack` verified                           |
| **Quality**                              | Two `/simplify` passes: co-located `isExecutionStats`, `errorMessage`/`isStringArray`/`recordBestEffort` helpers, DRY'd terminal handlers.                                                                                                                                           | build + lint clean                             |

Two `/simplify` rounds and a fresh **example** (`examples/claude-engine/`) were added along the way.

---

## 2. What we learned about the architecture

**The skeleton is solid.** Confirmed working under load: multi-runner concurrency + back-pressure,
`maxInFlightPerPeer > 1`, the pause path, disconnect cleanup, recovery-by-reconnection, signed
handshake, and heartbeat liveness. The protocol and the thin dispatch loop are well-built.

**The recurring lesson — the terminal boundary drops everything but `taskId`.** The orchestrator is
genuinely "thin": at task completion it moved a `taskId` and did slot accounting, and _everything
richer had to be threaded deliberately_:

- **Telemetry** was computed then dropped at `dispatch-handler` → fixed (Route A / E1).
- **A throwing callback** leaked the slot + crashed the process → fixed (I3).
- **Capability** wasn't considered → tasks failed on incapable runners → fixed (I1).
- **The task's output/message** is _still_ dropped — only telemetry rides the terminal RPC (E3, below).

So the through-line: v2 is a correct dispatch skeleton whose **outcome plumbing** needed fleshing out,
and the layer that would _consume_ rich outcomes (the Workflow Agent) **does not exist yet**.

**Open gaps (see gap report for detail):**

- **I2** — a mid-task disconnect is a terminal failure with no retry. By design for a thin
  orchestrator, but the retry layer (agent-4-workflow) isn't built, so today a transient blip
  permanently kills a task.
- **E2** — `vp run ready` fails on a clean checkout (it runs `test` before `build`; cross-package
  imports resolve to unbuilt `dist`).
- **E3** — task output isn't propagated (surfaced by the DAG dogfood; see §3).
- **Docs** — the design docs drifted from code (the `Task`/`ScriptContext` shapes in the README are
  wrong; the workflow agent is ~0% built with `scheduler.call` half-wired). 3 correctness-level doc gaps.
- A pre-existing root-`tsconfig` missing-`@types/node` lint error (unrelated to our work).

---

## 3. Dogfooding

**Basic (`examples/claude-engine`) — a real deployment.** Generated keys, a real `runner.yaml`
loaded via `Runner({ configPath })`, `enrollTaskAgent`, and a **real `claude`-CLI engine**. Two tasks
completed; real token/cost/turn telemetry reached the task source; real Claude `session_id`s
round-tripped. **The never-tested `runner.yaml` onboarding path worked first try.**

**Harder — a hand-orchestrated DAG.** Two summary tasks fanned out to a capability-routed
_summarizer_ runner (concurrently, `maxInFlight=2`), then an aggregate _release-notes_ task routed to
a separate _reviewer_ runner. Real Claude did the work; telemetry rolled up across all three tasks
($0.0645). The system wrote accurate release notes for **its own** new features.

What the harder run validated _and_ exposed:

- ✅ I1 capability routing with two real specialized runners; concurrency; Route A telemetry roll-up
  (exactly a workflow "verify-step aggregate stats").
- ⚠️ **E3 — no output propagation.** Chaining `sum-1`/`sum-2` results into `release-notes` only worked
  because the **engine persisted each output via `ctx.setState`**. `task.complete` carries telemetry,
  not the `message`. There is no built-in way for a task's output to reach the source or a downstream
  step — the same shape as the telemetry gap we fixed, but for the result.
- ⚠️ The DAG gate was **hand-rolled in the task source** because the Workflow Agent doesn't exist.
  This _is_ what agent-4-workflow is meant to own (schedule the graph, gate by deps, aggregate).
  Doing it by hand is the concrete argument for building that layer — and for a `TaskSource` that can
  read child _outcomes_ (today it's write-only: complete/fail/pause/setState).

**Hardest — a 3-stage pipeline with retry + session-resume.** Three analyses fanned out to an
_analyzer_ runner (concurrent), a _synthesizer_ runner (a **sonnet** engine) combined them, then a
_critic_ runner (haiku) reviewed the result — capability-routed across three specialized runners with
**heterogeneous engines**. One analyze task was flaky: it failed after doing its work, and the task
source **retried it with `--resume`** — attempt 2 cost **$0.0059 vs. $0.0253** (4.3× cheaper) by
reusing the session instead of rebuilding context. That is the concrete payoff of the G1 fix (failed
runs stay resumable). Per-attempt telemetry receipts and the pipeline's (self-critiquing) output are
in **[dogfood-runs.md](./dogfood-runs.md)**.

---

## 4. Recommended next steps (in priority order)

1. **E3 — propagate task output.** Either extend the terminal outcome to carry `message` (a Route
   A-style change), or make "engines persist output via `setState`" an explicit, documented contract.
   Prerequisite for any output-chaining workflow.
2. **Reconcile the docs (§5 of the gap report).** The 3 correctness-level doc gaps (README `Task`
   shape, `ScriptContext` omissions) will actively mislead new contributors.
3. **Build agent-4-workflow** — the DAG dogfood shows the hand-rolled gate is load-bearing and
   painful. It needs a read-side on `TaskSource` (read child outcomes) to aggregate.
4. **Fix E2** (build-before-test ordering / a `source` export condition) so `vp run ready` works on a
   clean clone.
5. **I2 retry policy** — decide where task-level retry lives (workflow layer vs. orchestrator).

---

## 5. Artifacts

- **Gap report:** `gap-report.md` — full doc↔code + integration findings (I1–I3, E1–E3, G1–G26).
- **Dogfood runs:** `dogfood-runs.md` — the three real-engine runs with telemetry receipts.
- **Example:** `orchestrator-v2/examples/claude-engine/` — a runnable real-engine deployment.
- **Branch:** `refactor/orchestrator-v2-hardening` — Route A + I3 + I1 + `/simplify` + the example. 43/43 tests, build + lint clean.
