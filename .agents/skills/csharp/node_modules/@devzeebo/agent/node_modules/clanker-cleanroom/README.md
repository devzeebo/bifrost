# clanker-cleanroom

Build and run coding-agent Docker images with a disposable workspace and **credentials-only** mounts.

This package is the shared runtime: `Agent`, docker orchestration, image build/registry, and a pluggable binding registry. Stock agents live in separate packages:

- [`@clanker-cleanroom/cursor`](../clanker-cleanroom-cursor)
- [`@clanker-cleanroom/claude`](../clanker-cleanroom-claude)

For Given/When/Then test steps on top of this library, see [`agent-gwt`](../agent-gwt).

## Install

```bash
pnpm add -D clanker-cleanroom
# plus the agent(s) you use:
pnpm add -D @clanker-cleanroom/cursor   # and/or @clanker-cleanroom/claude
```

## Prerequisites

1. Docker
2. Host login for the agent(s) you use (see the agent package README)

## Register an agent

Stock short names only resolve after registration:

```ts
import "@clanker-cleanroom/cursor/register";
import { Agent } from "clanker-cleanroom";

await new Agent("cursor").run({
  workspace: "/tmp/ws",
  prompt: "Write Hello to README.md",
  model: "auto",
});
```

Or call `registerBinding(name, binding)` yourself. `Agent.fromBinding(binding)` / `createAgent(binding)` never need registration.

## Build images

```ts
import "@clanker-cleanroom/cursor/register";
import { buildImages } from "clanker-cleanroom";
import { DOCKER_DIR as cursorDocker } from "@clanker-cleanroom/cursor";

await buildImages(); // base image from this package
await buildImages({ dir: cursorDocker }); // agent image from its package
```

`buildImages()` topo-sorts `*.Dockerfile` files by local `FROM` tags, builds in order, and records tags in `clanker-cleanroom.images.json` at the project root. Each entry stores the Docker tag and, when applicable, which registered stock binding to use (inferred from the `FROM` chain — register before building toolchains).

| Image                      | Package                         | Role                                        |
| -------------------------- | ------------------------------- | ------------------------------------------- |
| `clanker-cleanroom/base`   | `clanker-cleanroom`             | Shared Arch Linux base (`yay` + `aur` user) |
| `clanker-cleanroom/cursor` | `@clanker-cleanroom/cursor`     | Cursor CLI on top of the base               |
| `clanker-cleanroom/claude` | `@clanker-cleanroom/claude`     | Claude Code CLI on top of the base          |

Each Dockerfile's **first line** is the image tag:

```dockerfile
# clanker-cleanroom/cursor
FROM clanker-cleanroom/base
…
```

### Apple Silicon

The official `archlinux` image is x86_64-only. On an arm64 Docker host:

```bash
export DOCKER_DEFAULT_PLATFORM=linux/amd64
```

### Extending with toolchains

```dockerfile
# cursor:node
FROM clanker-cleanroom/cursor

USER aur
RUN yay -S --noconfirm --needed nodejs npm
USER root
```

```ts
import "@clanker-cleanroom/cursor/register";
import { buildImages } from "clanker-cleanroom";
import { DOCKER_DIR as cursorDocker } from "@clanker-cleanroom/cursor";

await buildImages();
await buildImages({ dir: cursorDocker });
await buildImages({ dir: "./docker/toolchains" });
```

The registry records `agent: "cursor"` for `cursor:node` automatically.

## Run an agent

```ts
import "@clanker-cleanroom/cursor/register";
import { Agent } from "clanker-cleanroom";

await new Agent("cursor").run({
  workspace: "/tmp/ws",
  prompt: "Write Hello to README.md",
  model: "auto",
});

await new Agent("cursor:node").run({
  workspace: "/tmp/ws",
  prompt: "Install deps and run tests",
  model: "auto",
});
```

Convenience instances live on the agent packages (`cursorAgent` / `claudeAgent` via `Agent.fromBinding`).

### Custom binding

```ts
import { Agent, type AgentBinding } from "clanker-cleanroom";

const binding: AgentBinding = {
  image: "my-agent:latest",
  displayName: "MyAgent",
  trajectoryKind: "custom",
  adaptEvents: (raw) => [/* TrajectoryEvent[] */],
  command: ({ prompt, model }) => [/* argv */],
  prepare: async () => ({ volumes: [/* … */], env: {/* docker CLI env */} }),
  parseResult: (trajectory) => ({/* AgentRunResult */}),
};

await Agent.fromBinding(binding).run({ workspace, prompt });
```

## What a run does

1. `prepare` resolves host credentials → volume mounts and/or docker-CLI env (secrets never appear on argv when using env passthrough)
2. Mounts the workspace at `/workspace`, staged input at `/agent/input` (read-only), and output at `/agent/output`, then runs as your host uid/gid
3. Invokes the agent CLI with `--output-format stream-json`, redirecting stdout to `/agent/output/trajectory` inside the container
4. Reads that trajectory file and returns `AgentRunResult` metrics from the terminal `result` event

### Input / output mounts

Each `Agent` has `input` and `output` trees (host temp dirs) bind-mounted on every run:

```ts
import "@clanker-cleanroom/cursor/register";
import { Agent } from "clanker-cleanroom";

const agent = new Agent("cursor");

await agent.input.write("spec.json", JSON.stringify({ name: "demo" }));

await agent.run({
  workspace: "/tmp/ws",
  prompt: "Read /agent/input/spec.json and write /agent/output/result.txt",
});

const result = await agent.output.readText("result.txt");
const trajectory = await agent.trajectory();
```

- **Input** is mounted read-only at `/agent/input` and persists across runs until `agent.input.clear()`
- **Output** is mounted read-write at `/agent/output` and is cleared at the start of each `run()`
- Each run streams CLI NDJSON to `/agent/output/trajectory`. Inspect with `agent.trajectory()` or `parseTrajectory(ndjson, kind, adaptEvents)`.
- Paths must be relative (no `..`); `write` accepts `string | Uint8Array`

## Isolation

- **Credentials only** — agent packages mount credentials only (no host settings/MCP/skills)
- **Non-root** — container process uses host uid/gid so workspace files are owned by you
- **Writable host mounts** — workspace (`/workspace`) and output (`/agent/output`); input is read-only

## Exports

| Export                                       | Role                                                           |
| -------------------------------------------- | -------------------------------------------------------------- |
| `Agent`                                      | `new Agent(name)` — registered stock name or registry tag      |
| `registerBinding` / `resetBindings`          | Pluggable stock binding registry                               |
| `AgentFs` / `agent.input` / `agent.output`   | Stage files for `/agent/input` (ro) and `/agent/output`        |
| `Agent.trajectory()`                         | Normalize the last run's `trajectory` NDJSON                   |
| `TRAJECTORY_FILE` / `parseTrajectory`        | Filename + shared trajectory parser (pass `adaptEvents`)       |
| `CONTAINER_INPUT` / `CONTAINER_OUTPUT`       | Container mount paths for staged I/O                           |
| `buildImages(opts?)`                         | Topo-build a Dockerfile folder (default: base image only)      |
| `createAgent(binding)` / `Agent.fromBinding` | Wrap a custom binding                                          |
| `runBoundAgent(binding, options)`            | Shared docker orchestration                                    |
| `AgentRunResult`                             | Normalized metrics; missing fields are `null`                  |
| `resolveImage` / `readRegistry`              | Read `clanker-cleanroom.images.json`                           |
| `ensureDockerImage`                          | Assert an image exists (`docker image inspect`)                |
| `buildDockerRunArgs` / `runDocker`           | Lower-level docker helpers                                     |
| `PACKAGE_ROOT`                               | Absolute path to this package (`docker/` with base lives here) |

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) and [PUBLISHING.md](../../PUBLISHING.md).
