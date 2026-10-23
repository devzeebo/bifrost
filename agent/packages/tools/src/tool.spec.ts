import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { defineTool } from "./tool.ts";

const emptyParameters = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
} as const;

describe("defineTool", () => {
  test("returns a tool when the definition is valid", {
    given: {
      a_valid_definition,
    },
    when: {
      defining_the_tool,
    },
    then: {
      the_tool_keeps_its_name,
    },
  });

  test("rejects an empty name", {
    given: {
      a_definition_with_an_empty_name,
    },
    when: {
      defining_the_tool,
    },
    then: {
      expect_error,
    },
  });

  test("rejects an empty description", {
    given: {
      a_definition_with_an_empty_description,
    },
    when: {
      defining_the_tool,
    },
    then: {
      expect_error,
    },
  });

  test("rejects a schema that is not strict", {
    given: {
      a_definition_with_open_properties,
    },
    when: {
      defining_the_tool,
    },
    then: {
      expect_error,
    },
  });
});

type Context = {
  definition: Parameters<typeof defineTool>[0];
  tool: ReturnType<typeof defineTool>;
  errorMessage: string;
};

function a_valid_definition(this: Context) {
  this.definition = {
    name: "echo",
    description: "Echoes text",
    parameters: emptyParameters,
    execute: () => "ok",
  };
}

function a_definition_with_an_empty_name(this: Context) {
  this.definition = {
    name: " ",
    description: "Echoes text",
    parameters: emptyParameters,
    execute: () => "ok",
  };
  this.errorMessage = "Tool name is required";
}

function a_definition_with_an_empty_description(this: Context) {
  this.definition = {
    name: "echo",
    description: "",
    parameters: emptyParameters,
    execute: () => "ok",
  };
  this.errorMessage = "Tool description is required";
}

function a_definition_with_open_properties(this: Context) {
  this.definition = {
    name: "echo",
    description: "Echoes text",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: true,
    },
    execute: () => "ok",
  };
  this.errorMessage = "Tool parameters must be a strict object schema";
}

function defining_the_tool(this: Context) {
  this.tool = defineTool(this.definition);
}

function the_tool_keeps_its_name(this: Context) {
  expect(this.tool.name).toBe("echo");
  expect(this.tool.parameters.additionalProperties).toBe(false);
}

function expect_error(this: Context, error: Error) {
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe(this.errorMessage);
}
