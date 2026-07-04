import type {
  WorkItem,
  WorkItemExecutionContext,
  WorkItemHandler,
  WorkItemResult,
} from "@bifrost-ai/interfaces-work";

export async function executeWorkItem(
  handler: WorkItemHandler,
  workItem: WorkItem,
  ctx: WorkItemExecutionContext,
): Promise<WorkItemResult> {
  try {
    return await handler.run(workItem, ctx);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { outcome: "failed", message };
  }
}
