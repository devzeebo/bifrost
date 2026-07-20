/** Bifrost AGENT.md tool names ↔ Pi built-in tool names */

const bifrostToPi: Record<string, string> = {
  Read: "read",
  Write: "write",
  Edit: "edit",
  Shell: "bash",
  Bash: "bash",
  Grep: "grep",
  Grepping: "grep",
  Glob: "find",
  Find: "find",
  LS: "ls",
  Ls: "ls",
};

const piToBifrost: Record<string, string> = {
  read: "Read",
  write: "Write",
  edit: "Edit",
  bash: "Shell",
  grep: "Grep",
  find: "Glob",
  ls: "LS",
};

/**
 * Map a Bifrost / AGENT.md tool name to the Pi built-in name.
 * Custom toolkit tools (`mcp__…__…`) and unknown names pass through unchanged.
 */
export function toPiToolName(bifrostName: string): string {
  return bifrostToPi[bifrostName] ?? bifrostName;
}

/**
 * Map a Pi tool name back to the Bifrost / AGENT.md name used in permission rules.
 */
export function toBifrostToolName(piName: string): string {
  return piToBifrost[piName] ?? piName;
}

export function isMcpToolName(name: string): boolean {
  return name.startsWith("mcp__");
}
