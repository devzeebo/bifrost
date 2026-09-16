import { Agent } from "./agent.js";
import type { AgentBinding } from "./types.js";

export type CreateAgentBindings = AgentBinding;

/** Wrap a custom binding that is not registered by name. */
export function createAgent(binding: AgentBinding): Agent {
  return Agent.fromBinding(binding);
}
