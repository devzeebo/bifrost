import type { Agent, AgentName, AgentOptions, AgentRunResult } from "clanker-cleanroom";

export type { AgentRunResult, Agent, AgentOptions, AgentName };
export type { ConfigureAgentOptions } from "./given/agent.js";

export type AgentContext = {
  workspace: string;
  prompt: string;
  agentResult: AgentRunResult;
  agent: Agent;
  image: string;
  model?: string;
};
