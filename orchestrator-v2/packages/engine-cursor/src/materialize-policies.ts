import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AgentTool } from "@bifrost-ai/engine";

import { mapAgentToolsToCursorPolicies, type CursorToolPolicies } from "./tool-permissions.js";

export type MaterializeCursorPoliciesOptions = {
  workingDir: string;
  workItemId: string;
  tools: AgentTool[];
};

export async function materializeCursorPolicies(
  options: MaterializeCursorPoliciesOptions,
): Promise<CursorToolPolicies> {
  const policies = mapAgentToolsToCursorPolicies(options.tools, {
    workItemId: options.workItemId,
  });

  const cursorDir = path.join(options.workingDir, ".cursor");
  await mkdir(cursorDir, { recursive: true });

  await Promise.all([
    writeFile(
      path.join(cursorDir, "permissions.json"),
      `${JSON.stringify(policies.permissions, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      path.join(cursorDir, "cli.json"),
      `${JSON.stringify(policies.cli, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      path.join(cursorDir, "sandbox.json"),
      `${JSON.stringify(policies.sandbox, null, 2)}\n`,
      "utf8",
    ),
  ]);

  return policies;
}
