import type { WorkItemMapper } from "@bifrost-ai/orchestrator";
import { type RuneDetail } from "@bifrost-ai/work-item-source-bifrost";

export const mapWorkflowWorkItem: WorkItemMapper<RuneDetail> = (workItem) => {
  return {
    ...workItem,
    state: {
      ...workItem.state,
      definitionName: workItem.name,
    },
  };
};
