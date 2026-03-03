#!/bin/bash
set -e

# Entrypoint for cursor-cli runner container
# This script reads workflow/skill/rule files and runs cursor-cli agent

WORKSPACE="/workspace"
WINDSURF_DIR="$WORKSPACE/.windsurf"
WORKFLOW_FILE="$WINDSURF_DIR/workflow.md"
SKILL_FILE="$WINDSURF_DIR/skill.md"
RULES_DIR="$WORKSPACE/.cursor/rules"

# Build cursor-cli command
CURSOR_ARGS=()

# Check for workflow file
if [ -f "$WORKFLOW_FILE" ]; then
    CURSOR_ARGS+=("--workflow" "$WORKFLOW_FILE")
fi

# Check for skill file
if [ -f "$SKILL_FILE" ]; then
    CURSOR_ARGS+=("--skill" "$SKILL_FILE")
fi

# Check for rules directory
if [ -d "$RULES_DIR" ]; then
    CURSOR_ARGS+=("--rules" "$RULES_DIR")
fi

# Run cursor-cli
echo "Starting cursor-cli agent..."
if cursor-cli agent "${CURSOR_ARGS[@]}" "$@"; then
    EXIT_CODE=0
    echo "RESULT: SUCCESS"
else
    EXIT_CODE=$?
    echo "ERROR: cursor-cli exited with code $EXIT_CODE"
fi

# Report status to bifrost if callback URL is set
if [ -n "$BIFROST_CALLBACK_URL" ]; then
    echo "Reporting status to bifrost: $BIFROST_CALLBACK_URL"
    curl -s -X POST "$BIFROST_CALLBACK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"exit_code\": $EXIT_CODE, \"status\": \"$([ $EXIT_CODE -eq 0 ] && echo 'success' || echo 'failed')\"}" \
        || echo "WARNING: Failed to report status to bifrost"
fi

exit $EXIT_CODE
