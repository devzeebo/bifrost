import type {
  ScriptContext,
  ScriptResult,
  ScriptTaskDefinition,
} from "@bifrost-ai/interfaces-task";

import type { ScriptRegistry } from "./script-registry.js";

export async function executeScript(
  registry: ScriptRegistry,
  scriptName: string,
  ctx: ScriptContext,
): Promise<ScriptResult> {
  const script = registry.get(scriptName);
  if (script === undefined) {
    return { outcome: "failed", message: `Unknown script: ${scriptName}` };
  }

  return runScript(script, ctx);
}

async function runScript(script: ScriptTaskDefinition, ctx: ScriptContext): Promise<ScriptResult> {
  try {
    return await script.run(ctx);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { outcome: "failed", message };
  }
}
