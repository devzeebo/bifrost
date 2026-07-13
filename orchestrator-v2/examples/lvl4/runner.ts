import { Runner, createDataRegistry } from "@bifrost-ai/runner";
import "@bifrost-ai/agent-3-task/augment";
import "@bifrost-ai/agent-4-workflow/augment";
import { loadAgent, taskAgentDataGuards } from "@bifrost-ai/agent-3-task";
import { CursorEngine } from "@bifrost-ai/engine-cursor";

import { agentPath as cowsayAgentPath } from "./agents/cowsay/index.js";
import { createCowsayFlow } from "./agents/cowsay-flow/index.js";

export const runner = new Runner({ data: createDataRegistry(taskAgentDataGuards) });

runner.registerEngine("cursor", new CursorEngine());
runner.registerTaskAgent("cowsay", await loadAgent(cowsayAgentPath));
runner.registerWorkflowAgent(createCowsayFlow());
