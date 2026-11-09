import { describe, expect } from 'vitest'
import test from 'vitest-gwt'
import { parseVirtualKeyQuota, VirtualKeyQuotaError } from './virtualKeyQuota'

describe('parseVirtualKeyQuota', () => {
  test('maps a current-cycle quota payload', {
    given: {
      a_quota_payload,
    },
    when: {
      the_payload_is_parsed,
    },
    then: {
      the_key_identity_is_present,
      the_budget_and_model_usage_are_present,
    },
  })

  test('rejects a non-object payload', {
    given: {
      a_non_object_payload,
    },
    when: {
      parsing_is_attempted,
    },
    then: {
      a_quota_error_is_thrown,
    },
  })
})

type Context = {
  payload: unknown
  result?: ReturnType<typeof parseVirtualKeyQuota>
  error?: unknown
}

function a_quota_payload(this: Context) {
  this.payload = {
    virtualKeyName: 'orch-key',
    isActive: true,
    budgets: [
      {
        id: 'budget-1',
        maxLimit: 10,
        resetDuration: '1d',
        lastReset: '2026-11-08T00:00:00Z',
        currentUsage: 2.5,
        perModelUsage: [
          {
            model: 'gpt-4.1',
            provider: 'openai',
            totalRequests: 3,
            totalTokens: 1200,
            totalCost: 2.5,
          },
        ],
        sourceType: null,
        sourceId: null,
        sourceName: null,
      },
    ],
    rateLimit: null,
    rateLimits: [],
    providerConfigs: [],
    modelConfigs: [],
  }
}

function a_non_object_payload(this: Context) {
  this.payload = []
}

function the_payload_is_parsed(this: Context) {
  this.result = parseVirtualKeyQuota(this.payload)
}

function parsing_is_attempted(this: Context) {
  try {
    parseVirtualKeyQuota(this.payload)
  } catch (error) {
    this.error = error
  }
}

function the_key_identity_is_present(this: Context) {
  expect(this.result?.virtualKeyName).toBe('orch-key')
  expect(this.result?.isActive).toBe(true)
}

function the_budget_and_model_usage_are_present(this: Context) {
  expect(this.result?.budgets).toHaveLength(1)
  expect(this.result?.budgets[0]?.currentUsage).toBe(2.5)
  expect(this.result?.budgets[0]?.perModelUsage[0]?.model).toBe('gpt-4.1')
}

function a_quota_error_is_thrown(this: Context) {
  expect(this.error).toBeInstanceOf(VirtualKeyQuotaError)
}
