import type { AgentDefinition, Engine } from "@bifrost-ai/engine";
import { Runner } from "@bifrost-ai/runner";

import { createTaskAgent } from "./create-task-agent.js";
import {
  AGENT_DEFINITION_DATA_TYPE,
  ENGINE_DATA_TYPE,
  isAgentDefinition,
  isEngine,
} from "./types.js";

declare module "@bifrost-ai/runner" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- module augmentation
  interface Runner {
    registerTaskAgent(agent: AgentDefinition): void;
    registerEngine(name: string, engine: Engine): void;
  }
}

Runner.prototype.registerTaskAgent = function registerTaskAgent(
  this: Runner,
  agent: AgentDefinition,
): void {
  this.data.ensure(AGENT_DEFINITION_DATA_TYPE, isAgentDefinition).register(agent.name, agent);
  this.registerWorkItemHandler(createTaskAgent(agent));
};

Runner.prototype.registerEngine = function registerEngine(
  this: Runner,
  name: string,
  engine: Engine,
): void {
  this.data.ensure(ENGINE_DATA_TYPE, isEngine).register(name, engine);
};
