import type { DecoratorFactory, DecoratorFn } from "@bifrost-ai/interfaces-work";

import { createWorkflowDebug, getWorkflowNameFromWorkItem } from "./debug.js";

export const RETRY_DECORATOR = "retry";

export type RetryState = {
  maxAttempts: number;
  currentAttempt: number;
};

export const createRetryDecorator: DecoratorFactory = (...args: unknown[]): DecoratorFn => {
  const maxAttempts = args[0];
  if (typeof maxAttempts !== "number" || maxAttempts < 1) {
    throw new Error("retry maxAttempts must be a positive number");
  }

  return async (workItem, ctx, next) => {
    const debug = createWorkflowDebug(getWorkflowNameFromWorkItem(workItem));
    const retryState: RetryState = {
      maxAttempts,
      currentAttempt: 1,
    };
    await ctx.setState({ retry: retryState });
    debug("start workItemId=%s maxAttempts=%d", workItem.workItemId, maxAttempts);

    while (true) {
      try {
        debug(
          "attempt workItemId=%s attempt=%d/%d",
          workItem.workItemId,
          retryState.currentAttempt,
          maxAttempts,
        );
        return await next();
      } catch (error) {
        if (retryState.currentAttempt >= retryState.maxAttempts) {
          const message = error instanceof Error ? error.message : String(error);
          debug(
            "exhausted workItemId=%s attempts=%d message=%s",
            workItem.workItemId,
            maxAttempts,
            message,
          );
          throw error;
        }
        debug(
          "retry workItemId=%s attempt=%d/%d",
          workItem.workItemId,
          retryState.currentAttempt,
          maxAttempts,
        );
        retryState.currentAttempt += 1;
        await ctx.setState({ retry: { ...retryState } });
      }
    }
  };
};
