import { script, task, Workflow } from "@bifrost-ai/agent-4-workflow";

import { LOG_STEP_DECORATOR, logPrepare } from "./decorators.js";
import { prepare } from "./prepare.js";
import { summarize } from "./summarize.js";

export const COWSAY_FLOW = "cowsay-flow";

export function createCowsayFlow(): Workflow {
  return new Workflow({ name: COWSAY_FLOW })
    .step(script(prepare, "prepare"), [{ name: "logPrepare", fn: logPrepare }])
    .step(task("cowsay"), [LOG_STEP_DECORATOR])
    .step(script(summarize, "summarize"), [LOG_STEP_DECORATOR]);
}
