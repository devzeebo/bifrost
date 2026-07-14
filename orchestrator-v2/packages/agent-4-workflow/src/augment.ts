import type { ScriptFn } from "@bifrost-ai/interfaces-work";
import { Runner } from "@bifrost-ai/runner";

import { flattenWorkflowBuilder } from "./flatten-workflow.js";
import { createWorkflowScript } from "./create-workflow-agent.js";
import type { ScriptRef } from "./step-refs.js";
import { createStepDecorator } from "./step-wrapper.js";
import type { WorkflowDefinition } from "./types.js";
import { Workflow } from "./workflow.js";

declare module "@bifrost-ai/runner" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- module augmentation
  interface Runner {
    registerWorkflowAgent(workflow: Workflow): WorkflowDefinition;
  }
}

Runner.prototype.registerWorkflowAgent = function registerWorkflowAgent(
  this: Runner,
  workflow: Workflow,
): WorkflowDefinition {
  const definition = flattenWorkflowBuilder(workflow);
  registerScriptSteps(this, workflow);
  registerStepDecorators(this, definition);
  validateDefinition(this, definition);
  this.registerScript(definition.name, createWorkflowScript(definition));
  return definition;
};

function validateDefinition(runner: Runner, definition: WorkflowDefinition): void {
  for (const step of definition.steps) {
    if (step.innerKind === "task" && !runner.hasScript(step.innerName)) {
      throw new Error(`Task agent not registered: ${step.innerName}`);
    }

    for (const decoratorName of step.flow) {
      if (decoratorName === step.id) {
        continue;
      }
      if (!runner.hasDecorator(decoratorName)) {
        throw new Error(`Decorator not registered: ${decoratorName}`);
      }
    }
  }
}

function registerScriptSteps(runner: Runner, workflow: Workflow): void {
  for (const ref of collectScriptRefs(workflow)) {
    if (!runner.hasScript(ref.displayName)) {
      runner.registerScript(ref.displayName, createWorkflowInlineScript(ref));
    }
  }
}

function createWorkflowInlineScript(ref: ScriptRef): ScriptFn {
  return async (workItem, ctx) => ref.fn({ workItem, cwd: ctx.cwd, setState: ctx.setState });
}

function registerStepDecorators(runner: Runner, definition: WorkflowDefinition): void {
  for (const step of definition.steps) {
    if (step.decoratorFns !== undefined) {
      for (const [name, fn] of Object.entries(step.decoratorFns)) {
        if (!runner.hasDecorator(name)) {
          runner.registerDecorator(name, fn);
        }
      }
    }

    if (!runner.hasDecorator(step.id)) {
      runner.registerDecorator(step.id, createStepDecorator(step));
    }
  }
}

function collectScriptRefs(workflow: Workflow): ScriptRef[] {
  const refs: ScriptRef[] = [];
  for (const group of workflow.groups) {
    for (const item of group) {
      if (item instanceof Workflow) {
        refs.push(...collectScriptRefs(item));
        continue;
      }
      if (item.type === "script") {
        refs.push(item);
      }
    }
  }
  return refs;
}
