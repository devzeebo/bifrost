import { BASE_IMAGE, type StockAgentName, stockAgentNameForImage } from "../agents/stock.js";
import type { DockerfileEntry } from "./parse.js";
import type { ImageRegistry } from "./registry.js";

/**
 * Infer which stock agent binding an image should use by walking FROM images.
 * Returns undefined for non-agent images (e.g. base).
 */
export function inferAgent(
  entry: DockerfileEntry,
  localByTag: Map<string, DockerfileEntry>,
  registry: ImageRegistry,
  visiting: Set<string> = new Set(),
): StockAgentName | undefined {
  const stockForTag = stockAgentNameForImage(entry.tag);
  if (stockForTag !== undefined) {
    return stockForTag;
  }

  if (entry.tag === BASE_IMAGE) {
    return undefined;
  }

  if (visiting.has(entry.tag)) {
    throw new Error(`Cycle while inferring agent for "${entry.tag}"`);
  }
  visiting.add(entry.tag);

  try {
    for (const from of entry.fromImages) {
      const stock = stockAgentNameForImage(from);
      if (stock !== undefined) {
        return stock;
      }
      if (from === BASE_IMAGE) {
        continue;
      }

      const local = localByTag.get(from);
      if (local !== undefined) {
        const inferred = inferAgent(local, localByTag, registry, visiting);
        if (inferred !== undefined) {
          return inferred;
        }
        continue;
      }

      const recorded = registry.images[from]?.agent;
      if (recorded !== undefined) {
        return recorded;
      }
    }

    const referencesBuiltImage = entry.fromImages.some(
      (from) =>
        from !== BASE_IMAGE && (localByTag.has(from) || registry.images[from] !== undefined),
    );
    if (!referencesBuiltImage) {
      return undefined;
    }

    throw new Error(
      `Cannot determine stock agent for image "${entry.tag}". ` +
        `FROM chain must reach a registered stock agent image ` +
        `(import \`@clanker-cleanroom/<agent>/register\` before buildImages).`,
    );
  } finally {
    visiting.delete(entry.tag);
  }
}
