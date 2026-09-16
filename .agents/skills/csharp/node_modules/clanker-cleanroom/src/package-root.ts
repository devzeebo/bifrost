import { fileURLToPath } from "node:url";

/** Absolute path to the clanker-cleanroom package root (parent of `src/` or `lib/`). */
export const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
