import type { HookSpec } from "./types";

export type HookExecutionContext = {
  projectDir: string;
  params: Record<string, unknown>;
  taskState: Record<string, unknown>;
};

export type HookResult = {
  hookName: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  shouldProceed: boolean;
  fatal: boolean;
  needsFollowUp: boolean;
  timedOut: boolean;
};

type HookExecFunction = (opts: {
  scriptPath: string;
  stdin: string;
  timeout: number;
}) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

const DEFAULT_HOOK_TIMEOUT = 300000; // 5 minutes in ms

/**
 * Execute hooks for a lifecycle phase (Start or Stop).
 * US-4: Project Maintainer - Extend Agent with Hooks
 * FR-10: Hook Contract
 */
type ExecuteHooksOptions = {
  hooks: HookSpec[];
  lifecycle: "Start" | "Stop";
  context: HookExecutionContext;
  execFn: HookExecFunction;
};

export const executeHooks = async (options: ExecuteHooksOptions): Promise<HookResult[]> => {
  const { hooks, lifecycle, context, execFn } = options;
  const results: HookResult[] = [];

  for (const hook of hooks) {
    const startTime = Date.now();
    const timeout = hook.timeout ?? DEFAULT_HOOK_TIMEOUT;

    // FR-10: stdin format - projectDir, params, taskState (no rendered prompt)
    const stdin = JSON.stringify({
      projectDir: context.projectDir,
      params: context.params,
      taskState: context.taskState,
    });

    try {
      // oxlint-disable-next-line no-await-in-loop
      const { exitCode, stdout, stderr } = await execFn({
        scriptPath: hook.scriptPath,
        stdin,
        timeout,
      });

      const durationMs = Date.now() - startTime;

      // FR-10: Exit codes
      // 0 = Success, proceed
      // 1 = Recoverable error, pass stdout as context, continue
      // 2 = Fatal error, halt, mark UoW as failed
      const fatal = exitCode === 2;
      const shouldProceed = exitCode !== 2;
      const needsFollowUp = lifecycle === "Stop" && exitCode === 1;

      results.push({
        hookName: hook.name,
        exitCode,
        stdout,
        stderr,
        durationMs,
        shouldProceed,
        fatal,
        needsFollowUp,
        timedOut: false,
      });

      // If hook returned fatal error, stop processing further hooks
      if (fatal) {
        break;
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Hook execution exception - treat as fatal (exit code 2)
      results.push({
        hookName: hook.name,
        exitCode: 2,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error), // oxlint-disable-line no-ternary
        durationMs,
        shouldProceed: false,
        fatal: true,
        needsFollowUp: false,
        timedOut: true,
      });

      // Stop processing further hooks on timeout/error
      break;
    }
  }

  return results;
};
