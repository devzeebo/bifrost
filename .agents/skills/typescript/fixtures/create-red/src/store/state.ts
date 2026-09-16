import type { Todo } from "../types.ts";

export type StoreState = {
  todos: Map<string, Todo>;
};

export const createStoreState = (): StoreState => ({
  todos: new Map(),
});
