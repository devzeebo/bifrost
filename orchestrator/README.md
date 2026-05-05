# Orchestrator Monorepo

Python monorepo for task orchestration with pluggable engines and task sources.

## Packages

### Core
- **`orchestrator`** - Core orchestration logic (task lifecycle, hooks, coordination)
- **`interface-engine`** - Abstract engine interface
- **`interface-tasks`** - Abstract task source interface

### Implementations
- **`engine-claude-code`** - Claude Code CLI engine implementation
- **`tasks-bifrost`** - Bifrost API task source implementation

## Structure

```
orchestrator/
├── pyproject.toml         # Workspace root
├── packages/
│   ├── orchestrator/      # Core orchestration logic
│   ├── interface-engine/  # Engine interface
│   ├── interface-tasks/   # Task source interface
│   ├── engine-claude-code/ # Claude Code engine
│   └── tasks-bifrost/     # Bifrost task source
└── scripts/
    ├── dispatcher.py      # Agent routing script
    └── agent.py           # Agent entry point
```

## Development

### Setup

```bash
cd orchestrator
uv sync
```

### Running Agents

```python
from orchestrator.core import load_config, create_task_source, create_engine

# Load configuration from .bifrost.yaml
config = load_config()

# Create task source and engine from config
task_source = create_task_source(config.task_source)
engine = create_engine(config.engine)

# Use with orchestrator
async for task in task_source.watch_tasks():
    result = await engine.execute(context, task_data)
```

### Running Agents (CLI)

```bash
# List available agents
./scripts/dispatcher.py --list-agents

# Run an agent (via dispatcher)
echo '{"rune": {...}, "cwd": "/path/to/project"}' | ./scripts/dispatcher.py

# Run an agent directly
echo '{"rune": {...}, "cwd": "/path/to/project"}' | ./scripts/agent.py <agent-name>
```

## Configuration

Configuration is read from `.bifrost.yaml` in your project root:

```yaml
orchestrate:
  task_source:
    type: bifrost
    settings:
      base_url: http://localhost:8000
      poll_interval: 10

  engine:
    type: claude-code
    settings:
      claude_dir: ~/.claude

  concurrency: 1
```

See `.bifrost.yaml.example` for full options.

## Architecture

The orchestrator follows a plugin architecture:

1. **Orchestrator** - Coordinates the task lifecycle
   - Runs pre-execution hooks (RuneStart)
   - Executes task via Engine
   - Runs post-execution hooks (RuneStop)
   - Handles follow-up retry loop

2. **Engine** - Executes tasks using some mechanism
   - Takes a task (rune) and executes it
   - Returns typed result with telemetry

3. **Task Source** - Provides tasks to the orchestrator
   - Watches for ready tasks
   - Handles claiming/unclaiming/fulfilling

## Extending

### Adding a New Engine

1. Create a new package (e.g., `engine-custom`)
2. Implement the `Engine` interface from `interface-engine`
3. Add as dependency to orchestrator

### Adding a New Task Source

1. Create a new package (e.g., `tasks-github`)
2. Implement the `TaskSource` interface from `interface-tasks`
3. Use with the orchestrator
