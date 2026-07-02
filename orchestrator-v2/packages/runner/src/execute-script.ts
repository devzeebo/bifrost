import type {
  ScriptContext,
  ScriptResult,
  ScriptTaskDefinition,
} from "@bifrost-ai/interfaces-task";

export async function executeScript(
  script: ScriptTaskDefinition,
  ctx: ScriptContext,
): Promise<ScriptResult> {
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
