// Recording a terminal outcome (complete/fail/pause) to the task source must never throw
// out of an RPC handler: a failure there would leak the peer's in-flight slot or escape
// as an unhandled rejection. `recordBestEffort` guarantees a resolving promise, logging any
// task-source failure instead of propagating it.
export async function recordBestEffort(
  record: () => Promise<void>,
  context: string,
): Promise<void> {
  try {
    await record();
  } catch (error) {
    console.error(`Task source failed to ${context}:`, error);
  }
}
