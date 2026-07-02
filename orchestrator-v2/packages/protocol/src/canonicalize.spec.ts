import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { canonicalize } from "./canonicalize.js";

type Context = {
  first: string;
  second: string;
};

describe("canonicalize", () => {
  test("produces identical output for permuted object keys", {
    given: {
      objects_with_permuted_keys,
    },
    when: {
      canonicalizing_both,
    },
    then: {
      outputs_are_identical,
    },
  });
});

function objects_with_permuted_keys(this: Context) {
  this.first = canonicalize({ a: 1, b: { z: 3, y: 2 } });
  this.second = canonicalize({ b: { y: 2, z: 3 }, a: 1 });
}

function canonicalizing_both(this: Context) {
  // values already stored in given
}

function outputs_are_identical(this: Context) {
  expect(this.first).toBe(this.second);
  expect(this.first).toBe('{"a":1,"b":{"y":2,"z":3}}');
}
