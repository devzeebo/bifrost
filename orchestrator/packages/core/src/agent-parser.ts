import matter from "gray-matter";
import { AgentDefinition } from "./types.js";

/**
 * Extract all Handlebars tokens from a string.
 * Matches patterns like {{token}}, {{token.path}}, {{#if token}}...{{/if}}
 */
const extractHandlebarsTokens = (content: string): Set<string> => {
  const tokens = new Set<string>();

  // Match simple tokens: {{variableName}}
  const simpleTokenRegex = /\{\{([^#/][^}]*)\}\}/g;
  let match;
  while ((match = simpleTokenRegex.exec(content)) !== null) {
    const token = match[1].trim();
    // Extract the base path (first part before any dots or spaces)
    const basePath = token.split(".")[0].split(" ")[0];
    tokens.add(basePath);
  }

  // Match block helpers: {{#if variableName}}...{{/if}}
  const blockTokenRegex = /\{\{#(?:if|unless|each)\s+([^}]+)\}\}/g;
  while ((match = blockTokenRegex.exec(content)) !== null) {
    const token = match[1].trim();
    const basePath = token.split(".")[0].split(" ")[0];
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

    // Extract toolClasses (optional, defaults to empty array)
    const toolClasses = Array.isArray(data.toolClasses) ? (data.toolClasses as string[]) : [];

    // Extract template.parameters
    const templateData = data.template as Record<string, unknown> | undefined;
    const parameters = (templateData?.parameters as Record<string, unknown>) || {};

    // Extract Handlebars tokens from prompt body
    const usedTokens = extractHandlebarsTokens(promptBody);

    // Get all declared parameter paths
    const declaredParams = getDeclaredParameters(parameters);

    // Validate that all used tokens are declared
    for (const token of usedTokens) {
      // Check if token or any of its parent paths are declared
      let isDeclared = declaredParams.has(token);

      // Check for parent paths (e.g., if using "context.prDescription", check if "context" or "context?" is declared)
      if (!isDeclared) {
        const parts = token.split(".");
        for (let i = parts.length; i > 0; i--) {
          const parentPath = parts.slice(0, i).join(".");
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

    // Parse hooks
    const hooksData = data.hooks as Record<string, unknown> | undefined;
    const hooks: {
      Start: Array<{ name: string; scriptPath: string; timeout?: number }>;
      Stop: Array<{ name: string; scriptPath: string; timeout?: number }>;
    } = {
      Start: [],
      Stop: [],
    };

    if (hooksData?.Start && Array.isArray(hooksData.Start)) {
      for (const hook of hooksData.Start) {
        if (typeof hook === "object" && hook !== null) {
          const hookObj = hook as Record<string, unknown>;
          if (typeof hookObj.name === "string" && typeof hookObj.scriptPath === "string") {
            hooks.Start.push({
              name: hookObj.name,
              scriptPath: hookObj.scriptPath,
              timeout: typeof hookObj.timeout === "number" ? hookObj.timeout : undefined,
            });
          }
        }
      }
    }

    if (hooksData?.Stop && Array.isArray(hooksData.Stop)) {
      for (const hook of hooksData.Stop) {
        if (typeof hook === "object" && hook !== null) {
          const hookObj = hook as Record<string, unknown>;
          if (typeof hookObj.name === "string" && typeof hookObj.scriptPath === "string") {
            hooks.Stop.push({
              name: hookObj.name,
              scriptPath: hookObj.scriptPath,
              timeout: typeof hookObj.timeout === "number" ? hookObj.timeout : undefined,
            });
          }
        }
      }
    }

    return {
      name: data.name,
      description: data.description,
      tools: data.tools as string[],
      toolClasses,
      template: { parameters },
      hooks,
      promptBody,
    };
  } catch (error) {
    console.error("Failed to parse AGENT.md:", error);
    return null;
  }
};
