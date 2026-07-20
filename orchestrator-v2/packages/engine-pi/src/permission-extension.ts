import { minimatch } from "minimatch";
import type {
  ExtensionAPI,
  InlineExtension,
  ToolCallEvent,
  ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import createDebug from "debug";

import { findPermissionRule, type ToolPermissionRule } from "./tool-permissions.js";

const debug = createDebug("bifrost:engine:pi:permissions");

const PATH_TOOLS = new Set(["read", "write", "edit", "grep", "find", "ls"]);

const extractSubject = (event: ToolCallEvent): string | undefined => {
  const input = event.input as Record<string, unknown>;

  if (event.toolName === "bash") {
    const command = input.command;
    return typeof command === "string" ? command : undefined;
  }

  if (PATH_TOOLS.has(event.toolName)) {
    const path = input.path ?? input.file_path ?? input.pattern ?? input.target_directory;
    return typeof path === "string" ? path : undefined;
  }

  // Custom / MCP-style tools: prefer common path-like fields when present
  for (const key of ["path", "file_path", "filepath", "file", "command"] as const) {
    const value = input[key];
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
};

const matchesPattern = (subject: string, pattern: string): boolean => {
  // Exact match or glob (paths, file globs, shell command patterns)
  if (subject === pattern) {
    return true;
  }

  if (minimatch(subject, pattern, { dot: true })) {
    return true;
  }

  // Shell: allow patterns like "ls" or "git *" against the full command
  const firstToken = subject.split(/\s+/)[0] ?? subject;
  if (firstToken === pattern || minimatch(firstToken, pattern, { dot: true })) {
    return true;
  }

  // Prefix match for command allowlists: "git status" matches allow "git *"
  if (pattern.endsWith(" *")) {
    const prefix = pattern.slice(0, -2);
    if (subject === prefix || subject.startsWith(`${prefix} `)) {
      return true;
    }
  }

  return minimatch(subject, pattern, { dot: true, matchBase: true });
};

/**
 * Evaluate whether a tool call is permitted under Bifrost allow/deny rules.
 * Deny overrides allow. Tools not in the rules map are blocked.
 */
export function evaluateToolPermission(
  rules: ToolPermissionRule[],
  event: ToolCallEvent,
): ToolCallEventResult | undefined {
  const rule = findPermissionRule(rules, event.toolName);

  if (rule === undefined) {
    const reason = `Tool "${event.toolName}" is not permitted by agent tool policy.`;
    debug("block tool=%s reason=%s", event.toolName, reason);
    return { block: true, reason };
  }

  const subject = extractSubject(event);

  // No path/command subject and no patterns → name allowlist alone is enough
  if (subject === undefined) {
    if (rule.denyPatterns.length > 0 || rule.allowPatterns.length > 0) {
      // Patterns exist but we can't evaluate — allow name-level permission only for
      // custom tools without extractable subjects when allow is empty-or-unrestricted
      if (rule.allowPatterns.length > 0) {
        const reason = `Tool "${event.toolName}" requires a path or command to evaluate allow patterns.`;
        debug("block tool=%s reason=%s", event.toolName, reason);
        return { block: true, reason };
      }
    }
    debug("allow tool=%s subject=none", event.toolName);
    return undefined;
  }

  for (const deny of rule.denyPatterns) {
    if (matchesPattern(subject, deny)) {
      const reason = `Tool "${event.toolName}" denied by pattern "${deny}" (matched "${subject}").`;
      debug("block tool=%s subject=%s reason=%s", event.toolName, subject, reason);
      return { block: true, reason };
    }
  }

  if (rule.allowPatterns.length > 0) {
    const allowed = rule.allowPatterns.some((pattern) => matchesPattern(subject, pattern));
    if (!allowed) {
      const reason = `Tool "${event.toolName}" not allowed for "${subject}" (allow: ${rule.allowPatterns.join(", ")}).`;
      debug("block tool=%s subject=%s reason=%s", event.toolName, subject, reason);
      return { block: true, reason };
    }
  }

  debug("allow tool=%s subject=%s", event.toolName, subject);
  return undefined;
}

export function createPermissionExtension(rules: ToolPermissionRule[]): InlineExtension {
  return {
    name: "bifrost-tool-permissions",
    factory: (pi: ExtensionAPI) => {
      pi.on("tool_call", (event: ToolCallEvent): ToolCallEventResult | undefined =>
        evaluateToolPermission(rules, event),
      );
    },
  };
}
