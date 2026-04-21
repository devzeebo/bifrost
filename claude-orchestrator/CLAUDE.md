# Claude Orchestrator

Uses the Claude Agent SDK (https://code.claude.com/docs/en/agent-sdk/overview)
to create an orchestrator. This orchestrator will receive a Rune description
via stdin:

```json
{"branch":"feat/test","created_at":"2026-04-10T20:23:37.222802Z","dependencies_count":0,"dependents_count":0,"id":"bf-7165","priority":0,"status":"open","tags":["worker:decompose"],"title":"Test Rune","type":"rune","updated_at":"2026-04-10T21:06:30.945272Z"}
```

We should extract the expected Agent from the tags such that
"worker:<agent-name>" invokes the "<agent-name>" agent via the Claude Code SDK,
and then wait for the completion.

# Architecture

Latest python, uv, always use latest packages
