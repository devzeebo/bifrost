import { join } from "node:path";

import { runDocker } from "../agents/docker.js";
import { PACKAGE_ROOT } from "../package-root.js";
import type { DockerRunner } from "../agents/types.js";
import { topoSort } from "./graph.js";
import { inferAgent } from "./infer-agent.js";
import { parseDockerfiles, type DockerfileEntry } from "./parse.js";
import {
  readRegistry,
  upsertRegistryEntry,
  type ImageRegistry,
  type RegistryOptions,
} from "./registry.js";

export type BuildImagesOptions = RegistryOptions & {
  /** Folder of `*.Dockerfile` files. Defaults to this package's `docker/`. */
  dir?: string;
  dockerRunner?: DockerRunner;
  /** When true, rebuild even if the registry and local image already exist. */
  force?: boolean;
};

const inFlight = new Map<string, Promise<void>>();

export function resetBuildMemo(): void {
  inFlight.clear();
}

/**
 * Scan a Dockerfile folder, topo-sort by local FROM tags, build each image, and
 * record tags in `clanker-cleanroom.images.json` at packageRoot (default cwd).
 */
export async function buildImages(options: BuildImagesOptions = {}): Promise<void> {
  const dir = options.dir ?? join(PACKAGE_ROOT, "docker");
  const packageRoot = options.packageRoot ?? process.cwd();
  const force = options.force === true;
  const dockerRunner = options.dockerRunner ?? runDocker;
  const memoKey = `${dir}::${packageRoot}::${force}`;

  const existing = inFlight.get(memoKey);
  if (existing !== undefined) {
    return existing;
  }

  const pending = doBuild(dir, packageRoot, force, dockerRunner).catch((error: unknown) => {
    inFlight.delete(memoKey);
    throw error;
  });

  inFlight.set(memoKey, pending);
  return pending;
}

async function doBuild(
  dir: string,
  packageRoot: string,
  force: boolean,
  dockerRunner: DockerRunner,
): Promise<void> {
  const entries = topoSort(parseDockerfiles(dir));
  const localByTag = new Map(entries.map((entry) => [entry.tag, entry]));
  let registry = readRegistry({ packageRoot });

  for (const entry of entries) {
    if (!force) {
      const recorded = registry.images[entry.tag];
      if (recorded !== undefined) {
        const inspect = await dockerRunner(["image", "inspect", entry.tag]);
        if (inspect.exitCode === 0) {
          process.stderr.write(`[clanker-cleanroom] Docker image ${entry.tag} already present\n`);
          continue;
        }
      }
    }

    process.stderr.write(`[clanker-cleanroom] Building Docker image ${entry.tag}...\n`);

    const build = await dockerRunner(
      ["build", "--progress=plain", "-t", entry.tag, "-f", entry.file, dir],
      { inheritOutput: true },
    );

    if (build.exitCode !== 0) {
      throw new Error(
        `Failed to build image ${entry.tag}.\nstderr:\n${build.stderr}\nstdout:\n${build.stdout}`,
      );
    }

    process.stderr.write(`[clanker-cleanroom] Built Docker image ${entry.tag}\n`);

    registry = recordBuiltImage(entry, localByTag, registry, packageRoot);
  }
}

function recordBuiltImage(
  entry: DockerfileEntry,
  localByTag: Map<string, DockerfileEntry>,
  registry: ImageRegistry,
  packageRoot: string,
): ImageRegistry {
  const agent = inferAgent(entry, localByTag, registry);
  upsertRegistryEntry(
    entry.tag,
    {
      image: entry.tag,
      dockerfile: entry.relative,
      builtAt: new Date().toISOString(),
      ...(agent !== undefined ? { agent } : {}),
    },
    { packageRoot },
  );
  return readRegistry({ packageRoot });
}
