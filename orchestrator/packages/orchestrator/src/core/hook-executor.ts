import type {
  HookSpec,
  HookResult,
  HookExecutionContext,
  OrchestrationContext,
  BeforeDispatchHookSpec,
  BeforeDispatchHookResult,
  BeforeDispatchHookContext,
} from "./types";
import createDebug from "debug";

const debug = createDebug("bifrost");

export type { HookExecutionContext, HookResult, OrchestrationContext };

type ExecuteHooksOptions = {
  hooks: HookSpec[];
  lifecycle: "Start" | "Stop";
  context: Omit<HookExecutionContext, "hookName">;
};

export const executeHooks = async (options: ExecuteHooksOptions): Promise<HookResult[]> => {
  const { hooks, lifecycle, context } = options;
  const results: HookResult[] = [];

  for (const hook of hooks) {
    debug("%s hook %s start", lifecycle, hook.name);
    try {
      const result = await hook.fn({ ...context, hookName: hook.name });

      debug("%s hook %s → %s", lifecycle, hook.name, result.outcome);
      results.push(result);

      if (result.outcome === "fatal") {
        break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      debug("%s hook %s threw: %s", lifecycle, hook.name, message);
      results.push({ outcome: "fatal", message });
      break;
    }
  }

  return results;
};

type ExecuteBeforeDispatchHooksOptions = {
  hooks: BeforeDispatchHookSpec[];
  context: Omit<BeforeDispatchHookContext, "hookName">;
};

export const executeBeforeDispatchHooks = async (
  options: ExecuteBeforeDispatchHooksOptions,
): Promise<BeforeDispatchHookResult[]> => {
  const { hooks, context } = options;
  const results: BeforeDispatchHookResult[] = [];

  for (const hook of hooks) {
    debug("BeforeDispatch hook %s start", hook.name);
    try {
      const result = await hook.fn({ ...context, hookName: hook.name });

      debug("BeforeDispatch hook %s → %s", hook.name, result.outcome);
      results.push(result);

      if (result.outcome === "fatal") {
        break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      debug("BeforeDispatch hook %s threw: %s", hook.name, message);
      results.push({ outcome: "fatal", message });
      break;
    }
  }

  return results;
};
