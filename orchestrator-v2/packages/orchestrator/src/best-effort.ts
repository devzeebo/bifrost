/**
 * Run a work-item-source callback for its side effect, swallowing (and logging)
 * any error. Terminal bookkeeping — freeing the peer's slot, answering the
 * runner — must not depend on the source succeeding, so a throwing callback is
 * recorded best-effort rather than allowed to wedge the peer or escape as an
 * unhandled rejection.
 */
export async function recordBestEffort(
  record: () => Promise<void>,
  context: string,
): Promise<void> {
  try {
    await record();
  } catch (error) {
    console.error(`Work item source failed to ${context}:`, error);
  }
}
