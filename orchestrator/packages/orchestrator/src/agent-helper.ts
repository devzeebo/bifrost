import { parseAgentDefinition } from "./core/agent-parser";
import { renderPrompt } from "./core/handlebars-renderer";
import type { AgentDefinition } from "./core/types";

type AgentTemplateData = {
  taskId: string;
  metadata: Record<string, unknown>;
  taskState: Record<string, unknown>;
};

const deepMerge = <Type extends object>(target: Partial<Type>, source: Partial<Type>): Type => {
  const result = { ...target };

  for (const key in source) {
    if (!Object.hasOwn(source, key)) {
      // Skip prototype properties
    } else {
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
  }

  return result as Type;
};

export const loadAgent = async (
  def: string,
  templateData: AgentTemplateData,
  agent?: Partial<AgentDefinition>,
): Promise<AgentDefinition> => {
  const rendered = renderPrompt(def, templateData);
  const definition = parseAgentDefinition(rendered);
  if (!definition) {
    throw new Error("Failed to parse agent definition");
  }
  return deepMerge(definition, agent ?? {});
};
