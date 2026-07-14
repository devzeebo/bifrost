import type { DecoratorFn } from "@bifrost-ai/interfaces-work";

export const COMPLETE_ON_SUCCESS_DECORATOR = "completeOnSuccess";

export const completeOnSuccess: DecoratorFn = async (workItem, ctx, next) => {
  await next();
  const status = await ctx.workItemSource.getWorkItemStatus(workItem.workItemId);
  if (status === "live") {
    await ctx.workItemSource.completeWorkItem(workItem.workItemId);
  }
};
