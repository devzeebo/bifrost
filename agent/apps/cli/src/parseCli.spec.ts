import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { parseCli, type ParsedCli } from "./parseCli.ts";

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

  test("requires --model", {
    given: {
      a_run_command_without_a_model,
    },
    when: {
      the_arguments_are_parsed,
    },
    then: {
      the_error_names_model,
    },
  });
});

type Context = {
  argv: readonly string[];
  parsed: ParsedCli;
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
  this.argv = ["run", "hello", "--model", "m1", "--max-turns", "0"];
}

function a_run_command_without_a_model(this: Context) {
  this.argv = ["run", "hello"];
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

function the_error_names_model(this: Context) {
  expect(this.parsed).toEqual({
    type: "error",
    message: "Missing required argument: --model",
  });
}
