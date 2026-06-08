import Handlebars from "handlebars";

type RenderContext = {
  taskId: string;
  taskState: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export const renderPrompt = (promptBody: string, context: RenderContext): string => {
  const template = Handlebars.compile(promptBody, {
    strict: false,
    knownHelpers: { if: true },
  });

  return template({ taskId: context.taskId, ...context.taskState });
};
