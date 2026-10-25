# Agent harness

Private vite-plus monorepo for an agentic loop with user-supplied tools.

- `packages/tools` — interfaces for defining custom tools
- `packages/harness` — OpenAI Responses loop and transcript
- `apps/cli` — command-line menus, help, and flags

```bash
vp install
vp run -r test
vp run @agent/cli#dev -- run "Hello" --model <model-id>
```
