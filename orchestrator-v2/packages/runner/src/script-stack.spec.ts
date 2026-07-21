import type {
  DecoratorFactory,
  ScriptContext,
  ScriptFn,
  WorkItem,
} from "@bifrost-ai/interfaces-work";
import { describe, expect, vi } from "vite-plus/test";
import test from "vitest-gwt";

import { Registry } from "./registry.js";
import { executeScriptStack, formatScriptStack, resolveStack } from "./script-stack.js";

type Context = {
  workItem: WorkItem;
  scripts: Registry<ScriptFn>;
  decorators: Registry<DecoratorFactory>;
  conventions: readonly string[];
  result: unknown;
  error: Error | null;
  logSpy: ReturnType<typeof vi.spyOn>;
};

const baseWorkItem = (): WorkItem => ({
  workItemId: "wi-1",
  kind: "script",
  name: "hunt",
  flow: [],
  state: {},
  metadata: {},
});

const scriptContext = {
  cwd: "/tmp",
  data: {
    get() {
      return {
        register() {},
        get() {
          return undefined;
        },
        has() {
          return false;
        },
      };
    },
  },
  workItemSource: {
    async completeWorkItem() {},
    async failWorkItem() {},
    async pauseWorkItem() {},
    async createDraftWorkItem() {
      return "draft-1";
    },
    async startWorkItem() {},
    async setDependency() {},
    async getDependencies() {
      return [];
    },
    async getWorkItemStatus() {
      return "live" as const;
    },
    async setState() {},
    async updateWorkItemMetadata() {},
  },
  async setState() {},
};

describe("script-stack", () => {
  test("runs script directly when flow is empty and no conventions", {
    given: { a_script_registry_with_hunt },
    when: { executing_without_conventions },
    then: { script_ran },
  });

  test("nests decorators outermost-first", {
    given: { nested_decorators },
    when: { executing_nested_stack },
    then: { order_is_outer_to_inner },
  });

  test("short-circuit decorator skips inner work", {
    given: { skip_decorator },
    when: { executing_short_circuit },
    then: { script_never_ran },
  });

  test("retry decorator calls next multiple times", {
    given: { flaky_script_and_retry_decorator },
    when: { executing_with_retry },
    then: { script_succeeds_on_third_try },
  });

  test("resolveStack throws for missing script", {
    given: { empty_registries },
    when: { resolving_unknown_script },
    then: { script_error_thrown },
  });

  test("resolveStack throws for missing decorator", {
    given: { script_without_decorator },
    when: { resolving_unknown_decorator },
    then: { decorator_error_thrown },
  });

  test("resolveStack layers are outermost-first including conventions", {
    given: { nested_decorators_with_convention },
    when: { resolving_stack },
    then: { layers_are_convention_then_flow_then_script },
  });

  test("executeScriptStack logs layers before running", {
    given: { nested_decorators, console_log_spied },
    when: { executing_nested_stack },
    then: { stack_was_logged },
  });
});

function a_script_registry_with_hunt(this: Context) {
  this.workItem = baseWorkItem();
  this.scripts = new Registry<ScriptFn>();
  this.decorators = new Registry<DecoratorFactory>();
  this.scripts.register("hunt", async () => {
    this.result = "meat";
  });
}

async function executing_without_conventions(this: Context) {
  const stack = resolveStack(this.workItem, this.scripts, this.decorators, []);
  await executeScriptStack(this.workItem, scriptContext, stack);
}

function script_ran(this: Context) {
  expect(this.result).toBe("meat");
}

function nested_decorators(this: Context) {
  const order: string[] = [];
  this.result = order;
  this.workItem = { ...baseWorkItem(), flow: ["outer", "inner"] };
  this.scripts = new Registry<ScriptFn>();
  this.decorators = new Registry<DecoratorFactory>();

  this.scripts.register("hunt", async () => {
    order.push("script");
  });

  this.decorators.register(
    "outer",
    () => async (_wi: WorkItem, _ctx: ScriptContext, next: () => Promise<unknown>) => {
      order.push("outer-before");
      await next();
      order.push("outer-after");
    },
  );

  this.decorators.register(
    "inner",
    () => async (_wi: WorkItem, _ctx: ScriptContext, next: () => Promise<unknown>) => {
      order.push("inner-before");
      await next();
      order.push("inner-after");
    },
  );
}

async function executing_nested_stack(this: Context) {
  const stack = resolveStack(this.workItem, this.scripts, this.decorators, []);
  await executeScriptStack(this.workItem, scriptContext, stack);
}

function order_is_outer_to_inner(this: Context) {
  expect(this.result).toEqual([
    "outer-before",
    "inner-before",
    "script",
    "inner-after",
    "outer-after",
  ]);
}

function skip_decorator(this: Context) {
  const state = { scriptRan: false };
  this.result = state;
  this.workItem = { ...baseWorkItem(), flow: ["skip"] };
  this.scripts = new Registry<ScriptFn>();
  this.decorators = new Registry<DecoratorFactory>();

  this.scripts.register("hunt", async () => {
    state.scriptRan = true;
  });

  this.decorators.register("skip", () => async () => undefined);
}

async function executing_short_circuit(this: Context) {
  const stack = resolveStack(this.workItem, this.scripts, this.decorators, []);
  await executeScriptStack(this.workItem, scriptContext, stack);
}

function script_never_ran(this: Context) {
  expect((this.result as { scriptRan: boolean }).scriptRan).toBe(false);
}

function flaky_script_and_retry_decorator(this: Context) {
  const state = { attempts: 0 };
  this.result = state;
  this.workItem = { ...baseWorkItem(), flow: [{ name: "retry", args: [3] }] };
  this.scripts = new Registry<ScriptFn>();
  this.decorators = new Registry<DecoratorFactory>();

  this.scripts.register("hunt", async () => {
    state.attempts += 1;
    if (state.attempts < 3) {
      throw new Error("not yet");
    }
  });

  this.decorators.register("retry", (maxAttempts: unknown) => {
    const limit = maxAttempts as number;
    return async (_wi: WorkItem, _ctx: ScriptContext, next: () => Promise<unknown>) => {
      let tries = 0;
      while (true) {
        try {
          await next();
          return;
        } catch (error) {
          if (++tries >= limit) {
            throw error;
          }
        }
      }
    };
  });
}

async function executing_with_retry(this: Context) {
  const stack = resolveStack(this.workItem, this.scripts, this.decorators, []);
  await executeScriptStack(this.workItem, scriptContext, stack);
}

function script_succeeds_on_third_try(this: Context) {
  expect((this.result as { attempts: number }).attempts).toBe(3);
}

function empty_registries(this: Context) {
  this.workItem = baseWorkItem();
  this.scripts = new Registry<ScriptFn>();
  this.decorators = new Registry<DecoratorFactory>();
}

function resolving_unknown_script(this: Context) {
  try {
    resolveStack(this.workItem, this.scripts, this.decorators, []);
    this.error = null;
  } catch (error) {
    this.error = error as Error;
  }
}

function script_error_thrown(this: Context) {
  expect(this.error?.message).toBe("Unknown script: hunt");
}

function script_without_decorator(this: Context) {
  this.workItem = { ...baseWorkItem(), flow: ["missing"] };
  this.scripts = new Registry<ScriptFn>();
  this.decorators = new Registry<DecoratorFactory>();
  this.scripts.register("hunt", async () => undefined);
}

function resolving_unknown_decorator(this: Context) {
  try {
    resolveStack(this.workItem, this.scripts, this.decorators, []);
    this.error = null;
  } catch (error) {
    this.error = error as Error;
  }
}

function decorator_error_thrown(this: Context) {
  expect(this.error?.message).toBe("Unknown decorator: missing");
}

function nested_decorators_with_convention(this: Context) {
  nested_decorators.call(this);
  this.conventions = ["convention"];
  this.decorators.register(
    "convention",
    () => async (_wi: WorkItem, _ctx: ScriptContext, next: () => Promise<unknown>) => {
      await next();
    },
  );
}

function resolving_stack(this: Context) {
  this.result = resolveStack(this.workItem, this.scripts, this.decorators, this.conventions ?? []);
}

function layers_are_convention_then_flow_then_script(this: Context) {
  expect((this.result as { layers: string[] }).layers).toEqual([
    "convention",
    "outer",
    "inner",
    "hunt",
  ]);
  expect(formatScriptStack((this.result as { layers: string[] }).layers)).toBe(
    "convention => outer => inner => hunt",
  );
}

function console_log_spied(this: Context) {
  this.logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
}

function stack_was_logged(this: Context) {
  expect(this.logSpy).toHaveBeenCalledWith("outer => inner => hunt");
  this.logSpy.mockRestore();
}
