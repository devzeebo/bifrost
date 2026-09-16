import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { create, createStoreState, type StoreState } from "./index.ts";
import type { Todo } from "../types.ts";

type Context = {
  store: StoreState;
  createdTodo: Todo;
};

describe("create", () => {
  test("creates a todo with default fields", {
    given: {
      empty_store,
    },
    when: {
      todo_is_created,
    },
    then: {
      todo_has_expected_defaults,
    },
  });
});

function empty_store(this: Context) {
  this.store = createStoreState();
}

function todo_is_created(this: Context) {
  this.createdTodo = create(this.store, "Buy groceries");
}

function todo_has_expected_defaults(this: Context) {
  expect(this.createdTodo.title).toBe("Buy groceries");
  expect(this.createdTodo.completed).toBe(false);
  expect(this.createdTodo.id.length).toBeGreaterThan(0);
  expect(this.createdTodo.createdAt).toBe(this.createdTodo.updatedAt);
  expect(() => new Date(this.createdTodo.createdAt)).not.toThrow();
}
