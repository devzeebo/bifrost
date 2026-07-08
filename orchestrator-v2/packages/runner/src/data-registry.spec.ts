import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { createDataRegistry } from "./data-registry.js";

type MockEngine = {
  execute: () => Promise<unknown>;
};

type Context = {
  data: ReturnType<typeof createDataRegistry<{ engine: MockEngine }>>;
  engine: MockEngine;
  error: Error | null;
};

const engineGuards = {
  engine: (value: unknown): value is MockEngine =>
    typeof value === "object" && value !== null && "execute" in value,
};

describe("createDataRegistry", () => {
  test("returns typed sub-registries", {
    given: { data_registry_created },
    when: { valid_engine_registered },
    then: { engine_is_retrieved },
  });

  test("rejects invalid registrations", {
    given: { data_registry_created },
    when: { registering_invalid_engine },
    then: { registration_error },
  });
});

function data_registry_created(this: Context) {
  this.data = createDataRegistry(engineGuards);
  this.engine = { execute: async () => ({ success: true }) };
  this.error = null;
}

function valid_engine_registered(this: Context) {
  this.data.get("engine").register("test", this.engine);
}

function engine_is_retrieved(this: Context) {
  expect(this.data.get("engine").get("test")).toBe(this.engine);
}

function registering_invalid_engine(this: Context) {
  try {
    this.data.get("engine").register("bad", { not: "an engine" } as unknown as MockEngine);
  } catch (error) {
    this.error = error as Error;
  }
}

function registration_error(this: Context) {
  expect(this.error?.message).toContain("Invalid data registration");
}
