import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'
import test, { withAspect } from 'vitest-gwt'
import type { WorkerNode } from '../status/workerNodes'
import type { TrackedWorkItem } from '../workItems/types'
import { routeTree } from '../routeTree.gen'

const nodeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const pendingId = '11111111-1111-1111-1111-111111111111'
const heldId = '22222222-2222-2222-2222-222222222222'

describe('status route', () => {
  withAspect(reset_page, reset_page)

  test('reachable poll shows the orchestrator and the worker', {
    given: {
      a_live_worker,
    },
    when: {
      the_status_page_opens,
    },
    then: {
      orchestrator_is_reachable,
      worker_is_listed,
    },
  })

  test('failed poll shows the orchestrator as unreachable', {
    given: {
      the_poll_fails,
    },
    when: {
      the_status_page_opens,
    },
    then: {
      orchestrator_is_unreachable,
    },
  })

  test('empty worker list says none are registered', {
    given: {
      no_workers,
    },
    when: {
      the_status_page_opens,
    },
    then: {
      orchestrator_is_reachable,
      roster_is_empty,
    },
  })

  test('shows pending queue and held work', {
    given: {
      a_worker_with_pending_and_held_work,
    },
    when: {
      the_status_page_opens,
    },
    then: {
      pending_item_is_listed,
      held_item_is_listed,
    },
  })
})

type Context = {
  nodes: readonly WorkerNode[]
  pending: readonly TrackedWorkItem[]
  held: readonly TrackedWorkItem[]
  pollFails: boolean
}

function reset_page(this: Context) {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  this.nodes = []
  this.pending = []
  this.held = []
  this.pollFails = false
}

function a_live_worker(this: Context) {
  this.pollFails = false
  this.nodes = [
    {
      id: nodeId,
      isAvailable: true,
      isOnline: true,
      lastHeartbeatAt: new Date().toISOString(),
    },
  ]
  this.pending = []
  this.held = []
}

function the_poll_fails(this: Context) {
  this.pollFails = true
  this.nodes = []
  this.pending = []
  this.held = []
}

function no_workers(this: Context) {
  this.pollFails = false
  this.nodes = []
  this.pending = []
  this.held = []
}

function a_worker_with_pending_and_held_work(this: Context) {
  this.pollFails = false
  this.nodes = [
    {
      id: nodeId,
      isAvailable: true,
      isOnline: true,
      lastHeartbeatAt: new Date().toISOString(),
    },
  ]
  this.pending = [
    {
      id: pendingId,
      status: 'pending',
      holderId: null,
    },
  ]
  this.held = [
    {
      id: heldId,
      status: 'claimed',
      holderId: nodeId,
    },
  ]
}

async function the_status_page_opens(this: Context) {
  const pollFails = this.pollFails
  const nodes = this.nodes
  const pending = this.pending
  const held = this.held
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (pollFails) {
        throw new Error('network down')
      }
      const url = String(input)
      if (url.includes('/list-worker-nodes')) {
        return jsonResponse(nodes)
      }
      if (url.includes('/list-pending-tracked-work-items')) {
        return jsonResponse({ items: pending })
      }
      if (url.includes('/list-tracked-work-items-held-by/')) {
        return jsonResponse({ items: held })
      }
      throw new Error(`unexpected fetch ${url}`)
    }),
  )

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
  await router.load()
}

async function orchestrator_is_reachable() {
  expect(await screen.findByText('Reachable')).toBeInTheDocument()
}

async function worker_is_listed() {
  expect(await screen.findByText('aaaaaaaa')).toBeInTheDocument()
  expect(screen.getByText('Online')).toBeInTheDocument()
  expect(screen.getByText('Available')).toBeInTheDocument()
}

async function orchestrator_is_unreachable() {
  await vi.waitFor(() => {
    expect(vi.mocked(fetch)).toHaveBeenCalled()
  })
  expect(screen.getByText('Unreachable')).toBeInTheDocument()
  expect(screen.queryByText('Reachable')).not.toBeInTheDocument()
}

async function roster_is_empty() {
  expect(await screen.findByText('No worker nodes are registered.')).toBeInTheDocument()
}

async function pending_item_is_listed() {
  expect(await screen.findByText('Pending queue')).toBeInTheDocument()
  expect(screen.getByText('11111111')).toBeInTheDocument()
}

async function held_item_is_listed() {
  expect(await screen.findByText('Held work')).toBeInTheDocument()
  expect(screen.getByText('22222222')).toBeInTheDocument()
}

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
