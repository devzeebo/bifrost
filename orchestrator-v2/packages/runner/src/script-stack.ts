import type { DecoratorFn, ScriptContext, ScriptFn, WorkItem } from "@bifrost-ai/interfaces-work";

import type { Registry } from "./registry.js";

export type ResolvedStack<TData extends Record<string, unknown> = Record<string, unknown>> = {
  script: ScriptFn<TData>;
  decorators: DecoratorFn<TData>[];
};

export function resolveStack<TData extends Record<string, unknown> = Record<string, unknown>>(
  workItem: WorkItem,
  scripts: Registry<ScriptFn<TData>>,
  decorators: Registry<DecoratorFn<TData>>,
  conventions: readonly string[],
): ResolvedStack<TData> {
  const script = scripts.get(workItem.name);
  if (script === undefined) {
    throw new Error(`Unknown script: ${workItem.name}`);
  }

  const decoratorNames = [...conventions, ...workItem.flow];
  const resolvedDecorators: DecoratorFn<TData>[] = [];

  for (const name of decoratorNames) {
    const decorator = decorators.get(name);
    if (decorator === undefined) {
      throw new Error(`Unknown decorator: ${name}`);
    }
    resolvedDecorators.push(decorator);
  }

  return { script, decorators: resolvedDecorators };
}

export function composeStack<TData extends Record<string, unknown>>(
  workItem: WorkItem,
  ctx: ScriptContext<TData>,
  script: ScriptFn<TData>,
  decoratorFns: DecoratorFn<TData>[],
): () => Promise<void> {
  let inner: () => Promise<unknown> = () => script(workItem, ctx);

  for (const decorator of decoratorFns.toReversed()) {
    const next = inner;
    inner = () => decorator(workItem, ctx, next);
  }

  return async () => {
    await inner();
  };
}

export async function executeScriptStack<TData extends Record<string, unknown>>(
  workItem: WorkItem,
  ctx: ScriptContext<TData>,
  stack: ResolvedStack<TData>,
): Promise<void> {
  const run = composeStack(workItem, ctx, stack.script, stack.decorators);
  await run();
}
