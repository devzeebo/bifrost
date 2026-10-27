import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Engine } from "@bifrost-ai/engines";
import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { loadEngines } from "./loadEngines.ts";

const fixture = (name: string): string =>
  resolve(dirname(fileURLToPath(import.meta.url)), "fixtures", name);

describe("loadEngines", () => {
  test("loads a default-exported engine", {
    given: {
      an_engine_module,
    },
    when: {
      the_module_is_loaded,
    },
    then: {
      the_affinity_engine_is_loaded,
    },
  });

  test("loads a default-exported engine list", {
    given: {
      an_engine_list_module,
    },
    when: {
      the_module_is_loaded,
    },
    then: {
      both_engines_are_loaded,
    },
  });

  test("loads a default-exported engines object", {
    given: {
      an_engine_object_module,
    },
    when: {
      the_module_is_loaded,
    },
    then: {
      the_local_engine_is_loaded,
    },
  });

  test("rejects a module that does not export an engine", {
    given: {
      a_module_that_is_not_an_engine,
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
  engines: Engine[];
};

function an_engine_module(this: Context) {
  this.paths = [fixture("engine.ts")];
}

function an_engine_list_module(this: Context) {
  this.paths = [fixture("engineList.ts")];
}

function an_engine_object_module(this: Context) {
  this.paths = [fixture("engineObject.ts")];
}

function a_module_that_is_not_an_engine(this: Context) {
  this.paths = [fixture("notEngine.ts")];
}

async function the_module_is_loaded(this: Context) {
  this.engines = await loadEngines(this.paths);
}

function the_affinity_engine_is_loaded(this: Context) {
  expect(this.engines.map((engine) => engine.name)).toEqual(["affinity"]);
}

function both_engines_are_loaded(this: Context) {
  expect(this.engines.map((engine) => engine.name)).toEqual(["first", "second"]);
}

function the_local_engine_is_loaded(this: Context) {
  expect(this.engines.map((engine) => engine.name)).toEqual(["local"]);
}

function expect_error(this: Context, error: Error) {
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toContain(
    "must default-export an Engine, Engine[], or { engines: Engine[] }",
  );
}
