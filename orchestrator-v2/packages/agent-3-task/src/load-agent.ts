import { readFile } from "node:fs/promises";

import type { AgentDefinition } from "@bifrost-ai/engine";

import { parseAgentDefinition } from "./agent-parser.js";

const deepMerge = <T extends object>(target: Partial<T>, source: Partial<T>): T => {
  const result = { ...target };

  for (const key in source) {
    if (!Object.hasOwn(source, key)) {
      continue;
    }

    const sourceValue = source[key];
    const targetValue = result[key];

    if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
      (result as Record<string, unknown>)[key] = [...targetValue, ...sourceValue];
    } else if (
      sourceValue &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetValue as Partial<object>,
        sourceValue as Partial<object>,
      );
    } else {
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return result as T;
};

export async function loadAgent(
  filePath: string,
  override?: Partial<AgentDefinition>,
): Promise<AgentDefinition> {
  const content = await readFile(filePath, "utf-8");
  const definition = parseAgentDefinition(content);
  if (!definition) {
    throw new Error(`Failed to parse agent definition: ${filePath}`);
  }
  return deepMerge(definition, override ?? {});
}
