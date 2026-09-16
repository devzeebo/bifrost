import type { AgentBinding } from "./types.js";

/** Registered stock bindings keyed by short name (e.g. `"cursor"`). */
export const bindingRegistry: Record<string, AgentBinding> = {};

/** Register a stock agent binding for name and image-tag lookup. */
export function registerBinding(name: string, binding: AgentBinding): void {
  bindingRegistry[name] = binding;
}

/** Remove a previously registered binding. */
export function unregisterBinding(name: string): void {
  delete bindingRegistry[name];
}

/** Clear all registered bindings (tests). */
export function resetBindings(): void {
  for (const key of Object.keys(bindingRegistry)) {
    delete bindingRegistry[key];
  }
}

export function resolveBinding(name: string): AgentBinding {
  const binding = bindingRegistry[name];
  if (binding === undefined) {
    throw new Error(
      `No binding registered for "${name}". Import \`@clanker-cleanroom/${name}/register\` ` +
        `(or call registerBinding) before constructing Agent("${name}").`,
    );
  }
  return binding;
}
