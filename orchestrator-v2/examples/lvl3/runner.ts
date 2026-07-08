import { Runner, createDataRegistry } from "@bifrost-ai/runner";
import "@bifrost-ai/agent-3-task/augment";
import { loadAgent, taskAgentDataGuards } from "@bifrost-ai/agent-3-task";
import { CursorEngine } from "@bifrost-ai/engine-cursor";

import { doSomething } from "./doSomething.js";

export const runner = new Runner({ data: createDataRegistry(taskAgentDataGuards) });

runner.registerEngine("cursor", new CursorEngine());
runner.registerTaskAgent("cowsay", await loadAgent("./agents/cowsay/AGENT.md"));
runner.registerScriptAgent("doSomething", doSomething);
