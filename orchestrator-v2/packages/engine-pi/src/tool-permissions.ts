import type { AgentTool } from "@bifrost-ai/engine";
import { minimatch } from "minimatch";

import { isMcpToolName, toPiToolName } from "./tool-names.js";

const mcpServerNamePattern = /^mcp__([^_]+(?:_[^_]+)*)__/;
const bareToolName = (tool: string): string => tool.replace(/\(.*\)$/, "");
const isGlobPattern = (name: string): boolean => name.includes("*") || name.includes("?");

export type ToolPermissionRule = {
  /** Pi tool name (after Bifrost → Pi mapping) */
  piName: string;
  /** Bifrost / AGENT.md tool name */
  bifrostName: string;
  allowPatterns: string[];
  denyPatterns: string[];
};

export type PiToolPermissions = {
  /** Names passed to Pi `tools` allowlist (or empty → use noTools) */
  allowedToolNames: string[];
  /** Whether any tools are permitted */
  hasTools: boolean;
  /** Per-tool allow/deny rules for the permission extension */
  rules: ToolPermissionRule[];
  /** Toolkit server names referenced by mcp__ tools */
  toolkitNames: string[];
};

type ParsedTool = {
  name: string;
  allowPatterns: string[];
  denyPatterns: string[];
};

const parseAgentTool = (tool: AgentTool): ParsedTool => {
  if (typeof tool === "string") {
    const name = bareToolName(tool);
    const parenMatch = /^\w+\((.*)\)$/.exec(tool);
    return {
      name,
      allowPatterns: parenMatch?.[1] !== undefined && parenMatch[1] !== "" ? [parenMatch[1]] : [],
      denyPatterns: [],
    };
  }

  return {
    name: tool.name,
    allowPatterns: tool.allow ?? [],
    denyPatterns: tool.deny ?? [],
  };
};

const extractToolkitName = (name: string): string | undefined => {
  if (!isMcpToolName(name)) {
    return undefined;
  }
  return mcpServerNamePattern.exec(name)?.[1];
};

/**
 * Map Bifrost `AgentTool[]` to Pi allowlist names + fine-grained permission rules.
 *
 * Layer 1 (native Pi): tool name allowlist.
 * Layer 2/3 (our extension): path/command allow & deny patterns.
 */
export function mapAgentToolsToPiPermissions(tools: AgentTool[]): PiToolPermissions {
  const parsedTools = tools.map(parseAgentTool);
  const ruleByPiName = new Map<string, ToolPermissionRule>();
  const toolkitNames = new Set<string>();

  for (const parsed of parsedTools) {
    const piName = toPiToolName(parsed.name);
    const toolkitName = extractToolkitName(parsed.name);
    if (toolkitName !== undefined) {
      toolkitNames.add(toolkitName);
    }

    const existing = ruleByPiName.get(piName);
    if (existing === undefined) {
      ruleByPiName.set(piName, {
        piName,
        bifrostName: parsed.name,
        allowPatterns: [...parsed.allowPatterns],
        denyPatterns: [...parsed.denyPatterns],
      });
    } else {
      existing.allowPatterns.push(...parsed.allowPatterns);
      existing.denyPatterns.push(...parsed.denyPatterns);
    }
  }

  const rules = [...ruleByPiName.values()];
  const allowedToolNames = rules.map((rule) => rule.piName);

  return {
    allowedToolNames,
    hasTools: allowedToolNames.length > 0,
    rules,
    toolkitNames: [...toolkitNames],
  };
}

/**
 * Resolve the permission rule for a Pi tool name.
 * Supports AGENT.md wildcards such as `mcp__devzeebo_node__*`.
 * Exact matches win over glob matches.
 */
export function findPermissionRule(
  rules: ToolPermissionRule[],
  piToolName: string,
): ToolPermissionRule | undefined {
  const exact = rules.find((rule) => rule.piName === piToolName);
  if (exact !== undefined) {
    return exact;
  }

  return rules.find(
    (rule) => isGlobPattern(rule.piName) && minimatch(piToolName, rule.piName, { dot: true }),
  );
}
