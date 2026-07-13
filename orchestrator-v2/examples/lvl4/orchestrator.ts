import { Orchestrator } from "@bifrost-ai/orchestrator";
import { BifrostWorkItemSource } from "@bifrost-ai/work-item-source-bifrost";

import { mapTaskWorkItem } from "./mappers/map-task-work-item.js";
import { mapWorkflowWorkItem } from "./mappers/map-workflow-work-item.js";

export const orchestrator = new Orchestrator();

orchestrator.registerWorkItemSource(new BifrostWorkItemSource());

orchestrator.addWorkItemMapper("task", mapTaskWorkItem);
orchestrator.addWorkItemMapper("workflow", mapWorkflowWorkItem);
