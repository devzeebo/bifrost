import type { DecoratorFn } from "@bifrost-ai/interfaces-work";

export const LOG_STEP_DECORATOR = "logStep";

export const logStep: DecoratorFn = async (workItem, _ctx, next) => {
  console.log(`[${workItem.name}] starting`);
  const result = await next();
  console.log(`[${workItem.name}] finished`);
  return result;
};

export const logPrepare: DecoratorFn = async (workItem, _ctx, next) => {
  console.log(`prepare child ${workItem.workItemId}`);
  return next();
};
