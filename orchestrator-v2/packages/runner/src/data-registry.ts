import type { DataRegistry, Registry } from "@bifrost-ai/interfaces-work";

import { Registry as RegistryImpl } from "./registry.js";

type Guards<T extends Record<string, unknown>> = {
  [K in keyof T]: (value: unknown) => value is T[K];
};

export function createDataRegistry(): DataRegistry<Record<string, never>>;
export function createDataRegistry<T extends Record<string, unknown>>(
  guards: Guards<T>,
): DataRegistry<T>;
export function createDataRegistry<T extends Record<string, unknown>>(
  guards: Guards<T> = {} as Guards<T>,
): DataRegistry<T> {
  const registries = new Map<keyof T & string, Registry<unknown>>();

  for (const type of Object.keys(guards) as (keyof T & string)[]) {
    registries.set(type, createGuardedRegistry(guards[type]));
  }

  return {
    get<K extends keyof T & string>(type: K): Registry<T[K]> {
      const registry = registries.get(type);
      if (registry === undefined) {
        throw new Error(`Unknown data type: ${type}`);
      }
      return registry as Registry<T[K]>;
    },
  };
}

function createGuardedRegistry<T>(guard: (value: unknown) => value is T): Registry<T> {
  const items = new RegistryImpl<T>();

  return {
    register(name, item) {
      if (!guard(item)) {
        throw new Error(`Invalid data registration: ${name}`);
      }
      items.register(name, item);
    },
    get(name) {
      return items.get(name);
    },
    has(name) {
      return items.has(name);
    },
  };
}
