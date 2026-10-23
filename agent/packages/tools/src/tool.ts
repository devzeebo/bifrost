export type JsonSchema =
  | {
      readonly type: "string" | "number" | "boolean" | "integer";
      readonly description?: string;
    }
  | JsonObjectSchema
  | {
      readonly type: "array";
      readonly items: JsonSchema;
      readonly description?: string;
    };

export type JsonObjectSchema = {
  readonly type: "object";
  readonly properties: Readonly<Record<string, JsonSchema>>;
  readonly required: readonly string[];
  readonly additionalProperties: false;
  readonly description?: string;
};

export type Tool<TArgs = unknown> = {
  readonly name: string;
  readonly description: string;
  readonly parameters: JsonObjectSchema;
  readonly execute: (args: TArgs) => Promise<string> | string;
};

type ToolDefinition<TArgs> = {
  readonly name: string;
  readonly description: string;
  readonly parameters: {
    readonly type?: unknown;
    readonly properties?: Readonly<Record<string, JsonSchema>>;
    readonly required?: readonly string[];
    readonly additionalProperties?: unknown;
    readonly description?: string;
  };
  readonly execute: (args: TArgs) => Promise<string> | string;
};

const strictSchemaMessage = "Tool parameters must be a strict object schema";

export const defineTool = <TArgs>(definition: ToolDefinition<TArgs>): Tool<TArgs> => {
  if (definition.name.trim() === "") {
    throw new Error("Tool name is required");
  }
  if (definition.description.trim() === "") {
    throw new Error("Tool description is required");
  }

  const parameters = definition.parameters;
  if (
    parameters.type !== "object" ||
    parameters.additionalProperties !== false ||
    parameters.properties === undefined ||
    parameters.required === undefined ||
    !parameters.required.every((name) => typeof name === "string")
  ) {
    throw new Error(strictSchemaMessage);
  }

  const schema: JsonObjectSchema = {
    type: "object",
    properties: parameters.properties,
    required: parameters.required,
    additionalProperties: false,
    ...(parameters.description === undefined ? {} : { description: parameters.description }),
  };

  return {
    name: definition.name,
    description: definition.description,
    parameters: schema,
    execute: definition.execute,
  };
};
