import type { AgentDefinition } from "@bifrost-ai/engine";

export type BuildPromptOptions = {
  agent: AgentDefinition;
  state: Record<string, unknown>;
  metadata: Record<string, unknown>;
  instructions: string;
};

const promptSection = (name: string, body: string) => `<${name}>${body}</${name}>`;

export const buildPrompt = (options: BuildPromptOptions): string => {
  const { agent, metadata: _metadata, instructions } = options;
  return [
    promptSection("AgentDefinition", agent.promptBody),
    promptSection("FeatureDefinition", instructions),
  ].join("\n");
};
