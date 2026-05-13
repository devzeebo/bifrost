---
name: typescript-quality
description: |
  Fixes lint and tests, and is only allowed to use read and write commands. Hooks run the tests
isolation: none
tools: Edit, Write, Read
model: glm-4.5-air
hooks:
  SessionStart:
    - hooks:
        - type: command
          command: $CLAUDE_PROJECT_DIR/.claude/hooks/dispatch typescript quality common
  Stop:
    - hooks:
        - type: command
          command: $CLAUDE_PROJECT_DIR/.claude/hooks/dispatch typescript quality common
---

Fix the listed lint and test errors. When you fix them, quit. Do not look for more errors.