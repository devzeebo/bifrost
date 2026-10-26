#!/usr/bin/env bash
set -euo pipefail

exec node apps/cli/dist/index.mjs run \
  "what is the answer to life, the universe, and everything" \
  --model glm-5p3-flash \
  --transcript-folder transcripts \
  --session sample
