import { Agent, ensureDockerImage, type RegistryOptions } from "clanker-cleanroom";

import type { AgentContext } from "../types.js";

export type ConfigureAgentOptions = {
  /** Registered stock short name or a registry tag (`cursor:node`). */
  name: string;
  model?: string;
  /** Override the resolved Docker image tag. */
  image?: string;
} & RegistryOptions;

export function agent(options: ConfigureAgentOptions) {
  return async function (this: AgentContext): Promise<void> {
    const registryOptions =
      options.packageRoot !== undefined ? { packageRoot: options.packageRoot } : {};
    const resolved = new Agent(options.name, registryOptions);

    this.agent = resolved;
    this.image = options.image ?? resolved.image;

    if (options.model !== undefined) {
      this.model = options.model;
    }

    await ensureDockerImage(this.image);
  };
}
