import type { WorkItemHandler, WorkItemResult } from "@bifrost-ai/interfaces-work";
import { Runner } from "@bifrost-ai/runner";

import { flattenWorkflowBuilder } from "./flatten-workflow.js";
import { createWorkflowAgent } from "./create-workflow-agent.js";
import type { ScriptRef } from "./step-refs.js";
import { createStepWrapperHandler } from "./step-wrapper.js";
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
  validateDefinition(this, definition);
  registerScriptSteps(this, workflow);
  registerStepWrappers(this, definition);
  this.registerWorkItemHandler(createWorkflowAgent(definition, definition.name));
  return definition;
};

function validateDefinition(runner: Runner, definition: WorkflowDefinition): void {
  for (const step of definition.steps) {
    if (step.innerKind === "task" && !runner.hasWorkItemHandler("task", step.innerName)) {
      throw new Error(`Task agent not registered: ${step.innerName}`);
    }
  }
}

function registerScriptSteps(runner: Runner, workflow: Workflow): void {
  for (const ref of collectScriptRefs(workflow)) {
    if (!runner.hasWorkItemHandler("script", ref.displayName)) {
      runner.registerWorkItemHandler(createWorkflowScriptHandler(ref));
    }
  }
}

function createWorkflowScriptHandler(ref: ScriptRef): WorkItemHandler {
  return {
    kind: "script",
    name: ref.displayName,
    async run(workItem, ctx) {
      const cwd =
        typeof workItem.state.workingDir === "string" && workItem.state.workingDir.length > 0
          ? workItem.state.workingDir
          : process.cwd();
      return ref.fn({ workItem, cwd, setState: ctx.setState }) as unknown as WorkItemResult;
    },
  };
}

function registerStepWrappers(runner: Runner, definition: WorkflowDefinition): void {
  for (const step of definition.steps) {
    if (!runner.hasWorkItemHandler("script", step.id)) {
      runner.registerWorkItemHandler(createStepWrapperHandler(step));
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
