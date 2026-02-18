import { describe, expect } from "vitest";
import test from "vitest-gwt";
import { functionUnderTest } from "./example";

type Context = {
  input: string;
  result: string;
  error: Error | null;
};

describe("functionUnderTest", () => {
  test("returns expected value for valid input", {
    given: {
      some_precondition,
    },
    when: {
      function_is_executed,
    },
    then: {
      expected_result,
    },
  });
});

// IMPORTANT: Use regular function declarations, NOT arrow functions
function some_precondition(this: Context) {
  this.input = "test value";
}

function function_is_executed(this: Context) {
  this.result = functionUnderTest(this.input);
}

function expected_result(this: Context) {
  expect(this.result).toBe("expected value");
}
