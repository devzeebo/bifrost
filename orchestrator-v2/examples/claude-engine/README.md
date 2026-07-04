# Example: a real `claude`-backed engine

Runs Orchestrator v2 as a real deployment and drives it with a **real engine** — the
[`claude` CLI](https://docs.claude.com/en/docs/claude-code). It demonstrates the pieces a
real operator wires together:

- **Key generation** and a **real `runner.yaml`** loaded via `new Runner({ configPath })`
  (the documented onboarding path — key/PEM parsing in `config-loader`).
- A **Task Agent** (`@bifrost-ai/agent-3-task`) enrolled with `enrollTaskAgent`.
- A **real `Engine`** — the whole engine contract is `execute(context, sessionId?) => Promise<EngineResult>`.
  Here it shells out to `claude -p … --output-format json` and maps the CLI's JSON
  (`result`, `usage`, `total_cost_usd`, `num_turns`, `session_id`) straight into an
  `EngineResult`, so **real token/cost/turn telemetry flows to the task source**.

The `claudeEngine` object at the top of [`run.mjs`](./run.mjs) is the reusable part — drop
your own engine in its place (a different model, a local LLM, a stub) and the rest is unchanged.

## Run it

```bash
# from the orchestrator-v2 root
vp install
vp run -r build          # the example imports the packages from dist
claude --version         # the `claude` CLI must be on PATH and authenticated

node examples/claude-engine/run.mjs
```

Expected output (two small `haiku` calls, a few cents total):

```
orchestrator listening on ws://127.0.0.1:xxxxx
  ✓ t1 completed  telemetry={in:10, out:61, turns:1, $0.02..}
  ✓ t2 completed  telemetry={in:10, out:128, turns:1, $0.01..}
done.
```

> Note: `input_tokens` looks small because Claude reports the system-prompt tokens
> separately as `cache_read_input_tokens` / `cache_creation_input_tokens` (both captured in
> `ExecutionStats`), which is why the reported cost is realistic.
