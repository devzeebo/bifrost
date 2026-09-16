import type { AgentContext } from "../types.js";

export function the_prompt(prompt: string) {
  return function (this: AgentContext): void {
    this.prompt = prompt;
  };
}
