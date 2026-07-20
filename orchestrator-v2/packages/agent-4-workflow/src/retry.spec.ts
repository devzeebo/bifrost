import type { ScriptContext } from "@bifrost-ai/interfaces-work";
import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { createRetryDecorator } from "./retry.js";

type Context = {
  setStateCalls: Array<Record<string, unknown>>;
  attempts: number;
  error: Error | null;
};

const scriptContext = (ctx: Context): ScriptContext => ({
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
  async setState(state) {
    ctx.setStateCalls.push(state);
  },
});

const workItem = {
  workItemId: "wi-1",
  kind: "script",
  name: "hunt",
  flow: [],
  state: {},
  metadata: {},
};

describe("createRetryDecorator", () => {
  test("initializes retry state and succeeds when next succeeds", {
    given: { retry_context },
    when: { running_successful_next },
    then: { retry_state_initialized },
  });

  test("retries until next succeeds", {
    given: { retry_context },
    when: { running_flaky_next },
    then: { succeeds_on_third_attempt },
  });

  test("throws after max attempts", {
    given: { retry_context },
    when: { running_always_failing_next },
    then: { throws_after_max_attempts },
  });
});

function retry_context(this: Context) {
  this.setStateCalls = [];
  this.attempts = 0;
  this.error = null;
}

async function running_successful_next(this: Context) {
  const decorator = createRetryDecorator(3);
  await decorator(workItem, scriptContext(this), async () => "ok");
}

async function running_flaky_next(this: Context) {
  const decorator = createRetryDecorator(3);
  await decorator(workItem, scriptContext(this), async () => {
    this.attempts += 1;
    if (this.attempts < 3) {
      throw new Error("not yet");
    }
    return "ok";
  });
}

async function running_always_failing_next(this: Context) {
  const decorator = createRetryDecorator(2);
  try {
    await decorator(workItem, scriptContext(this), async () => {
      this.attempts += 1;
      throw new Error("fail");
    });
    this.error = null;
  } catch (error) {
    this.error = error as Error;
  }
}

function retry_state_initialized(this: Context) {
  expect(this.setStateCalls[0]).toEqual({
    retry: { maxAttempts: 3, currentAttempt: 1 },
  });
}

function succeeds_on_third_attempt(this: Context) {
  expect(this.attempts).toBe(3);
  expect(this.setStateCalls.at(-1)).toEqual({
    retry: { maxAttempts: 3, currentAttempt: 3 },
  });
}

function throws_after_max_attempts(this: Context) {
  expect(this.attempts).toBe(2);
  expect(this.error?.message).toBe("fail");
}
