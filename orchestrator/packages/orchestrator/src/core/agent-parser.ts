import matter from "gray-matter";
import type { AgentDefinition } from "./types";

/**
 * Extract all Handlebars tokens from a string.
 * Matches patterns like {{token}}, {{token.path}}, {{#if token}}...{{/if}}
 */
const extractHandlebarsTokens = (content: string): Set<string> => {
  const tokens = new Set<string>();

  // Match simple tokens: {{variableName}}
  const simpleTokenRegex = /\{\{([^#/][^}]*)\}\}/g;
  let match: RegExpMatchArray | null = null;
  while ((match = simpleTokenRegex.exec(content)) !== null) {
    const token = match[1].trim();
    // Extract the base path (first part before any dots or spaces)
    const [basePath] = token.split(".")[0].split(" ");
    tokens.add(basePath);
  }

  // Match block helpers: {{#if variableName}}...{{/if}}
  const blockTokenRegex = /\{\{#(?:if|unless|each)\s+([^}]+)\}\}/g;
  while ((match = blockTokenRegex.exec(content)) !== null) {
    const token = match[1].trim();
    const [basePath] = token.split(".")[0].split(" ");
    tokens.add(basePath);
  }

  return tokens;
};

/**
 * Get all parameter paths from template.parameters, including nested paths.
 * Handles optional parameters (ending with ?).
 */
const getDeclaredParameters = (params: Record<string, unknown>): Set<string> => {
  const declared = new Set<string>();

  for (const key of Object.keys(params)) {
    // Remove the ? suffix for optional parameters
    const baseKey = key.endsWith("?") ? key.slice(0, -1) : key;
    declared.add(baseKey);

    // Recursively extract nested parameters
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

/**
 * Parse AGENT.md file with YAML frontmatter.
 * Returns null if parsing fails or required fields are missing.
 */
// oxlint-disable-next-line complexity
export const parseAgentDefinition = (content: string): AgentDefinition | null => {
  try {
    const parsed = matter(content);

    const data = parsed.data as Record<string, unknown>;
    const promptBody = parsed.content;

    // Validate required fields: name, description, tools
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

    // Extract template.parameters
    const templateData = data.template as Record<string, unknown> | undefined;
    const parameters = (templateData?.parameters as Record<string, unknown>) || {};

    // Extract Handlebars tokens from prompt body
    const usedTokens = extractHandlebarsTokens(promptBody);

    // Get all declared parameter paths
    const declaredParams = getDeclaredParameters(parameters);

    const builtinTokens = new Set(["taskId"]);

    // Validate that all used tokens are declared
    for (const token of usedTokens) {
      if (!builtinTokens.has(token)) {
        // Check if token or any of its parent paths are declared
        let isDeclared = declaredParams.has(token);

        // Check for parent paths (e.g., if using "context.prDescription", check if "context" or "context?" is declared)
        if (!isDeclared) {
          const parts = token.split(".");
          for (let index = parts.length; index > 0; index -= 2) {
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
      tools: data.tools as string[],
      template: { parameters },
      hooks: { Start: [], Stop: [] },
      promptBody,
      model,
    };
  } catch (error) {
    console.error("Failed to parse AGENT.md:", error);
    return null;
  }
};
