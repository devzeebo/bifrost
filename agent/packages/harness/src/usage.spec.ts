import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { readLineUsage, type LineUsage } from "./usage.ts";

describe("readLineUsage", () => {
  test("reads token counts, cache details, and cost", {
    given: {
      a_response_usage_with_cache_and_cost,
    },
    when: {
      the_usage_is_read,
    },
    then: {
      the_line_usage_keeps_every_reported_figure,
    },
  });

  test("reads chat-completions token names", {
    given: {
      a_prompt_and_completion_usage,
    },
    when: {
      the_usage_is_read,
    },
    then: {
      the_line_usage_uses_those_token_counts,
    },
  });

  test("leaves out figures the provider did not report", {
    given: {
      input_and_output_tokens_only,
    },
    when: {
      the_usage_is_read,
    },
    then: {
      the_line_usage_has_token_totals_only,
    },
  });

  test("returns nothing when the token counts are missing", {
    given: {
      a_usage_object_without_token_counts,
    },
    when: {
      the_usage_is_read,
    },
    then: {
      no_line_usage_is_returned,
    },
  });
});

type Context = {
  raw: unknown;
  usage: LineUsage | undefined;
};

function a_response_usage_with_cache_and_cost(this: Context) {
  this.raw = {
    input_tokens: 11,
    output_tokens: 4,
    total_tokens: 15,
    input_tokens_details: {
      cached_tokens: 7,
      cache_write_tokens: 2,
    },
    output_tokens_details: {
      reasoning_tokens: 1,
    },
    cost: 0.02,
  };
}

function a_prompt_and_completion_usage(this: Context) {
  this.raw = {
    prompt_tokens: 8,
    completion_tokens: 3,
    prompt_tokens_details: {
      cached_tokens: 5,
    },
  };
}

function input_and_output_tokens_only(this: Context) {
  this.raw = {
    input_tokens: 2,
    output_tokens: 1,
  };
}

function a_usage_object_without_token_counts(this: Context) {
  this.raw = { cost: 0.01 };
}

function the_usage_is_read(this: Context) {
  this.usage = readLineUsage(this.raw);
}

function the_line_usage_keeps_every_reported_figure(this: Context) {
  expect(this.usage).toEqual({
    inputTokens: 11,
    outputTokens: 4,
    totalTokens: 15,
    cachedTokens: 7,
    cacheWriteTokens: 2,
    reasoningTokens: 1,
    cost: 0.02,
  });
}

function the_line_usage_uses_those_token_counts(this: Context) {
  expect(this.usage).toEqual({
    inputTokens: 8,
    outputTokens: 3,
    totalTokens: 11,
    cachedTokens: 5,
  });
}

function the_line_usage_has_token_totals_only(this: Context) {
  expect(this.usage).toEqual({
    inputTokens: 2,
    outputTokens: 1,
    totalTokens: 3,
  });
}

function no_line_usage_is_returned(this: Context) {
  expect(this.usage).toBeUndefined();
}
