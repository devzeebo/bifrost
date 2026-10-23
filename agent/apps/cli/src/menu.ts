import { isCancel, select, text } from "@clack/prompts";

import { resolveModel } from "./parseCli.ts";

export type MenuChoice =
  | { readonly type: "quit" }
  | { readonly type: "help" }
  | { readonly type: "run"; readonly prompt: string; readonly model: string };

const ask = async (message: string): Promise<string | undefined> => {
  const value = await text({ message });
  if (isCancel(value) || value.trim() === "") {
    return undefined;
  }
  return value;
};

export const chooseFromMenu = async (env: NodeJS.ProcessEnv): Promise<MenuChoice> => {
  const choice = await select({
    message: "Agent harness",
    options: [
      { value: "run", label: "Run" },
      { value: "help", label: "Help" },
      { value: "quit", label: "Quit" },
    ],
  });

  if (isCancel(choice) || choice === "quit") {
    return { type: "quit" };
  }
  if (choice === "help") {
    return { type: "help" };
  }

  const prompt = await ask("Prompt");
  if (prompt === undefined) {
    return { type: "quit" };
  }

  const fromEnv = resolveModel(undefined, env);
  const model = fromEnv ?? (await ask("Model"));
  if (model === undefined) {
    return { type: "quit" };
  }

  return { type: "run", prompt, model };
};
