import { describe, expect, vi, type MockInstance } from "vite-plus/test";
import test, { withAspect } from "vitest-gwt";

import { randomNumber, type RandomNumberArgs } from "./randomNumber.ts";

describe("randomNumber", () => {
  withAspect(
    function (this: Context) {
      this.random = vi.spyOn(Math, "random");
    },
    function (this: Context) {
      this.random.mockRestore();
    },
  );

  test("returns an integer when type is omitted", {
    given: {
      bounds_from_one_to_ten,
      random_returns_one_half,
    },
    when: {
      the_tool_is_executed,
    },
    then: {
      the_result_is_six,
    },
  });

  test("returns a float when type is float", {
    given: {
      bounds_from_zero_to_ten,
      float_type,
      random_returns_one_quarter,
    },
    when: {
      the_tool_is_executed,
    },
    then: {
      the_result_is_two_and_a_half,
    },
  });

  test("rejects a minimum greater than the maximum", {
    given: {
      a_minimum_greater_than_the_maximum,
    },
    when: {
      the_tool_is_executed,
    },
    then: {
      expect_error,
    },
  });
});

type Context = {
  args: RandomNumberArgs;
  result: string;
  random: MockInstance<() => number>;
};

function bounds_from_one_to_ten(this: Context) {
  this.args = { min: 1, max: 10 };
}

function bounds_from_zero_to_ten(this: Context) {
  this.args = { min: 0, max: 10 };
}

function float_type(this: Context) {
  this.args = { ...this.args, type: "float" };
}

function a_minimum_greater_than_the_maximum(this: Context) {
  this.args = { min: 10, max: 1 };
}

function random_returns_one_half(this: Context) {
  this.random.mockReturnValue(0.5);
}

function random_returns_one_quarter(this: Context) {
  this.random.mockReturnValue(0.25);
}

function the_tool_is_executed(this: Context) {
  const result = randomNumber.execute(this.args);
  if (typeof result !== "string") {
    throw new Error("random_number returned a promise");
  }
  this.result = result;
}

function the_result_is_six(this: Context) {
  expect(this.result).toBe("6");
}

function the_result_is_two_and_a_half(this: Context) {
  expect(this.result).toBe("2.5");
}

function expect_error(this: Context, error: Error) {
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe("min must be less than or equal to max");
}
