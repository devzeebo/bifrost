import type { DecoratorFn } from "@bifrost-ai/interfaces-work";

export const TIMER = "timer";

export const timer: DecoratorFn = async (workItem, ctx, next) => {
  const now = Date.now();

  await next();

  const elapsedTime = Date.now() - now;

  const metrics = workItem.state.metrics as any;

  await ctx.setState({
    ...workItem.state,
    metrics: {
      startTime: metrics.startTime ?? new Date().toISOString(),
      ...metrics,
      elapsedTime: metrics.elapsedTime + elapsedTime,
      endTime: new Date().toISOString(),
    },
  });
};
