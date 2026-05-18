import type { TaskSource } from "@bifrost-ai/task-source";
import type { Engine } from "@bifrost-ai/engine";
import type { AgentDefinition } from "./core/types";
import { orchestrate } from "./core/orchestrator";

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

    console.log("[orchestrator] Configuration:");
    console.log(`  TaskSource: ${TaskSourceCtor.name}`);
    console.log(`  Engine: ${EngineCtor.name}`);
  }

  public registerAgent(agent: AgentDefinition): void {
    this.agents.set(agent.name, agent);
    console.log(`[orchestrator] Registered agent: ${agent.name}`);
  }

  public async run(): Promise<void> {
    console.log(
      `[orchestrator] Starting with ${this.agents.size} agents: ${[...this.agents.keys()].join(", ")}`,
    );
    for await (const task of this.taskSource.watchTasks()) {
      const agent = this.agents.get(task.agentId);
      if (agent) {
        const result = await orchestrate({
          task,
          agent,
          taskSource: this.taskSource,
          engine: this.engine,
          projectDir: process.cwd(),
        });

        console.log(`Task ${task.id} ${result.outcome}`);
      } else {
        await this.taskSource.failTask(task.id, `Unknown agent: ${task.agentId}`);
      }
    }
  }
}
