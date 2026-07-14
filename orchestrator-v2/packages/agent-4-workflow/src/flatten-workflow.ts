import type { FlattenedStep, WorkflowDefinition } from "./types.js";
import type { WorkflowStepInput } from "./step-refs.js";
import { Workflow } from "./workflow.js";

export function flattenWorkflowBuilder(workflow: Workflow, parentPrefix = ""): WorkflowDefinition {
  const name = workflow.name;
  const prefix = parentPrefix.length > 0 ? `${parentPrefix}:${name}` : name;
  const { steps } = flattenWorkflowGroup(workflow, prefix, []);
  return { name, steps };
}

function flattenWorkflowGroup(
  workflow: Workflow,
  prefix: string,
  entryDeps: string[],
): { steps: FlattenedStep[]; exitStepIds: string[] } {
  const steps: FlattenedStep[] = [];
  let previousExitIds = [...entryDeps];

  for (const [groupIndex, group] of workflow.groups.entries()) {
    const groupExitIds: string[] = [];

    for (const [itemIndex, item] of group.entries()) {
      if (item instanceof Workflow) {
        const nestedPrefix = `${prefix}:step${groupIndex + 1}-${itemIndex + 1}[${item.name}]`;
        const nested = flattenWorkflowGroup(item, nestedPrefix, previousExitIds);
        steps.push(...nested.steps);
        if (nested.exitStepIds.length > 0) {
          groupExitIds.push(...nested.exitStepIds);
        }
        continue;
      }

      const stepId = buildStepId(prefix, groupIndex, itemIndex, item);
      const { flow, decoratorFns } = resolveStepFlow(item, stepId);
      steps.push({
        id: stepId,
        innerKind: item.type === "task" ? "task" : "script",
        innerName: item.type === "task" ? item.name : item.displayName,
        dependsOn: [...previousExitIds],
        flow,
        ...(Object.keys(decoratorFns).length > 0 ? { decoratorFns } : {}),
      });
      groupExitIds.push(stepId);
    }

    previousExitIds = groupExitIds;
  }

  return { steps, exitStepIds: previousExitIds };
}

function buildStepId(
  prefix: string,
  groupIndex: number,
  itemIndex: number,
  item: WorkflowStepInput,
): string {
  const stepLabel = `step${groupIndex + 1}-${itemIndex + 1}`;
  if (item.type === "script") {
    return `${prefix}:${stepLabel}[${item.displayName}]`;
  }
  return `${prefix}:${stepLabel}[${item.name}]`;
}

function resolveStepFlow(
  step: WorkflowStepInput,
  stepId: string,
): { flow: string[]; decoratorFns: NonNullable<FlattenedStep["decoratorFns"]> } {
  const flow: string[] = [stepId];
  const decoratorFns: NonNullable<FlattenedStep["decoratorFns"]> = {};

  for (const [index, decorator] of (step.decorators ?? []).entries()) {
    if (typeof decorator === "string") {
      flow.push(decorator);
      continue;
    }

    const name = decorator.name.length > 0 ? decorator.name : `${stepId}:decorator-${index}`;
    flow.push(name);
    decoratorFns[name] = decorator.fn;
  }

  return { flow, decoratorFns };
}
