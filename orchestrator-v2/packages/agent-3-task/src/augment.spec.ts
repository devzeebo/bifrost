import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";
import { Runner, createDataRegistry } from "@bifrost-ai/runner";

import "./augment.js";
import { taskAgentDataGuards } from "./types.js";

describe("agent-3-task/augment", () => {
  test("registers a task agent by dispatch name", {
    given: { a_runner_with_task_guards },
    when: { a_task_agent_is_registered },
    then: { the_handler_is_available_by_dispatch_name },
  });
});

type Context = {
  runner: Runner;
};

function a_runner_with_task_guards(this: Context) {
  this.runner = new Runner({ data: createDataRegistry(taskAgentDataGuards) });
}

function a_task_agent_is_registered(this: Context) {
  this.runner.registerTaskAgent("greeter", {
    name: "ignored",
    description: "greets",
    promptBody: "say hi",
    template: { parameters: {} },
    tools: [],
  });
}

function the_handler_is_available_by_dispatch_name(this: Context) {
  expect(this.runner.hasWorkItemHandler("task", "greeter")).toBe(true);
}
