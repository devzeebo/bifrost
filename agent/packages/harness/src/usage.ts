export type LineUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly cachedTokens?: number;
  readonly cacheWriteTokens?: number;
  readonly reasoningTokens?: number;
  readonly cost?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const details = (
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined => {
  const nested = value[key];
  return isRecord(nested) ? nested : undefined;
};

export const readLineUsage = (value: unknown): LineUsage | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const inputTokens = readNumber(value["input_tokens"]) ?? readNumber(value["prompt_tokens"]);
  const outputTokens = readNumber(value["output_tokens"]) ?? readNumber(value["completion_tokens"]);
  if (inputTokens === undefined || outputTokens === undefined) {
    return undefined;
  }

  const inputDetails =
    details(value, "input_tokens_details") ?? details(value, "prompt_tokens_details");
  const outputDetails = details(value, "output_tokens_details");
  const cachedTokens = readNumber(inputDetails?.["cached_tokens"]);
  const cacheWriteTokens = readNumber(inputDetails?.["cache_write_tokens"]);
  const reasoningTokens = readNumber(outputDetails?.["reasoning_tokens"]);
  const cost = readNumber(value["cost"]);

  return {
    inputTokens,
    outputTokens,
    totalTokens: readNumber(value["total_tokens"]) ?? inputTokens + outputTokens,
    ...(cachedTokens === undefined ? {} : { cachedTokens }),
    ...(cacheWriteTokens === undefined ? {} : { cacheWriteTokens }),
    ...(reasoningTokens === undefined ? {} : { reasoningTokens }),
    ...(cost === undefined ? {} : { cost }),
  };
};
