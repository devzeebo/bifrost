import type { WorkflowStepInput } from "./step-refs.js";

export type WorkflowGroupItem = WorkflowStepInput | Workflow;

export class Workflow {
  public readonly name: string;
  public readonly groups: WorkflowGroupItem[][] = [];

  public constructor(options: { name: string }) {
    this.name = options.name;
  }

  public step(...items: WorkflowGroupItem[]): this {
    if (items.length > 0) {
      this.groups.push(items);
    }
    return this;
  }
}
