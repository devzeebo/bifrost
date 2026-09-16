import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to this package root (parent of `src/` or `lib/`). */
export const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Folder of `*.Dockerfile` files for this agent. */
export const DOCKER_DIR = join(PACKAGE_ROOT, "docker");
