import type { Todo } from "../types.ts";

export const copyTodo = (todo: Todo): Todo => ({ ...todo });
