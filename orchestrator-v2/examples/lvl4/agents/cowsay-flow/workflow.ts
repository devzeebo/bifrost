import { script, task, Workflow } from "@bifrost-ai/agent-4-workflow";

import { prepare } from "./prepare.js";
import { summarize } from "./summarize.js";

export const COWSAY_FLOW = "cowsay-flow";

export function createCowsayFlow(): Workflow {
  return new Workflow({ name: COWSAY_FLOW })
    .step(script(prepare, "prepare"))
    .step(task("cowsay"))
    .step(script(summarize, "summarize"));
}
