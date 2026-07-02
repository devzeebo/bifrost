import type { ScriptTaskDefinition } from "@bifrost-ai/interfaces-task";

export class ScriptRegistry {
  private readonly scripts = new Map<string, ScriptTaskDefinition>();

  register(script: ScriptTaskDefinition): void {
    if (this.scripts.has(script.name)) {
      throw new Error(`Script already registered: ${script.name}`);
    }
    this.scripts.set(script.name, script);
  }

  get(name: string): ScriptTaskDefinition | undefined {
    return this.scripts.get(name);
  }

  has(name: string): boolean {
    return this.scripts.has(name);
  }
}
