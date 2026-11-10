import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'
import test, { withAspect } from 'vitest-gwt'
import { routeTree } from '../routeTree.gen'
import type { TrackedWorkItem, WorkItemRun } from '../workItems/types'

const workItemId = '11111111-1111-1111-1111-111111111111'
const runId = '22222222-2222-2222-2222-222222222222'

describe('work item detail route', () => {
  withAspect(reset_page, reset_page)

  test('shows item status and runs', {
    given: {
      a_claimed_work_item_with_a_run,
    },
    when: {
      the_detail_page_opens,
    },
    then: {
      the_item_and_run_are_visible,
      cancel_and_release_are_available,
    },
  })

  test('cancel posts and refreshes', {
    given: {
      a_claimed_work_item_with_a_run,
    },
    when: {
      the_detail_page_opens,
      cancel_is_confirmed,
    },
    then: {
      cancel_was_posted,
      the_item_shows_canceled,
    },
  })

  test('release posts and refreshes', {
    given: {
      a_claimed_work_item_with_a_run,
    },
    when: {
      the_detail_page_opens,
      release_is_confirmed,
    },
    then: {
      release_was_posted,
      the_item_shows_pending,
    },
  })
})

type Context = {
  item: TrackedWorkItem
  runs: readonly WorkItemRun[]
  posts: string[]
}

function reset_page(this: Context) {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  this.item = {
    id: workItemId,
    status: 'claimed',
    holderId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  }
  this.runs = [
    {
      id: runId,
      workItemId,
      position: 1,
      createdAt: '2026-11-09T12:00:00Z',
      outcome: null,
    },
  ]
  this.posts = []
}

function a_claimed_work_item_with_a_run(this: Context) {
  this.item = {
    id: workItemId,
    status: 'claimed',
    holderId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  }
  this.runs = [
    {
      id: runId,
      workItemId,
      position: 1,
      createdAt: '2026-11-09T12:00:00Z',
      outcome: null,
    },
  ]
}

async function the_detail_page_opens(this: Context) {
  const context = this
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/get-tracked-work-item/')) {
        return jsonResponse(context.item)
      }
      if (url.includes('/list-runs-for-work-item')) {
        return jsonResponse({ items: context.runs })
      }
      if (url.includes('/cancel-tracked-work-item') && method === 'POST') {
        context.posts.push('cancel')
        context.item = { ...context.item, status: 'canceled', holderId: null }
        return new Response(null, { status: 204 })
      }
      if (url.includes('/release-tracked-work-item') && method === 'POST') {
        context.posts.push('release')
        context.item = { ...context.item, status: 'pending', holderId: null }
        return new Response(null, { status: 204 })
      }
      throw new Error(`unexpected fetch ${method} ${url}`)
    }),
  )

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [`/work-items/${workItemId}`],
    }),
  })
  render(<RouterProvider router={router} />)
  await router.load()
}

async function cancel_is_confirmed() {
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
}

async function release_is_confirmed() {
  fireEvent.click(await screen.findByRole('button', { name: 'Release' }))
}

async function the_item_and_run_are_visible() {
  expect(await screen.findByText('11111111')).toBeInTheDocument()
  expect(screen.getAllByText('claimed').length).toBeGreaterThan(0)
  expect(screen.getByText('22222222')).toBeInTheDocument()
}

async function cancel_and_release_are_available() {
  expect(await screen.findByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Release' })).toBeInTheDocument()
}

async function cancel_was_posted(this: Context) {
  await vi.waitFor(() => {
    expect(this.posts).toContain('cancel')
  })
}

async function release_was_posted(this: Context) {
  await vi.waitFor(() => {
    expect(this.posts).toContain('release')
  })
}

async function the_item_shows_canceled() {
  await vi.waitFor(() => {
    expect(screen.getAllByText('canceled').length).toBeGreaterThan(0)
  })
  expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
}

async function the_item_shows_pending() {
  await vi.waitFor(() => {
    expect(screen.getAllByText('pending').length).toBeGreaterThan(0)
  })
  expect(screen.queryByRole('button', { name: 'Release' })).not.toBeInTheDocument()
}

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
