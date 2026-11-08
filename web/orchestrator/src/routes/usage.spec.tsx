import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'
import test, { withAspect } from 'vitest-gwt'
import type { VirtualKeyQuota } from '../usage/virtualKeyQuota'
import { routeTree } from '../routeTree.gen'

describe('usage route', () => {
  withAspect(reset_page, reset_page)

  test('ready quota shows key identity and budget usage', {
    given: {
      a_quota_response,
    },
    when: {
      the_usage_page_opens,
    },
    then: {
      key_is_active,
      budget_usage_is_shown,
    },
  })

  test('failed quota fetch shows the error', {
    given: {
      the_quota_fetch_fails,
    },
    when: {
      the_usage_page_opens,
    },
    then: {
      an_error_is_shown,
    },
  })
})

type Context = {
  quota: VirtualKeyQuota | null
  fetchFails: boolean
}

function reset_page(this: Context) {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  this.quota = null
  this.fetchFails = false
}

function a_quota_response(this: Context) {
  this.fetchFails = false
  this.quota = {
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
    providerConfigs: [
      {
        id: 1,
        provider: 'openai',
        budgets: [
          {
            id: 'provider-budget',
            maxLimit: 5,
            resetDuration: '1d',
            lastReset: '2026-11-08T00:00:00Z',
            currentUsage: 1,
            perModelUsage: [],
            sourceType: null,
            sourceId: null,
            sourceName: null,
          },
        ],
        rateLimit: null,
      },
    ],
    modelConfigs: [],
  }
}

function the_quota_fetch_fails(this: Context) {
  this.fetchFails = true
  this.quota = null
}

async function the_usage_page_opens(this: Context) {
  const fetchFails = this.fetchFails
  const quota = this.quota
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (fetchFails) {
        throw new Error('network down')
      }
      return new Response(JSON.stringify(quota), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }),
  )

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/usage'] }),
  })
  render(<RouterProvider router={router} />)
  await router.load()
}

async function key_is_active() {
  expect(await screen.findByText('orch-key')).toBeInTheDocument()
  expect(screen.getByText('Active')).toBeInTheDocument()
}

async function budget_usage_is_shown() {
  expect(await screen.findByText('$2.50')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Per-model usage' })).toBeInTheDocument()
}

async function an_error_is_shown() {
  expect(await screen.findByText('network down')).toBeInTheDocument()
}
