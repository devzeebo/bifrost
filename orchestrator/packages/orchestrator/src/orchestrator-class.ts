import type { TaskSource } from "@bifrost-ai/task-source";
import type { Engine } from "@bifrost-ai/engine";
import type { AgentDefinition, BeforeDispatchHookSpec, OrchestrationContext } from "./core/types";
import { orchestrate } from "./core/orchestrator";
import { executeBeforeDispatchHooks } from "./core/hook-executor";
import createDebug from "debug";

const debug = createDebug("bifrost");

export type AgentClass = new () => AgentDefinition;

export type OrchestratorOptions = {
  taskSource: TaskSource;
  engine: Engine;
  projectDir?: string;
};

export class Orchestrator {
  private taskSource: TaskSource;
  private engine: Engine;
  private readonly projectDir: string;
  private readonly agents: Map<string, AgentDefinition>;
  private readonly beforeDispatchHooks: BeforeDispatchHookSpec[];

  public constructor(options: OrchestratorOptions) {
    this.taskSource = options.taskSource;
    this.engine = options.engine;
    this.projectDir = options.projectDir ?? process.cwd();
    this.agents = new Map<string, AgentDefinition>();
    this.beforeDispatchHooks = [];
  }

  public registerAgent(agent: AgentDefinition): void {
    this.agents.set(agent.name, agent);
    debug("Registered agent: %s", agent.name);
  }

  public addBeforeDispatch(hook: BeforeDispatchHookSpec): void {
    this.beforeDispatchHooks.push(hook);
    debug("Registered BeforeDispatch hook: %s", hook.name);
  }

  public async run(): Promise<void> {
    debug("Starting with %d agents: %s", this.agents.size, [...this.agents.keys()].join(", "));
    for await (const task of this.taskSource.watchTasks()) {
      const agent = this.agents.get(task.agentId);
      if (agent) {
        try {
          const context: OrchestrationContext = {
            projectDir: this.projectDir,
            instructions: task.instructions,
          };

          const beforeDispatchResults = await executeBeforeDispatchHooks({
            hooks: this.beforeDispatchHooks,
            context: {
              taskId: task.id,
              agentId: task.agentId,
              context,
              taskState: task.taskState,
              metadata: task.metadata,
            },
          });

          const fatalResult = beforeDispatchResults.find((hook) => hook.outcome === "fatal");
          const skipResult = beforeDispatchResults.find((hook) => hook.outcome === "skip");

          if (fatalResult) {
            debug("BeforeDispatch hook fatal for task %s: %s", task.id, fatalResult.message);
            await this.taskSource.failTask(
              task.id,
              `BeforeDispatch hook failed: ${fatalResult.message ?? "unknown error"}`,
            );
          } else if (skipResult) {
            debug("BeforeDispatch hook skip for task %s: %s", task.id, skipResult.message);
            await this.taskSource.completeTask(task.id);
          } else {
            const result = await orchestrate({
              task,
              agent,
              taskSource: this.taskSource,
              engine: this.engine,
              context,
            });

            debug("Task %s %s", task.id, result.outcome);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await this.taskSource.failTask(task.id, message);
        }
      } else {
        await this.taskSource.failTask(task.id, `Unknown agent: ${task.agentId}`);
      }
    }
  }
}
