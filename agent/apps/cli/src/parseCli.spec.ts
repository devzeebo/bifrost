import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { parseCli, resolveModel, type ParsedCli } from "./parseCli.ts";

describe("parseCli", () => {
  test("reads run flags", {
    given: {
      a_run_command_with_flags,
    },
    when: {
      the_arguments_are_parsed,
    },
    then: {
      the_run_options_match,
    },
  });

  test("asks for a menu when no command is given", {
    given: {
      no_arguments,
    },
    when: {
      the_arguments_are_parsed,
    },
    then: {
      the_command_is_a_menu,
    },
  });

  test("shows help for the run command", {
    given: {
      a_run_help_command,
    },
    when: {
      the_arguments_are_parsed,
    },
    then: {
      the_command_is_run_help,
    },
  });

  test("rejects an unknown command", {
    given: {
      an_unknown_command,
    },
    when: {
      the_arguments_are_parsed,
    },
    then: {
      the_command_is_an_error,
    },
  });

  test("rejects a max-turns value that is not a positive integer", {
    given: {
      a_run_command_with_a_bad_turn_limit,
    },
    when: {
      the_arguments_are_parsed,
    },
    then: {
      the_command_is_an_error,
    },
  });
});

describe("resolveModel", () => {
  test("uses the flag before the environment", {
    given: {
      a_model_flag_and_environment,
    },
    when: {
      the_model_is_resolved,
    },
    then: {
      the_flag_wins,
    },
  });

  test("requires a model when neither source is set", {
    given: {
      no_model,
    },
    when: {
      the_model_is_resolved,
    },
    then: {
      the_model_is_missing,
    },
  });
});

type Context = {
  argv: readonly string[];
  parsed: ParsedCli;
  flag: string | undefined;
  env: NodeJS.ProcessEnv;
  model: string | undefined;
};

function a_run_command_with_flags(this: Context) {
  this.argv = [
    "run",
    "hello",
    "--model",
    "m1",
    "--instructions",
    "Be brief",
    "--tools",
    "a.ts",
    "--tools",
    "b.ts",
    "--max-turns",
    "3",
    "--session",
    "session.json",
    "--verbose",
  ];
}

function no_arguments(this: Context) {
  this.argv = [];
}

function a_run_help_command(this: Context) {
  this.argv = ["run", "--help"];
}

function an_unknown_command(this: Context) {
  this.argv = ["nope"];
}

function a_run_command_with_a_bad_turn_limit(this: Context) {
  this.argv = ["run", "hello", "--max-turns", "0"];
}

function the_arguments_are_parsed(this: Context) {
  this.parsed = parseCli(this.argv);
}

function the_run_options_match(this: Context) {
  expect(this.parsed).toEqual({
    type: "run",
    options: {
      prompt: "hello",
      model: "m1",
      instructions: "Be brief",
      toolPaths: ["a.ts", "b.ts"],
      maxTurns: 3,
      sessionPath: "session.json",
      verbose: true,
    },
  });
}

function the_command_is_a_menu(this: Context) {
  expect(this.parsed).toEqual({ type: "menu" });
}

function the_command_is_run_help(this: Context) {
  expect(this.parsed).toEqual({ type: "help", subject: "run" });
}

function the_command_is_an_error(this: Context) {
  expect(this.parsed.type).toBe("error");
}

function a_model_flag_and_environment(this: Context) {
  this.flag = "from-flag";
  this.env = { AGENT_MODEL: "from-env" };
}

function no_model(this: Context) {
  this.flag = undefined;
  this.env = {};
}

function the_model_is_resolved(this: Context) {
  this.model = resolveModel(this.flag, this.env);
}

function the_flag_wins(this: Context) {
  expect(this.model).toBe("from-flag");
}

function the_model_is_missing(this: Context) {
  expect(this.model).toBeUndefined();
}
