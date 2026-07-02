import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { Registry } from "./registry.js";

type Context = {
  registry: Registry<{ name: string; value: number }>;
  duplicateError: Error | null;
  item: { name: string; value: number } | undefined;
};

describe("Registry", () => {
  test("registers and retrieves items by name", {
    given: { empty_registry },
    when: { item_registered },
    then: { item_is_retrieved },
  });

  test("throws when registering a duplicate name", {
    given: { registry_with_item },
    when: { registering_duplicate },
    then: { duplicate_error_thrown },
  });
});

function empty_registry(this: Context) {
  this.registry = new Registry();
}

function registry_with_item(this: Context) {
  this.registry = new Registry();
  this.registry.register("alpha", { name: "alpha", value: 1 });
}

function item_registered(this: Context) {
  this.registry.register("alpha", { name: "alpha", value: 1 });
  this.item = this.registry.get("alpha");
}

function registering_duplicate(this: Context) {
  try {
    this.registry.register("alpha", { name: "alpha", value: 2 });
    this.duplicateError = null;
  } catch (error) {
    this.duplicateError = error as Error;
  }
}

function item_is_retrieved(this: Context) {
  expect(this.item).toEqual({ name: "alpha", value: 1 });
  expect(this.registry.has("alpha")).toBe(true);
}

function duplicate_error_thrown(this: Context) {
  expect(this.duplicateError?.message).toContain("Already registered");
}
