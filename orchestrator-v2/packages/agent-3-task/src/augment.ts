import type { AgentDefinition, Engine } from "@bifrost-ai/engine";
import { Runner } from "@bifrost-ai/runner";

import { createTaskAgent } from "./create-task-agent.js";
import { AGENT_DEFINITION_DATA_TYPE, ENGINE_DATA_TYPE } from "./types.js";

declare module "@bifrost-ai/runner" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- module augmentation
  interface Runner {
    registerTaskAgent(name: string, agent: AgentDefinition): void;
    registerEngine(name: string, engine: Engine): void;
    registerScript(kind: string, fn: import("@bifrost-ai/interfaces-work").ScriptFn): void;
  }
}

Runner.prototype.registerTaskAgent = function registerTaskAgent(
  this: Runner,
  name: string,
  agent: AgentDefinition,
): void {
  this.data.get(AGENT_DEFINITION_DATA_TYPE).register(name, agent);
  this.registerScript(name, createTaskAgent(agent, name));
};

Runner.prototype.registerEngine = function registerEngine(
  this: Runner,
  name: string,
  engine: Engine,
): void {
  this.data.get(ENGINE_DATA_TYPE).register(name, engine);
};
