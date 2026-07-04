# Dogfood runs

Three escalating end-to-end runs of Orchestrator v2 driven by a **real engine** — the `claude` CLI,
whose JSON output (`result`, `usage`, `total_cost_usd`, `num_turns`, `session_id`) maps straight onto
`EngineResult`. Each run exercised the whole stack the way an operator would, with **real** tokens,
cost, and telemetry flowing through the [Route A](./lessons.md) pipeline.

> Reproduce the basic run: `examples/claude-engine/` (the harder/hardest runs were throwaway
> harnesses; their setup is described below).

---

## Run 1 — basic real deployment

**Setup:** generated ed25519 keys, wrote a real `runner.yaml` loaded via `new Runner({ configPath })`,
enrolled a Task Agent, registered a `claude`/haiku engine, dispatched 2 tasks.

**Exercised:** the documented `runner.yaml` onboarding path (`config-loader`, PEM parsing) — **never
covered by any test or prior harness** — plus `enrollTaskAgent`, a real engine, Route A telemetry, and
the session-id round-trip.

**Result:** both tasks completed; real telemetry reached the task source; real Claude `session_id`s
round-tripped via `setState`.

| task                                 | out tokens | turns |    cost |
| ------------------------------------ | ---------: | ----: | ------: |
| dog-1 (`"reply DOGFOOD"`)            |         61 |     1 | $0.0227 |
| dog-2 (`"describe an orchestrator"`) |        128 |     1 | $0.0153 |

**Total: $0.038.** Lesson: the untested onboarding path worked first try.

---

## Run 2 — a hand-orchestrated DAG (fan-out → aggregate)

**Setup:** two `summarize` tasks fanned out to a capability-routed **summarizer** runner (concurrent,
`maxInFlight=2`); an aggregate `release-notes` task then routed to a separate **reviewer** runner. The
task source owned the dependency gate. Engines persisted their output via `ctx.setState` so the
aggregate step could read the summaries.

**Exercised:** I1 capability routing across two specialized runners; concurrency; Route A telemetry
**roll-up** across the graph (exactly a workflow "verify-step aggregate stats").

**Result — the system wrote release notes for its own new features:**

> _"Task completion now sends execution telemetry to the backend, providing detailed performance
> metrics and better observability. Runners can validate required capabilities, ensuring tasks are
> only assigned to runners equipped to handle them."_

| task          | out tokens |        cost |
| ------------- | ---------: | ----------: |
| sum-1         |        235 |     $0.0237 |
| sum-2         |        316 |     $0.0241 |
| release-notes |        384 |     $0.0167 |
| **total**     |    **935** | **$0.0645** |

**Lesson (new gap E3):** chaining only worked because the **engine persisted each output via
`setState`**. `task.complete` carries telemetry, not the task's `message` — there is no built-in
channel for a task's output to reach the source or a downstream step. The DAG gate was hand-rolled in
the task source because the Workflow Agent (`agent-4-workflow`) doesn't exist yet.

---

## Run 3 — a 3-stage pipeline with retry + session-resume (hardest)

**Setup:** three `analyze` tasks fanned out to an **analyzer** runner (haiku, concurrent); a
**synthesizer** runner (a **sonnet** engine) combined them; a **critic** runner (haiku) reviewed the
result. Capability-routed across **three** specialized runners with **heterogeneous engines**. One
analyze task (`an-routing`) was flaky — it failed _after_ doing its work, and the task source
**retried it with `--resume`**.

**Exercised, in one run:** Route A (the telemetry below), I1 (3-way capability routing), G1 (failed-run
session persistence → resumable retry), heterogeneous per-task engine selection, concurrency, and a
task-source-owned DAG + retry policy.

### 🧾 Telemetry receipts (per attempt)

```
task          att model   outcome       in   out  cacheR    cost$     ms
------------------------------------------------------------------------
an-telemetry  1   haiku   completed     10   473   21220   0.0171   6931
an-routing    1   haiku   failed        10   531   17157   0.0253   6980
an-resilience 1   haiku   completed     10   609   17157   0.0255   7265
an-routing    2   haiku   completed     10   402   27639   0.0059   5037
synthesize    1   sonnet  completed  11202   169   23131   0.0780   3334
critique      1   haiku   completed     10   538   21220   0.0175   7613
------------------------------------------------------------------------
TOTAL                     6 calls    11252  2722  127524   0.1693  37160
```

By model: haiku — 5 calls, $0.0913 · sonnet — 1 call, $0.0780.

### ⭐ The receipt that matters — the G1 payoff

`an-routing` **failed** on attempt 1 ($0.0253, building 10,482 cache-creation tokens of context), then
resumed on retry:

> attempt 2 → **$0.0059** (cacheR: 27,639) — **4.3× cheaper**, reusing the session instead of
> re-paying to rebuild context.

Without the G1 fix (persisting `sessionId` on failure), the retry would re-do the expensive work from
scratch. The receipts make the value concrete.

### The pipeline's output (it critiqued its own design)

**Synthesis (sonnet):** _"The orchestrator matches tasks to runners by required agent capability,
avoiding wasted attempts on incapable runners, while tracking per-task execution costs and resource
usage to support operator budgeting… It isolates task-source callback failures so a hung or erroring
callback cannot crash or stall the orchestrator itself."_

**Critique (haiku):** _"The three concerns aren't truly independent — callback isolation is
foundational reliability that enables cost tracking and matching to work correctly, and cost data
should feed back into matching decisions…"_ — a genuinely sharp observation about the architecture.

---

## What the runs proved, together

- **Route A telemetry** carries real numbers end-to-end (every receipt above).
- **I1 capability routing** correctly places tasks across 1, 2, and 3 specialized runners.
- **G1** turns a failed run into a cheap resumable retry ($0.0059 vs. $0.0253).
- **The onboarding path** (`runner.yaml`) and a **real engine** both work first try.
- **E3** (task output isn't propagated) is the next thing to fix — and the hand-rolled DAG/retry is the
  argument for building `agent-4-workflow`.

Total spend across all three runs: **~$0.27**.
