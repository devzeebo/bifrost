import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Tool } from "@bifrost-ai/tools";
import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { loadTools } from "./loadTools.ts";

const fixture = (name: string): string =>
  resolve(dirname(fileURLToPath(import.meta.url)), "fixtures", name);

describe("loadTools", () => {
  test("loads a default-exported tool list", {
    given: {
      a_tool_list_module,
    },
    when: {
      the_module_is_loaded,
    },
    then: {
      the_echo_tool_is_loaded,
    },
  });

  test("loads a default-exported tools object", {
    given: {
      a_tool_object_module,
    },
    when: {
      the_module_is_loaded,
    },
    then: {
      the_ping_tool_is_loaded,
    },
  });

  test("rejects a module that does not export tools", {
    given: {
      a_module_that_is_not_tools,
    },
    when: {
      the_module_is_loaded,
    },
    then: {
      expect_error,
    },
  });
});

type Context = {
  paths: readonly string[];
  tools: Tool[];
};

function a_tool_list_module(this: Context) {
  this.paths = [fixture("toolList.ts")];
}

function a_tool_object_module(this: Context) {
  this.paths = [fixture("toolObject.ts")];
}

function a_module_that_is_not_tools(this: Context) {
  this.paths = [fixture("notTools.ts")];
}

async function the_module_is_loaded(this: Context) {
  this.tools = await loadTools(this.paths);
}

function the_echo_tool_is_loaded(this: Context) {
  expect(this.tools.map((tool) => tool.name)).toEqual(["echo"]);
}

function the_ping_tool_is_loaded(this: Context) {
  expect(this.tools.map((tool) => tool.name)).toEqual(["ping"]);
}

function expect_error(this: Context, error: Error) {
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toContain("must default-export Tool[] or { tools: Tool[] }");
}
