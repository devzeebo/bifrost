import type { StepDecorator, WorkflowStepInput } from "./step-refs.js";
import type { ScheduleHook, VerifyHook, WorkflowHooks } from "./types.js";

export type WorkflowGroupItem = WorkflowStepInput | Workflow;

export class Workflow {
  public readonly name: string;
  public readonly groups: WorkflowGroupItem[][] = [];
  readonly #hooks: WorkflowHooks = {};

  public constructor(options: { name: string }) {
    this.name = options.name;
  }

  public get hooks(): WorkflowHooks {
    return this.#hooks;
  }

  public onBeforeCreateStepList(hook: ScheduleHook): this {
    (this.#hooks.onBeforeCreateStepList ??= []).push(hook);
    return this;
  }

  public onBeforeDraftChildren(hook: ScheduleHook): this {
    (this.#hooks.onBeforeDraftChildren ??= []).push(hook);
    return this;
  }

  public onBeforeWireDependencies(hook: ScheduleHook): this {
    (this.#hooks.onBeforeWireDependencies ??= []).push(hook);
    return this;
  }

  public onBeforeStartChildren(hook: ScheduleHook): this {
    (this.#hooks.onBeforeStartChildren ??= []).push(hook);
    return this;
  }

  public onAfterStartChildren(hook: ScheduleHook): this {
    (this.#hooks.onAfterStartChildren ??= []).push(hook);
    return this;
  }

  public onBeforeVerify(hook: VerifyHook): this {
    (this.#hooks.onBeforeVerify ??= []).push(hook);
    return this;
  }

  public onAfterVerify(hook: VerifyHook): this {
    (this.#hooks.onAfterVerify ??= []).push(hook);
    return this;
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

  if (value === null || typeof value !== "object" || !("fn" in value)) {
    return false;
  }

  if (typeof value.fn !== "function") {
    return false;
  }

  if ("args" in value) {
    return Array.isArray(value.args);
  }

  return true;
}
