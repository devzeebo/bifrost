import type { Todo } from "../types.ts";
import { copyTodo } from "./copy-todo.ts";
import type { StoreState } from "./state.ts";

export const create = (state: StoreState, title: string): Todo => {
  const now = new Date().toISOString();
  const todo: Todo = {
    id: crypto.randomUUID(),
    title,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };

  state.todos.set(todo.id, todo);
  return copyTodo(todo);
};
