import type { HookSpec, HookResult, HookExecutionContext } from "./types";

export type { HookExecutionContext, HookResult };

type ExecuteHooksOptions = {
  hooks: HookSpec[];
  lifecycle: "Start" | "Stop";
  context: Omit<HookExecutionContext, "hookName">;
};

export const executeHooks = async (options: ExecuteHooksOptions): Promise<HookResult[]> => {
  const { hooks, context } = options;
  const results: HookResult[] = [];

  for (const hook of hooks) {
    try {
      const result = await hook.fn({ ...context, hookName: hook.name });

      results.push(result);

      if (result.outcome === "fatal") {
        break;
      }
    } catch (error) {
      results.push({
        outcome: "fatal",
        message: error instanceof Error ? error.message : String(error),
      });

      break;
    }
  }

  return results;
};
