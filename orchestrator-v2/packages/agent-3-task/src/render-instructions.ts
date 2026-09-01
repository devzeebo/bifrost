import type { Instruction } from "./types.js";

export const renderInstructions = (instructions: Instruction[]): string =>
  instructions.map(renderInstruction).join("\n\n");

const renderInstruction = (instruction: Instruction): string => {
  if (typeof instruction === "string") {
    return instruction;
  }

  return `<${instruction.key}>\n${instruction.instructions}\n</${instruction.key}>`;
};
