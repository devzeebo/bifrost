import type {
  DecoratorFactory,
  DecoratorFn,
  ScriptContext,
  ScriptFn,
  WorkItem,
} from "@bifrost-ai/interfaces-work";
import { normalizeFlowEntry, type NormalizedFlowEntry } from "@bifrost-ai/interfaces-work";

import type { Registry } from "./registry.js";

export type ResolvedStack<TData extends Record<string, unknown> = Record<string, unknown>> = {
  script: ScriptFn<TData>;
  decorators: DecoratorFn<TData>[];
  /** Decorator names then script name, in the order layers execute (outermost first). */
  layers: string[];
};

export function formatScriptStack(layers: readonly string[]): string {
  return layers.join(" => ");
}

export function resolveStack<TData extends Record<string, unknown> = Record<string, unknown>>(
  workItem: WorkItem,
  scripts: Registry<ScriptFn<TData>>,
  decorators: Registry<DecoratorFactory<TData>>,
  conventions: readonly string[],
): ResolvedStack<TData> {
  const script = scripts.get(workItem.name);
  if (script === undefined) {
    throw new Error(`Unknown script: ${workItem.name}`);
  }

  const flowEntries: NormalizedFlowEntry[] = [
    ...conventions.map((name) => ({ name, args: [] as unknown[] })),
    ...workItem.flow.map(normalizeFlowEntry),
  ];
  const resolvedDecorators: DecoratorFn<TData>[] = [];

  for (const entry of flowEntries) {
    const factory = decorators.get(entry.name);
    if (factory === undefined) {
      throw new Error(`Unknown decorator: ${entry.name}`);
    }
    resolvedDecorators.push(factory(...entry.args));
  }

  return {
    script,
    decorators: resolvedDecorators,
    layers: [...flowEntries.map((entry) => entry.name), workItem.name],
  };
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
  console.log(formatScriptStack(stack.layers));
  const run = composeStack(workItem, ctx, stack.script, stack.decorators);
  await run();
}
