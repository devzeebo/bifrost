import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";
import { Runner } from "@bifrost-ai/runner";

import "./augment.js";

describe("agent-3-task/augment on a bare Runner", () => {
  test("registers a task agent without pre-wiring a data registry", {
    given: { a_bare_runner },
    when: { a_task_agent_is_registered },
    then: { the_handler_is_available },
  });
});

type Context = {
  runner: Runner;
};

function a_bare_runner(this: Context) {
  // A bare `new Runner()` starts with an empty data registry; the augment must
  // lazily create the agentDefinition registry (regression: it used to throw).
  this.runner = new Runner();
}

function a_task_agent_is_registered(this: Context) {
  this.runner.registerTaskAgent({
    name: "greeter",
    description: "greets",
    promptBody: "say hi",
    template: { parameters: {} },
    tools: [],
  });
}

function the_handler_is_available(this: Context) {
  expect(this.runner.hasWorkItemHandler("task", "greeter")).toBe(true);
}
