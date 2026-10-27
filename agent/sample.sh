#!/usr/bin/env bash
set -euo pipefail

exec node apps/cli/dist/index.mjs run \
  "Calculate a few random numbers between 100 and 200. then, write a story about them." \
  --model glm-5p3-flash \
  --transcript-folder .transcripts \
  --session sample \
  --tools packages/tool-random-number/src/index.ts \
  --engine packages/engine-fireworks/src/index.ts
