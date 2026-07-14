import type { DecoratorFn } from "@bifrost-ai/interfaces-work";

export const FAIL_ON_ERROR_DECORATOR = "failOnError";

export const failOnError: DecoratorFn = async (workItem, ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error("Script execution failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    await ctx.workItemSource.failWorkItem(workItem.workItemId, message);
  }
};
