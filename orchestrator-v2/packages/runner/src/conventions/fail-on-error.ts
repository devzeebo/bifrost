import type { DecoratorFn } from "@bifrost-ai/interfaces-work";

export const FAIL_ON_ERROR_DECORATOR = "failOnError";

export const failOnError: DecoratorFn = async (_workItem, _ctx, next) => {
  try {
    return await next();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { outcome: "failed", message };
  }
};
