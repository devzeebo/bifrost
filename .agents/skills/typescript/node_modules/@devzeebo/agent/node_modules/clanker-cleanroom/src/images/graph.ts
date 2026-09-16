import type { DockerfileEntry } from "./parse.js";

/**
 * Topological sort of Dockerfile entries by local FROM dependencies.
 * Throws if a cycle is detected.
 */
export function topoSort(entries: DockerfileEntry[]): DockerfileEntry[] {
  const byTag = new Map(entries.map((entry) => [entry.tag, entry]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: DockerfileEntry[] = [];

  function visit(tag: string, path: string[]): void {
    if (visited.has(tag)) {
      return;
    }
    if (visiting.has(tag)) {
      throw new Error(`Dockerfile dependency cycle detected: ${[...path, tag].join(" -> ")}`);
    }

    visiting.add(tag);
    const entry = byTag.get(tag);
    if (entry === undefined) {
      throw new Error(`Unknown Dockerfile tag "${tag}"`);
    }

    for (const dep of entry.dependencies) {
      visit(dep, [...path, tag]);
    }

    visiting.delete(tag);
    visited.add(tag);
    ordered.push(entry);
  }

  for (const entry of entries) {
    visit(entry.tag, []);
  }

  return ordered;
}
