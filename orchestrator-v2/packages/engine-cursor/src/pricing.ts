import modelPricing from "./model-pricing.json" with { type: "json" };

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type ModelRates = {
  input: number;
  cacheWrite?: number;
  cacheRead?: number;
  output: number;
};

type PricingCatalog = {
  unit: string;
  auto: {
    inputAndCacheWrite: number;
    output: number;
    cacheRead: number;
  };
  models: Array<{
    name: string;
    ids: string[];
    input: number;
    cacheWrite?: number;
    cacheRead?: number;
    output: number;
  }>;
};

const catalog = modelPricing as PricingCatalog;

const TOKENS_PER_MILLION = 1_000_000;

const normalizeModelId = (modelId: string): string =>
  modelId.trim().toLowerCase().replaceAll("_", "-");

const ratesById = new Map<string, ModelRates>(
  catalog.models.flatMap((model) =>
    model.ids.map((id) => [
      normalizeModelId(id),
      {
        input: model.input,
        cacheWrite: model.cacheWrite,
        cacheRead: model.cacheRead,
        output: model.output,
      },
    ]),
  ),
);

export const resolveModelRates = (modelId: string | undefined): ModelRates | undefined => {
  if (!modelId) {
    return undefined;
  }

  const normalized = normalizeModelId(modelId);

  if (normalized === "auto") {
    return {
      input: catalog.auto.inputAndCacheWrite,
      cacheWrite: catalog.auto.inputAndCacheWrite,
      cacheRead: catalog.auto.cacheRead,
      output: catalog.auto.output,
    };
  }

  const exact = ratesById.get(normalized);
  if (exact) {
    return exact;
  }

  for (const [id, rates] of ratesById) {
    if (normalized.startsWith(id) || id.startsWith(normalized)) {
      return rates;
    }
  }

  return undefined;
};

export const calculateUsageCostUsd = (modelId: string | undefined, usage: TokenUsage): number => {
  const rates = resolveModelRates(modelId);
  if (!rates) {
    return 0;
  }

  const cacheWriteRate = rates.cacheWrite ?? rates.input;
  const cacheReadRate = rates.cacheRead ?? 0;

  const cost =
    (usage.inputTokens * rates.input +
      usage.cacheWriteTokens * cacheWriteRate +
      usage.cacheReadTokens * cacheReadRate +
      usage.outputTokens * rates.output) /
    TOKENS_PER_MILLION;

  return cost;
};
