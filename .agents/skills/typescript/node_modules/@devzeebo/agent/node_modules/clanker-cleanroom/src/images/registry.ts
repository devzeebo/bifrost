import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { StockAgentName } from "../agents/stock.js";

export const IMAGES_REGISTRY_FILENAME = "clanker-cleanroom.images.json";
export const IMAGE_REGISTRY_VERSION = 2 as const;

export type ImageRegistryEntry = {
  image: string;
  dockerfile: string;
  builtAt: string;
  /** Stock binding this image runs with. Absent for non-agent images (e.g. base). */
  agent?: StockAgentName;
};

export type ImageRegistry = {
  version: typeof IMAGE_REGISTRY_VERSION;
  images: Record<string, ImageRegistryEntry>;
};

export type RegistryOptions = {
  /** Directory that owns the registry file. Defaults to `process.cwd()`. */
  packageRoot?: string;
};

export function registryPath(options: RegistryOptions = {}): string {
  return join(resolve(options.packageRoot ?? process.cwd()), IMAGES_REGISTRY_FILENAME);
}

export function emptyRegistry(): ImageRegistry {
  return { version: IMAGE_REGISTRY_VERSION, images: {} };
}

export function readRegistry(options: RegistryOptions = {}): ImageRegistry {
  const file = registryPath(options);
  if (!existsSync(file)) {
    return emptyRegistry();
  }

  const parsed = JSON.parse(readFileSync(file, "utf8")) as {
    version?: unknown;
    images?: unknown;
  };
  if (parsed.version !== IMAGE_REGISTRY_VERSION) {
    throw new Error(
      `Image registry at ${file} has version ${String(parsed.version)}; expected ${IMAGE_REGISTRY_VERSION}. ` +
        `Delete it and run buildImages() again.`,
    );
  }
  if (typeof parsed.images !== "object" || parsed.images === null) {
    throw new Error(`Invalid image registry at ${file}`);
  }

  return parsed as ImageRegistry;
}

export function writeRegistry(registry: ImageRegistry, options: RegistryOptions = {}): void {
  const file = registryPath(options);
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(registry, null, 2)}\n`);
  renameSync(temp, file);
}

export function upsertRegistryEntry(
  tag: string,
  entry: ImageRegistryEntry,
  options: RegistryOptions = {},
): void {
  const registry = readRegistry(options);
  registry.images[tag] = entry;
  writeRegistry(registry, options);
}

export function resolveImage(tag: string, options: RegistryOptions = {}): string | undefined {
  return readRegistry(options).images[tag]?.image;
}

export function resetRegistry(options: RegistryOptions = {}): void {
  const file = registryPath(options);
  if (existsSync(file)) {
    writeFileSync(file, `${JSON.stringify(emptyRegistry(), null, 2)}\n`);
  }
}
