import path from "node:path";
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

/** Tools whose permission subject is a filesystem path (or defaults to cwd). */
const PATH_TOOLS = new Set(["read", "write", "edit", "ls"]);

/**
 * Search tools: `pattern` is a glob/regex, not a path. Permission applies to the
 * search root (`path`), defaulting to the working directory when omitted.
 */
const SEARCH_TOOLS = new Set(["grep", "find"]);

const extractSubject = (event: ToolCallEvent): string | undefined => {
  const input = event.input as Record<string, unknown>;

  if (event.toolName === "bash") {
    const command = input.command;
    return typeof command === "string" ? command : undefined;
  }

  if (SEARCH_TOOLS.has(event.toolName)) {
    const searchRoot = input.path ?? input.target_directory;
    if (typeof searchRoot === "string" && searchRoot.length > 0) {
      return searchRoot;
    }
    // No explicit root → searching cwd; evaluate against allow patterns as "."
    return ".";
  }

  if (PATH_TOOLS.has(event.toolName)) {
    const filePath = input.path ?? input.file_path ?? input.target_directory;
    return typeof filePath === "string" ? filePath : undefined;
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

/**
 * Normalize a filesystem subject for matching AGENT.md path globs like `./**`.
 * Paths under cwd become `./…` so they match `./**`. Paths outside cwd stay absolute.
 */
export function normalizePathSubject(subject: string, cwd: string): string {
  const resolved = path.isAbsolute(subject) ? path.normalize(subject) : path.resolve(cwd, subject);
  const relative = path.relative(cwd, resolved);

  // Outside cwd (or different root on Windows)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return resolved.split(path.sep).join("/");
  }

  if (relative === "") {
    return "./";
  }

  return `./${relative.split(path.sep).join("/")}`;
}

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

  if (minimatch(subject, pattern, { dot: true, matchBase: true })) {
    return true;
  }

  // Basename-only globs (e.g. `*.spec.ts`) against `./src/foo.spec.ts`
  const base = path.posix.basename(subject.replaceAll("\\", "/"));
  return base !== subject && minimatch(base, pattern, { dot: true });
};

const isPathTool = (toolName: string): boolean =>
  PATH_TOOLS.has(toolName) || SEARCH_TOOLS.has(toolName);

/**
 * Evaluate whether a tool call is permitted under Bifrost allow/deny rules.
 * Deny overrides allow. Tools not in the rules map are blocked.
 */
export function evaluateToolPermission(
  rules: ToolPermissionRule[],
  event: ToolCallEvent,
  cwd?: string,
): ToolCallEventResult | undefined {
  const rule = findPermissionRule(rules, event.toolName);

  if (rule === undefined) {
    const reason = `Tool "${event.toolName}" is not permitted by agent tool policy.`;
    debug("block tool=%s reason=%s", event.toolName, reason);
    return { block: true, reason };
  }

  const rawSubject = extractSubject(event);

  // No path/command subject and no patterns → name allowlist alone is enough
  if (rawSubject === undefined) {
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

  const subject =
    cwd !== undefined && isPathTool(event.toolName)
      ? normalizePathSubject(rawSubject, cwd)
      : rawSubject;

  for (const deny of rule.denyPatterns) {
    if (matchesPattern(subject, deny)) {
      const reason = `Tool "${event.toolName}" denied by pattern "${deny}" (matched "${subject}").`;
      debug(
        "block tool=%s subject=%s raw=%s reason=%s",
        event.toolName,
        subject,
        rawSubject,
        reason,
      );
      return { block: true, reason };
    }
  }

  if (rule.allowPatterns.length > 0) {
    const allowed = rule.allowPatterns.some((pattern) => matchesPattern(subject, pattern));
    if (!allowed) {
      const reason = `Tool "${event.toolName}" not allowed for "${subject}" (allow: ${rule.allowPatterns.join(", ")}).`;
      debug(
        "block tool=%s subject=%s raw=%s reason=%s",
        event.toolName,
        subject,
        rawSubject,
        reason,
      );
      return { block: true, reason };
    }
  }

  debug("allow tool=%s subject=%s raw=%s", event.toolName, subject, rawSubject);
  return undefined;
}

export function createPermissionExtension(
  rules: ToolPermissionRule[],
  cwd: string,
): InlineExtension {
  return {
    name: "bifrost-tool-permissions",
    factory: (pi: ExtensionAPI) => {
      pi.on("tool_call", (event: ToolCallEvent): ToolCallEventResult | undefined =>
        evaluateToolPermission(rules, event, cwd),
      );
    },
  };
}
