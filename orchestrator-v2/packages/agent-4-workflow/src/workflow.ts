import type { StepDecorator, WorkflowStepInput } from "./step-refs.js";

export type WorkflowGroupItem = WorkflowStepInput | Workflow;

export class Workflow {
  public readonly name: string;
  public readonly groups: WorkflowGroupItem[][] = [];

  public constructor(options: { name: string }) {
    this.name = options.name;
  }

  public step(...items: [...WorkflowGroupItem[], StepDecorator[]]): this;
  public step(first: WorkflowGroupItem, ...rest: WorkflowGroupItem[]): this;
  public step(...args: (WorkflowGroupItem | StepDecorator[])[]): this {
    let decorators: StepDecorator[] = [];
    let items: WorkflowGroupItem[];

    const last = args.at(-1);
    if (last !== undefined && isStepDecoratorArray(last)) {
      decorators = last;
      items = args.slice(0, -1) as WorkflowGroupItem[];
    } else {
      items = args as WorkflowGroupItem[];
    }

    this.groups.push(items.map((item) => applyDecorators(item, decorators)));
    return this;
  }
}

function applyDecorators(item: WorkflowGroupItem, decorators: StepDecorator[]): WorkflowGroupItem {
  if (item instanceof Workflow || decorators.length === 0) {
    return item;
  }

  return {
    ...item,
    decorators: [...(item.decorators ?? []), ...decorators],
  };
}

function isStepDecoratorArray(value: unknown): value is StepDecorator[] {
  return Array.isArray(value) && value.every(isStepDecorator);
}

function isStepDecorator(value: unknown): value is StepDecorator {
  if (typeof value === "string") {
    return true;
  }

  return (
    value !== null && typeof value === "object" && "fn" in value && typeof value.fn === "function"
  );
}
