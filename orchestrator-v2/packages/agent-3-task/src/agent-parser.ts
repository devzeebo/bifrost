import matter from "gray-matter";
import type { AgentDefinition, AgentTool } from "@bifrost-ai/engine";

const extractHandlebarsTokens = (content: string): Set<string> => {
  const tokens = new Set<string>();

  const simpleTokenRegex = /\{\{([^#/][^}]*)\}\}/g;
  let match: RegExpMatchArray | null = null;
  while ((match = simpleTokenRegex.exec(content)) !== null) {
    const token = match[1].trim();
    const [basePath] = token.split(".")[0].split(" ");
    tokens.add(basePath);
  }

  const blockTokenRegex = /\{\{#(?:if|unless|each)\s+([^}]+)\}\}/g;
  while ((match = blockTokenRegex.exec(content)) !== null) {
    const token = match[1].trim();
    const [basePath] = token.split(".")[0].split(" ");
    tokens.add(basePath);
  }

  return tokens;
};

const getDeclaredParameters = (params: Record<string, unknown>): Set<string> => {
  const declared = new Set<string>();

  for (const key of Object.keys(params)) {
    const baseKey = key.endsWith("?") ? key.slice(0, -1) : key;
    declared.add(baseKey);

    const value = params[key];
    if (typeof value === "object" && value !== null) {
      const nestedParams = getDeclaredParameters(value as Record<string, unknown>);
      for (const nested of nestedParams) {
        declared.add(`${baseKey}.${nested}`);
      }
    }
  }

  return declared;
};

export function parseAgentDefinition(content: string): AgentDefinition | null {
  try {
    const parsed = matter(content);
    const data = parsed.data as Record<string, unknown>;
    const promptBody = parsed.content;

    if (!data.name || typeof data.name !== "string") {
      console.error("Missing or invalid required field: name");
      return null;
    }

    if (!data.description || typeof data.description !== "string") {
      console.error("Missing or invalid required field: description");
      return null;
    }

    if (!Array.isArray(data.tools)) {
      console.error("Missing or invalid required field: tools");
      return null;
    }

    const templateData = data.template as Record<string, unknown> | undefined;
    const topLevelParameters = data.parameters as Record<string, unknown> | undefined;
    const parameters =
      (templateData?.parameters as Record<string, unknown> | undefined) ?? topLevelParameters ?? {};

    const usedTokens = extractHandlebarsTokens(promptBody);
    const declaredParams = getDeclaredParameters(parameters);
    const builtinTokens = new Set(["taskId"]);

    for (const token of usedTokens) {
      if (!builtinTokens.has(token)) {
        let isDeclared = declaredParams.has(token);

        if (!isDeclared) {
          const parts = token.split(".");
          for (let index = parts.length; index > 0; index -= 1) {
            const parentPath = parts.slice(0, index).join(".");
            if (declaredParams.has(parentPath) || declaredParams.has(`${parentPath}?`)) {
              isDeclared = true;
              break;
            }
          }
        }

        if (!isDeclared) {
          console.error(`Undeclared Handlebars token: ${token}`);
          return null;
        }
      }
    }

    const model = typeof data.model === "string" ? data.model : undefined;

    return {
      name: data.name,
      description: data.description,
      tools: data.tools as AgentTool[],
      template: { parameters },
      promptBody,
      model,
    };
  } catch (error) {
    console.error("Failed to parse AGENT.md:", error);
    return null;
  }
}
