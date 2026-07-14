import type { DecoratorFn } from "@bifrost-ai/interfaces-work";
import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { flattenWorkflowBuilder } from "./flatten-workflow.js";
import { continueStep } from "./step-result.js";
import { retry, script, task } from "./step-refs.js";
import { Workflow } from "./workflow.js";

const noopDecorator: DecoratorFn = async (_workItem, _ctx, next) => next();

type Context = {
  definition: ReturnType<typeof flattenWorkflowBuilder>;
};

describe("flattenWorkflowBuilder", () => {
  test("linear workflow chains dependencies", {
    given: { linear_workflow },
    then: { steps_chain_a_to_b_to_c },
  });

  test("diamond workflow fans out and joins", {
    given: { diamond_workflow },
    then: { d_depends_on_b_and_c },
  });

  test("nested workflow flattens with namespaced ids", {
    given: { nested_workflow },
    then: { nested_steps_are_namespaced },
  });

  test("parallel steps with same name get unique ids", {
    given: { parallel_same_name_workflow },
    then: { parallel_step_ids_are_unique },
  });

  test("duplicate nested workflow names get distinct ids", {
    given: { duplicate_nested_workflow },
    then: { nested_workflow_ids_are_distinct },
  });

  test("step decorators are resolved into flow with step wrapper outermost", {
    given: { decorated_workflow },
    then: { step_flow_includes_custom_decorators },
  });

  test("retry decorator is serialized with args in flow", {
    given: { retry_workflow },
    then: { retry_flow_includes_args },
  });
});

function linear_workflow(this: Context) {
  const workflow = new Workflow({ name: "linear" }).step(task("a")).step(task("b")).step(task("c"));
  this.definition = flattenWorkflowBuilder(workflow);
}

function steps_chain_a_to_b_to_c(this: Context) {
  expect(this.definition.steps).toHaveLength(3);
  expect(this.definition.steps[0].dependsOn).toEqual([]);
  expect(this.definition.steps[1].dependsOn).toEqual([this.definition.steps[0].id]);
  expect(this.definition.steps[2].dependsOn).toEqual([this.definition.steps[1].id]);
}

function diamond_workflow(this: Context) {
  const workflow = new Workflow({ name: "diamond" })
    .step(task("a"))
    .step(task("b"), task("c"))
    .step(task("d"));
  this.definition = flattenWorkflowBuilder(workflow);
}

function d_depends_on_b_and_c(this: Context) {
  const [a, b, c, d] = this.definition.steps;
  expect(a.dependsOn).toEqual([]);
  expect(b.dependsOn).toEqual([a.id]);
  expect(c.dependsOn).toEqual([a.id]);
  expect(d.dependsOn.sort()).toEqual([b.id, c.id].sort());
}

function nested_workflow(this: Context) {
  const inner = new Workflow({ name: "inner" })
    .step(script(() => continueStep(), "someFn"))
    .step(task("next"));
  const workflow = new Workflow({ name: "outer" })
    .step(task("a"))
    .step(task("b"), inner)
    .step(script(() => continueStep(), "last"));
  this.definition = flattenWorkflowBuilder(workflow);
}

function nested_steps_are_namespaced(this: Context) {
  const innerStep = this.definition.steps.find((step) =>
    step.id.includes("step2-2[inner]:step1-1[someFn]"),
  );
  const lastStep = this.definition.steps.find((step) => step.id.includes("[last]"));
  expect(innerStep).toBeDefined();
  expect(lastStep?.dependsOn.length).toBeGreaterThan(0);
}

function parallel_same_name_workflow(this: Context) {
  const workflow = new Workflow({ name: "parallel" }).step(task("same"), task("same"));
  this.definition = flattenWorkflowBuilder(workflow);
}

function parallel_step_ids_are_unique(this: Context) {
  const ids = this.definition.steps.map((step) => step.id);
  expect(ids).toHaveLength(2);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids[0]).not.toBe(ids[1]);
}

function duplicate_nested_workflow(this: Context) {
  const inner = new Workflow({ name: "inner" }).step(task("x"));
  const workflow = new Workflow({ name: "outer" }).step(inner, inner).step(task("after"));
  this.definition = flattenWorkflowBuilder(workflow);
}

function nested_workflow_ids_are_distinct(this: Context) {
  const innerSteps = this.definition.steps.filter((step) => step.id.includes("[inner]"));
  expect(innerSteps).toHaveLength(2);
  expect(innerSteps[0]?.id).not.toBe(innerSteps[1]?.id);
  expect(innerSteps[0]?.dependsOn).toEqual([]);
  expect(innerSteps[1]?.dependsOn).toEqual([]);
  const afterStep = this.definition.steps.find((step) => step.id.includes("[after]"));
  expect(afterStep?.dependsOn.sort()).toEqual(innerSteps.map((step) => step.id).sort());
}

function decorated_workflow(this: Context) {
  const workflow = new Workflow({ name: "decorated" }).step(task("a"), ["logging"]).step(
    script(() => continueStep(), "inline"),
    [{ name: "metrics", fn: noopDecorator }],
  );
  this.definition = flattenWorkflowBuilder(workflow);
}

function step_flow_includes_custom_decorators(this: Context) {
  const [taskStep, scriptStep] = this.definition.steps;
  expect(taskStep?.flow).toEqual([taskStep?.id, "logging"]);
  expect(scriptStep?.flow).toEqual([scriptStep?.id, "metrics"]);
  expect(scriptStep?.decoratorFns?.metrics).toBeTypeOf("function");
}

function retry_workflow(this: Context) {
  const workflow = new Workflow({ name: "retry-flow" }).step(task("a"), [retry(4)]);
  this.definition = flattenWorkflowBuilder(workflow);
}

function retry_flow_includes_args(this: Context) {
  const [taskStep] = this.definition.steps;
  expect(taskStep?.flow).toEqual([taskStep?.id, { name: "retry", args: [4] }]);
}
