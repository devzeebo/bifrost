import { defineTool } from "@bifrost-ai/tools";

type NumberKind = "integer" | "float";

export type RandomNumberArgs = {
  readonly min: number;
  readonly max: number;
  readonly type?: NumberKind;
};

const readNumber = (value: unknown, name: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
  return value;
};

const readKind = (value: unknown): NumberKind => {
  if (value === undefined || value === "integer") {
    return "integer";
  }
  if (value === "float") {
    return "float";
  }
  throw new Error("type must be integer or float");
};

const randomInteger = (min: number, max: number): number => {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  if (low > high) {
    throw new Error("No integer exists between min and max");
  }
  const span = high - low + 1;
  return Math.floor(Math.random() * span) + low;
};

const randomFloat = (min: number, max: number): number => Math.random() * (max - min) + min;

const randomNumberValue = (args: RandomNumberArgs): string => {
  const min = readNumber(args.min, "min");
  const max = readNumber(args.max, "max");
  if (min > max) {
    throw new Error("min must be less than or equal to max");
  }

  const kind = readKind(args.type);
  const value = kind === "integer" ? randomInteger(min, max) : randomFloat(min, max);
  return String(value);
};

export const randomNumber = defineTool({
  name: "random_number",
  description: "Returns a random number between min and max",
  parameters: {
    type: "object",
    properties: {
      min: { type: "number", description: "Lower bound" },
      max: { type: "number", description: "Upper bound" },
      type: {
        type: "string",
        description: "'integer' or 'float'. Defaults to integer",
      },
    },
    required: ["min", "max"],
    additionalProperties: false,
  },
  execute: randomNumberValue,
});
