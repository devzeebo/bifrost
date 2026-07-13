import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Runner, createDataRegistry } from "@bifrost-ai/runner";
import "@bifrost-ai/agent-3-task/augment";
import { loadAgent, taskAgentDataGuards } from "@bifrost-ai/agent-3-task";
import { CursorEngine } from "@bifrost-ai/engine-cursor";

import { doSomething } from "./doSomething.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const cowsayAgentPath = join(moduleDir, "agents/cowsay/AGENT.md");

export const runner = new Runner({ data: createDataRegistry(taskAgentDataGuards) });

runner.registerEngine("cursor", new CursorEngine());
runner.registerTaskAgent("cowsay", await loadAgent(cowsayAgentPath));
runner.registerScript("doSomething", doSomething);
