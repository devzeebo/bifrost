import type { AgentContext } from "../types.js";

export async function executing_the_agent(this: AgentContext): Promise<void> {
  if (this.workspace === undefined || this.workspace === "") {
    throw new Error("executing_the_agent requires this.workspace; use a_workspace in given");
  }

  if (this.prompt === undefined || this.prompt === "") {
    throw new Error("executing_the_agent requires this.prompt; use the_prompt(...) in given");
  }

  if (this.agent === undefined) {
    throw new Error(
      "executing_the_agent requires this.agent; use agent({ name, model }) in withAspect",
    );
  }

  this.agentResult = await this.agent.run({
    workspace: this.workspace,
    prompt: this.prompt,
    image: this.image,
    ...(this.model !== undefined ? { model: this.model } : {}),
  });
}
