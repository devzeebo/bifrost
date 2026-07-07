import { Runner } from "@bifrost-ai/runner";
import "@bifrost-ai/agent-3-task/augment";
import "@bifrost-ai/agent-4-workflow/augment";
import { doSomething } from "./doSomething";

const runner = new Runner();

runner.registerEngine(new CursorEngine());
runner.registerTaskAgent("HelloWorld", createTaskAgent("./hello-world.md"));
runner.registerScriptAgent("doSomething", doSomething);

runner.registerWorkflowAgent(createWorkflow("trial").step("HelloWorld").step("doSomething"));

await runner.run();
