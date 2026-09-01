import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { renderInstructions } from "./render-instructions.js";
import type { Instruction } from "./types.js";

type Context = {
  instructions: Instruction[];
  result: string;
};

describe("renderInstructions", () => {
  test("joins plain string instructions with newlines", {
    given: {
      plain_string_instructions,
    },
    when: {
      instructions_are_rendered,
    },
    then: {
      result_is_joined_strings,
    },
  });

  test("wraps keyed instructions in XML-like tags", {
    given: {
      keyed_instruction,
    },
    when: {
      instructions_are_rendered,
    },
    then: {
      result_is_keyed_block,
    },
  });

  test("renders a mixed list of strings and keyed blocks", {
    given: {
      mixed_instructions,
    },
    when: {
      instructions_are_rendered,
    },
    then: {
      result_matches_expected_prompt,
    },
  });
});

function plain_string_instructions(this: Context) {
  this.instructions = ["first", "second"];
}

function keyed_instruction(this: Context) {
  this.instructions = [{ key: "my-thing", instructions: "custom instructions" }];
}

function mixed_instructions(this: Context) {
  this.instructions = [
    "an instruction",
    { key: "my-thing", instructions: "custom instructions" },
    "more things",
  ];
}

function instructions_are_rendered(this: Context) {
  this.result = renderInstructions(this.instructions);
}

function result_is_joined_strings(this: Context) {
  expect(this.result).toBe("first\nsecond");
}

function result_is_keyed_block(this: Context) {
  expect(this.result).toBe("<my-thing>\ncustom instructions\n</my-thing>");
}

function result_matches_expected_prompt(this: Context) {
  expect(this.result).toBe(
    ["an instruction", "<my-thing>", "custom instructions", "</my-thing>", "more things"].join(
      "\n",
    ),
  );
}
