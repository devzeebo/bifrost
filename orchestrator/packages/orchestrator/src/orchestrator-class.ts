import type { TaskSource } from "@bifrost-ai/task-source";
import type { Engine } from "@bifrost-ai/engine";
import type { AgentDefinition } from "./core/types";
import { orchestrate } from "./core/orchestrator";
import createDebug from "debug";

const debug = createDebug("bifrost");

export type AgentClass = new () => AgentDefinition;

export type OrchestratorOptions = {
  taskSource: new () => TaskSource;
  engine: new () => Engine;
};

export class Orchestrator {
  private taskSource: TaskSource;
  private engine: Engine;
  private readonly agents: Map<string, AgentDefinition>;

  public constructor(options: OrchestratorOptions) {
    const TaskSourceCtor = options.taskSource;
    const EngineCtor = options.engine;
    this.taskSource = new TaskSourceCtor();
    this.engine = new EngineCtor();
    this.agents = new Map<string, AgentDefinition>();

    debug("Configuration:");
    debug("  TaskSource: %s", TaskSourceCtor.name);
    debug("  Engine: %s", EngineCtor.name);
  }

  public registerAgent(agent: AgentDefinition): void {
    this.agents.set(agent.name, agent);
    debug("Registered agent: %s", agent.name);
  }

  public async run(): Promise<void> {
    debug("Starting with %d agents: %s", this.agents.size, [...this.agents.keys()].join(", "));
    for await (const task of this.taskSource.watchTasks()) {
      const agent = this.agents.get(task.agentId);
      if (agent) {
        try {
          const result = await orchestrate({
            task,
            agent,
            taskSource: this.taskSource,
            engine: this.engine,
            projectDir: process.cwd(),
          });

          debug("Task %s %s", task.id, result.outcome);
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
