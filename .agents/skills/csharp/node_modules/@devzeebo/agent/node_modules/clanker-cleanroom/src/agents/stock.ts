import { BASE_IMAGE } from "./base/constants.js";
import { bindingRegistry } from "./binding-registry.js";

/** Short name of a registered stock agent binding. */
export type StockAgentName = string;

/** Image tags for currently registered stock agents. */
export function stockAgentImages(): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(bindingRegistry).map(([name, binding]) => [name, binding.image]),
  );
}

/** Map a Docker image tag to a registered stock agent name, if any. */
export function stockAgentNameForImage(image: string): StockAgentName | undefined {
  for (const [name, binding] of Object.entries(bindingRegistry)) {
    if (binding.image === image) {
      return name;
    }
  }
  return undefined;
}

export function isStockAgentName(name: string): name is StockAgentName {
  return Object.hasOwn(bindingRegistry, name);
}

export { BASE_IMAGE };
