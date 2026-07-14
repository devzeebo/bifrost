import type { DecoratorFactory, DecoratorFn } from "@bifrost-ai/interfaces-work";

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

  return async (_workItem, ctx, next) => {
    const retryState: RetryState = {
      maxAttempts,
      currentAttempt: 1,
    };
    await ctx.setState({ retry: retryState });

    while (true) {
      try {
        return await next();
      } catch (error) {
        if (retryState.currentAttempt >= retryState.maxAttempts) {
          throw error;
        }
        retryState.currentAttempt += 1;
        await ctx.setState({ retry: { ...retryState } });
      }
    }
  };
};
