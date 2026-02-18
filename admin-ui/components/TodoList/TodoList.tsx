import { Button } from "@base-ui/react/button";
import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import { useCallback, useState } from "react";
import { useData } from "vike-react/useData";

import type { Data } from "@/pages/todo/+data";

type TodoItem = {
  text: string;
};

export const TodoList = () => {
  const { todoItemsInitial } = useData<Data>();
  const [todoItems, setTodoItems] = useState<TodoItem[]>(todoItemsInitial);

  const handleSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const text = formData.get("newTodo") as string;
    if (text.trim()) {
      setTodoItems(prev => [...prev, { text: text.trim() }]);
      (event.target as HTMLFormElement).reset();
    }
  }, []);

  return (
    <>
      <ul>
        {todoItems.map(todoItem => (
          <li key={todoItem.text}>{todoItem.text}</li>
        ))}
      </ul>
      <Form onSubmit={handleSubmit}>
        <Field.Root name="newTodo" className="flex gap-2">
          <Field.Control
            placeholder="Add a new to-do"
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 w-full sm:w-auto p-2"
          />
          <Button
            type="submit"
            className="text-white bg-blue-700 hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800 font-medium rounded-lg text-sm px-4 py-2"
          >
            Add to-do
          </Button>
        </Field.Root>
      </Form>
    </>
  );
};
