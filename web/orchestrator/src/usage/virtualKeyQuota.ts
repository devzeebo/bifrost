export type ModelUsage = {
  readonly model: string
  readonly provider: string | null
  readonly totalRequests: number
  readonly totalTokens: number
  readonly totalCost: number
}

export type Budget = {
  readonly id: string
  readonly maxLimit: number
  readonly resetDuration: string
  readonly lastReset: string
  readonly currentUsage: number
  readonly perModelUsage: readonly ModelUsage[]
  readonly sourceType: string | null
  readonly sourceId: string | null
  readonly sourceName: string | null
}

export type RateLimit = {
  readonly id: string
  readonly tokenMaxLimit: number | null
  readonly tokenResetDuration: string | null
  readonly tokenCurrentUsage: number
  readonly tokenLastReset: string
  readonly requestMaxLimit: number | null
  readonly requestResetDuration: string | null
  readonly requestCurrentUsage: number
  readonly requestLastReset: string
  readonly sourceType: string | null
  readonly sourceId: string | null
  readonly sourceName: string | null
}

export type ProviderConfig = {
  readonly id: number
  readonly provider: string
  readonly budgets: readonly Budget[]
  readonly rateLimit: RateLimit | null
}

export type ModelConfig = {
  readonly modelName: string
  readonly provider: string | null
  readonly budgets: readonly Budget[]
  readonly rateLimit: RateLimit | null
}

export type VirtualKeyQuota = {
  readonly virtualKeyName: string
  readonly isActive: boolean
  readonly budgets: readonly Budget[]
  readonly rateLimit: RateLimit | null
  readonly rateLimits: readonly RateLimit[]
  readonly providerConfigs: readonly ProviderConfig[]
  readonly modelConfigs: readonly ModelConfig[]
}

export class VirtualKeyQuotaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VirtualKeyQuotaError'
  }
}

export const fetchVirtualKeyQuota = async (): Promise<VirtualKeyQuota> => {
  const response = await fetch('/get-virtual-key-quota', {
    method: 'QUERY',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: '{}',
  })
  if (!response.ok) {
    throw new VirtualKeyQuotaError(`Orchestrator returned ${response.status}`)
  }
  return parseVirtualKeyQuota(await response.json())
}

export const parseVirtualKeyQuota = (value: unknown): VirtualKeyQuota => {
  if (!isRecord(value)) {
    throw new VirtualKeyQuotaError('Quota response was not an object')
  }

  const virtualKeyName = value['virtualKeyName']
  const isActive = value['isActive']
  if (typeof virtualKeyName !== 'string' || typeof isActive !== 'boolean') {
    throw new VirtualKeyQuotaError('Quota response was missing key identity')
  }

  return {
    virtualKeyName,
    isActive,
    budgets: parseBudgets(value['budgets']),
    rateLimit: parseOptionalRateLimit(value['rateLimit']),
    rateLimits: parseRateLimits(value['rateLimits']),
    providerConfigs: parseProviderConfigs(value['providerConfigs']),
    modelConfigs: parseModelConfigs(value['modelConfigs']),
  }
}

const parseBudgets = (value: unknown): readonly Budget[] => {
  if (value == null) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new VirtualKeyQuotaError('Quota budgets were not a list')
  }
  return value.map(parseBudget)
}

const parseBudget = (value: unknown): Budget => {
  if (!isRecord(value)) {
    throw new VirtualKeyQuotaError('Quota budget was not an object')
  }
  const id = value['id']
  const maxLimit = value['maxLimit']
  const resetDuration = value['resetDuration']
  const lastReset = value['lastReset']
  const currentUsage = value['currentUsage']
  if (
    typeof id !== 'string' ||
    typeof maxLimit !== 'number' ||
    typeof resetDuration !== 'string' ||
    typeof lastReset !== 'string' ||
    typeof currentUsage !== 'number'
  ) {
    throw new VirtualKeyQuotaError('Quota budget was incomplete')
  }
  return {
    id,
    maxLimit,
    resetDuration,
    lastReset,
    currentUsage,
    perModelUsage: parseModelUsages(value['perModelUsage']),
    sourceType: optionalString(value['sourceType']),
    sourceId: optionalString(value['sourceId']),
    sourceName: optionalString(value['sourceName']),
  }
}

const parseModelUsages = (value: unknown): readonly ModelUsage[] => {
  if (value == null) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new VirtualKeyQuotaError('Per-model usage was not a list')
  }
  return value.map(parseModelUsage)
}

const parseModelUsage = (value: unknown): ModelUsage => {
  if (!isRecord(value)) {
    throw new VirtualKeyQuotaError('Per-model usage was not an object')
  }
  const model = value['model']
  const totalRequests = value['totalRequests']
  const totalTokens = value['totalTokens']
  const totalCost = value['totalCost']
  if (
    typeof model !== 'string' ||
    typeof totalRequests !== 'number' ||
    typeof totalTokens !== 'number' ||
    typeof totalCost !== 'number'
  ) {
    throw new VirtualKeyQuotaError('Per-model usage was incomplete')
  }
  return {
    model,
    provider: optionalString(value['provider']),
    totalRequests,
    totalTokens,
    totalCost,
  }
}

const parseRateLimits = (value: unknown): readonly RateLimit[] => {
  if (value == null) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new VirtualKeyQuotaError('Rate limits were not a list')
  }
  return value.map(parseRateLimit)
}

const parseOptionalRateLimit = (value: unknown): RateLimit | null => {
  if (value == null) {
    return null
  }
  return parseRateLimit(value)
}

const parseRateLimit = (value: unknown): RateLimit => {
  if (!isRecord(value)) {
    throw new VirtualKeyQuotaError('Rate limit was not an object')
  }
  const id = value['id']
  const tokenCurrentUsage = value['tokenCurrentUsage']
  const tokenLastReset = value['tokenLastReset']
  const requestCurrentUsage = value['requestCurrentUsage']
  const requestLastReset = value['requestLastReset']
  if (
    typeof id !== 'string' ||
    typeof tokenCurrentUsage !== 'number' ||
    typeof tokenLastReset !== 'string' ||
    typeof requestCurrentUsage !== 'number' ||
    typeof requestLastReset !== 'string'
  ) {
    throw new VirtualKeyQuotaError('Rate limit was incomplete')
  }
  return {
    id,
    tokenMaxLimit: optionalNumber(value['tokenMaxLimit']),
    tokenResetDuration: optionalString(value['tokenResetDuration']),
    tokenCurrentUsage,
    tokenLastReset,
    requestMaxLimit: optionalNumber(value['requestMaxLimit']),
    requestResetDuration: optionalString(value['requestResetDuration']),
    requestCurrentUsage,
    requestLastReset,
    sourceType: optionalString(value['sourceType']),
    sourceId: optionalString(value['sourceId']),
    sourceName: optionalString(value['sourceName']),
  }
}

const parseProviderConfigs = (value: unknown): readonly ProviderConfig[] => {
  if (value == null) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new VirtualKeyQuotaError('Provider configs were not a list')
  }
  return value.map((entry) => {
    if (!isRecord(entry)) {
      throw new VirtualKeyQuotaError('Provider config was not an object')
    }
    const id = entry['id']
    const provider = entry['provider']
    if (typeof id !== 'number' || typeof provider !== 'string') {
      throw new VirtualKeyQuotaError('Provider config was incomplete')
    }
    return {
      id,
      provider,
      budgets: parseBudgets(entry['budgets']),
      rateLimit: parseOptionalRateLimit(entry['rateLimit']),
    }
  })
}

const parseModelConfigs = (value: unknown): readonly ModelConfig[] => {
  if (value == null) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new VirtualKeyQuotaError('Model configs were not a list')
  }
  return value.map((entry) => {
    if (!isRecord(entry)) {
      throw new VirtualKeyQuotaError('Model config was not an object')
    }
    const modelName = entry['modelName']
    if (typeof modelName !== 'string') {
      throw new VirtualKeyQuotaError('Model config was incomplete')
    }
    return {
      modelName,
      provider: optionalString(entry['provider']),
      budgets: parseBudgets(entry['budgets']),
      rateLimit: parseOptionalRateLimit(entry['rateLimit']),
    }
  })
}

const optionalString = (value: unknown): string | null => {
  if (value == null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new VirtualKeyQuotaError('Expected a string or null')
  }
  return value
}

const optionalNumber = (value: unknown): number | null => {
  if (value == null) {
    return null
  }
  if (typeof value !== 'number') {
    throw new VirtualKeyQuotaError('Expected a number or null')
  }
  return value
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
