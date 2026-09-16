import { runDocker } from "./docker.js";
import type { EnsureDockerImageOptions } from "./types.js";

export async function ensureDockerImage(
  image: string,
  options: EnsureDockerImageOptions = {},
): Promise<void> {
  const dockerRunner = options.dockerRunner ?? runDocker;
  const inspect = await dockerRunner(["image", "inspect", image]);
  if (inspect.exitCode === 0) {
    return;
  }

  throw new Error(
    `Docker image ${image} not found. Call buildImages() from vitest globalSetup (or build the image manually) before running agent tests.`,
  );
}
