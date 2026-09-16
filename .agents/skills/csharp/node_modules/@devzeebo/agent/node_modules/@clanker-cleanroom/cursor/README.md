# @clanker-cleanroom/cursor

Cursor CLI binding and Docker image for [`clanker-cleanroom`](../clanker-cleanroom).

## Install

```bash
pnpm add -D clanker-cleanroom @clanker-cleanroom/cursor
```

## Usage

```ts
import "@clanker-cleanroom/cursor/register";
import { Agent, buildImages } from "clanker-cleanroom";
import { DOCKER_DIR as cursorDocker, cursorAgent } from "@clanker-cleanroom/cursor";

await buildImages();
await buildImages({ dir: cursorDocker });

await new Agent("cursor").run({ workspace, prompt, model: "auto" });
// or without registration:
await cursorAgent.run({ workspace, prompt, model: "auto" });
```

## Prerequisites

Run `agent login` on the host so `~/.config/cursor/auth.json` exists.

## Exports

| Export | Role |
| --- | --- |
| `cursorBinding` | Command, prepare, parseResult, adaptEvents |
| `cursorAgent` | `Agent.fromBinding(cursorBinding)` |
| `CURSOR_IMAGE` / `CONTAINER_AUTH_PATH` | Image tag and auth mount path |
| `adaptCursorEvents` | Trajectory adapter |
| `DOCKER_DIR` / `PACKAGE_ROOT` | Dockerfile folder for `buildImages({ dir })` |
| `@clanker-cleanroom/cursor/register` | Side-effect: `registerBinding("cursor", cursorBinding)` |
