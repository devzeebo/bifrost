# Agent harness

Private vite-plus monorepo for an agentic loop with user-supplied tools.

- `packages/tools` — interfaces for defining custom tools
- `packages/engines` — hooks that adjust an OpenAI-compatible create call and its response
- `packages/engine-fireworks` — Fireworks `x-session-affinity` header for prompt caching
- `packages/harness` — OpenAI Responses loop and transcript
- `apps/cli` — command-line menus, help, and flags

```bash
vp install
vp run -r test
vp run @agent/cli#dev -- run "Hello" --model <model-id> --engine packages/engine-fireworks/src/index.ts

# Prompt-cache A/B (fetch vs SDK vs affinity / prompt_cache_key / multi-turn)
node scripts/fireworks-cache-test.mjs
```
