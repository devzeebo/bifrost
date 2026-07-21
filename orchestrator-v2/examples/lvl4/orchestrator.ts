import { Orchestrator } from "@bifrost-ai/orchestrator";
import { BifrostWorkItemSource } from "@bifrost-ai/work-item-source-bifrost";

import { mapTaskWorkItem } from "./mappers/map-task-work-item.js";

export const orchestrator = new Orchestrator();

orchestrator.registerWorkItemSource(new BifrostWorkItemSource());

orchestrator.addWorkItemMapper("task", mapTaskWorkItem);

// start({ ... }) opens the UI event WebSocket on port 9101 by default.
// Point @bifrost-ai/ui at ws://127.0.0.1:9101 (or set ui: { port } / ui: false).

