import type { AgentTool } from "@bifrost-ai/engine";

const mcpToolPattern = /^mcp__([^_]+(?:_[^_]+)*)__(.+)$/;
const bareToolName = (tool: string): string => tool.replace(/\(.*\)$/, "");

export type CursorPermissionsJson = {
  terminalAllowlist?: string[];
  mcpAllowlist: string[];
  autoRun?: {
    allow_instructions?: string[];
    block_instructions?: string[];
  };
};

export type CursorCliJson = {
  version: 1;
  editor: { vimMode: boolean };
  approvalMode: "allowlist";
  permissions: {
    allow: string[];
    deny: string[];
  };
};

export type CursorSandboxJson = {
  type: "workspace_readwrite";
  networkPolicy: {
    default: "deny" | "allow";
  };
  additionalReadwritePaths?: string[];
};

export type CursorToolPolicies = {
  permissions: CursorPermissionsJson;
  cli: CursorCliJson;
  sandbox: CursorSandboxJson;
  shellPermitted: boolean;
};

export type MapAgentToolsOptions = {
  workItemId?: string;
};

type ParsedTool = {
  name: string;
  allowPatterns: string[];
  denyPatterns: string[];
  shorthandToken?: string;
};

const parseAgentTool = (tool: AgentTool): ParsedTool => {
  if (typeof tool === "string") {
    const name = bareToolName(tool);
    const parenMatch = /^\w+\((.*)\)$/.exec(tool);
    return {
      name,
      allowPatterns: parenMatch?.[1] !== undefined && parenMatch[1] !== "" ? [parenMatch[1]] : [],
      denyPatterns: [],
      shorthandToken: tool,
    };
  }

  return {
    name: tool.name,
    allowPatterns: tool.allow ?? [],
    denyPatterns: tool.deny ?? [],
  };
};

const toCliAllowToken = (parsed: ParsedTool): string[] => {
  if (parsed.shorthandToken !== undefined) {
    const mcpMatch = mcpToolPattern.exec(parsed.shorthandToken);
    if (mcpMatch?.[1] !== undefined && mcpMatch[2] !== undefined) {
      return [`Mcp(${mcpMatch[1]}:${mcpMatch[2]})`];
    }
    return [parsed.shorthandToken];
  }

  const mcpMatch = mcpToolPattern.exec(parsed.name);
  if (mcpMatch?.[1] !== undefined && mcpMatch[2] !== undefined) {
    return [`Mcp(${mcpMatch[1]}:${mcpMatch[2]})`];
  }

  if (parsed.allowPatterns.length === 0) {
    return [parsed.name];
  }

  return parsed.allowPatterns.map((pattern) => `${parsed.name}(${pattern})`);
};

const toCliDenyTokens = (parsed: ParsedTool): string[] =>
  parsed.denyPatterns.map((pattern) => `${parsed.name}(${pattern})`);

const toMcpAllowlistEntry = (name: string): string | undefined => {
  const match = mcpToolPattern.exec(name);
  if (match?.[1] === undefined || match[2] === undefined) {
    return undefined;
  }
  return `${match[1]}:${match[2]}`;
};

const toTerminalAllowlistEntries = (parsed: ParsedTool): string[] | "unrestricted" => {
  if (parsed.name !== "Shell") {
    return [];
  }

  if (parsed.allowPatterns.length === 0) {
    return "unrestricted";
  }

  return parsed.allowPatterns.map((pattern) => pattern.split(/\s+/)[0] ?? pattern);
};

export function mapAgentToolsToCursorPolicies(
  tools: AgentTool[],
  options: MapAgentToolsOptions = {},
): CursorToolPolicies {
  const parsedTools = tools.map(parseAgentTool);
  const shellTools = parsedTools.filter((tool) => tool.name === "Shell");
  const shellPermitted = shellTools.length > 0;

  let unrestrictedShell = false;
  const terminalEntries: string[] = [];
  for (const shellTool of shellTools) {
    const entries = toTerminalAllowlistEntries(shellTool);
    if (entries === "unrestricted") {
      unrestrictedShell = true;
    } else {
      terminalEntries.push(...entries);
    }
  }

  const mcpAllowlist = [
    ...new Set(
      parsedTools
        .map((tool) => toMcpAllowlistEntry(tool.name))
        .filter((entry): entry is string => entry !== undefined),
    ),
  ];

  const allow = [...new Set(parsedTools.flatMap(toCliAllowToken))];
  const deny = [...new Set(parsedTools.flatMap(toCliDenyTokens))];

  if (!shellPermitted) {
    deny.push("Shell(*)");
  }

  const permissions: CursorPermissionsJson = {
    mcpAllowlist,
  };

  if (!shellPermitted) {
    permissions.terminalAllowlist = [];
    permissions.autoRun = {
      block_instructions: ["Never run shell or terminal commands. Shell tool use must be denied."],
    };
  } else if (!unrestrictedShell) {
    permissions.terminalAllowlist = [...new Set(terminalEntries)];
  }

  const sandbox: CursorSandboxJson = {
    type: "workspace_readwrite",
    networkPolicy: {
      default: "deny",
    },
  };

  if (options.workItemId !== undefined && options.workItemId.length > 0) {
    sandbox.additionalReadwritePaths = [`/tmp/.devzeebo/${options.workItemId}`];
  }

  return {
    permissions,
    cli: {
      version: 1,
      editor: { vimMode: false },
      approvalMode: "allowlist",
      permissions: {
        allow,
        deny,
      },
    },
    sandbox,
    shellPermitted,
  };
}
