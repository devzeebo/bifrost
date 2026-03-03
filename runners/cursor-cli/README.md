# Cursor CLI Runner Container

This directory contains the Docker container image for the cursor-cli runner used by Bifrost.

## Overview

The cursor-cli container is a disposable execution environment that runs cursor-cli agents with workflows, skills, and rules. It receives configuration via mounted volumes and can report status back to Bifrost via a callback URL.

## Building the Image

```bash
# From this directory
docker build -t bifrost-cursor-cli:latest .

# Or from the repository root
docker build -t bifrost-cursor-cli:latest -f runners/cursor-cli/Dockerfile runners/cursor-cli/
```

## Running the Container

### Basic Usage

```bash
docker run --rm \
  -v /path/to/workspace:/workspace \
  bifrost-cursor-cli:latest
```

### With Workflow and Skill

The container expects workflow and skill files in the workspace:

```bash
# Prepare workspace
mkdir -p /path/to/workspace/.cursor/commands
mkdir -p /path/to/workspace/.agents/skills
echo "Your workflow content" > /path/to/workspace/.cursor/commands/workflow.md
echo "Your skill content" > /path/to/workspace/.agents/skills/skill.md

# Run container
docker run --rm \
  -v /path/to/workspace:/workspace \
  bifrost-cursor-cli:latest
```

### With Callback URL

```bash
docker run --rm \
  -v /path/to/workspace:/workspace \
  -e BIFROST_CALLBACK_URL=http://bifrost-server:8080/api/v1/runners/callback \
  bifrost-cursor-cli:latest
```

## Container Structure

### Directories

- `/workspace` - Working directory (mounted from host)
- `/workspace/.cursor/commands/` - Cursor commands directory (workflows)
- `/workspace/.agents/skills/` - Skills directory
- `/workspace/.cursor/rules/` - Cursor rules directory

### Files

- `/workspace/.cursor/commands/workflow.md` - Workflow definition
- `/workspace/.agents/skills/skill.md` - Skill definition

### Environment Variables

- `BIFROST_CALLBACK_URL` - Optional URL to report execution status back to Bifrost

## Entrypoint Behavior

The `entrypoint.sh` script:

1. Checks for workflow file at `/workspace/.cursor/commands/workflow.md`
2. Checks for skill file at `/workspace/.agents/skills/skill.md`
3. Checks for rules directory at `/workspace/.cursor/rules/`
4. Runs cursor-cli agent with discovered configuration
5. Reports status to `BIFROST_CALLBACK_URL` if set
6. Exits with cursor-cli's exit code

## Output Format

The container produces output with markers:

- `RESULT: SUCCESS` - Successful execution
- `ERROR: <message>` - Execution failure

## Installed Tools

- `git` - Version control
- `node` / `npm` - Node.js runtime and package manager
- `curl` - HTTP client
- `jq` - JSON processor
- `cursor-cli` - Cursor CLI agent

## Integration with Bifrost

This container is used by the `CursorCLIRunner` in `server/runners/cursor_cli.go`. The runner:

1. Prepares the workspace with workflow and skill files
2. Builds the container spec with appropriate mounts and environment
3. Executes the container
4. Parses the output for results or errors
