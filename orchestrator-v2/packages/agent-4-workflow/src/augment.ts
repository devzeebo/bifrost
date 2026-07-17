import type { ScriptFn } from "@bifrost-ai/interfaces-work";
import { getFlowEntryName } from "@bifrost-ai/interfaces-work";
import { Runner } from "@bifrost-ai/runner";

import { flattenWorkflowBuilder } from "./flatten-workflow.js";
import { createWorkflowScript } from "./create-workflow-agent.js";
import { createWorkflowDebug } from "./debug.js";
import type { ScriptRef } from "./step-refs.js";
import { createRetryDecorator, RETRY_DECORATOR } from "./retry.js";
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
  const debug = createWorkflowDebug(definition.name);
  debug("registering workflow stepCount=%d", definition.steps.length);
  registerScriptSteps(this, workflow);
  registerGlobalDecorators(this);
  registerStepDecorators(this, definition);
  validateDefinition(this, definition);
  this.registerScript(definition.name, createWorkflowScript(definition));
  debug("registered workflow");
  return definition;
};

function registerGlobalDecorators(runner: Runner): void {
  if (!runner.hasDecorator(RETRY_DECORATOR)) {
    runner.registerDecorator(RETRY_DECORATOR, createRetryDecorator);
  }
}

function validateDefinition(runner: Runner, definition: WorkflowDefinition): void {
  for (const step of definition.steps) {
    if (step.innerKind === "task" && !runner.hasScript(step.innerName)) {
      throw new Error(`Task agent not registered: ${step.innerName}`);
    }

    for (const entry of step.flow) {
      const decoratorName = getFlowEntryName(entry);
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
      runner.registerDecorator(step.id, () => createStepDecorator(step, definition.name));
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
