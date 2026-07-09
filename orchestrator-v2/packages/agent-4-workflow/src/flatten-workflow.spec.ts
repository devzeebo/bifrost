import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { flattenWorkflowBuilder } from "./flatten-workflow.js";
import { script, task } from "./step-refs.js";
import { Workflow } from "./workflow.js";

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
    .step(script(() => ({ outcome: "completed" }), "someFn"))
    .step(task("next"));
  const workflow = new Workflow({ name: "outer" })
    .step(task("a"))
    .step(task("b"), inner)
    .step(script(() => ({ outcome: "completed" }), "last"));
  this.definition = flattenWorkflowBuilder(workflow);
}

function nested_steps_are_namespaced(this: Context) {
  const innerStep = this.definition.steps.find((step) => step.id.includes("inner:step1[someFn]"));
  const lastStep = this.definition.steps.find((step) => step.id.includes("[last]"));
  expect(innerStep).toBeDefined();
  expect(lastStep?.dependsOn.length).toBeGreaterThan(0);
}
