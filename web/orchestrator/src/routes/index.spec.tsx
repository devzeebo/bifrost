import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'
import test, { withAspect } from 'vitest-gwt'
import type { WorkerNode } from '../status/workerNodes'
import { routeTree } from '../routeTree.gen'

const nodeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

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
})

type Context = {
  nodes: readonly WorkerNode[]
  pollFails: boolean
}

function reset_page(this: Context) {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  this.nodes = []
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
}

function the_poll_fails(this: Context) {
  this.pollFails = true
  this.nodes = []
}

function no_workers(this: Context) {
  this.pollFails = false
  this.nodes = []
}

async function the_status_page_opens(this: Context) {
  const pollFails = this.pollFails
  const nodes = this.nodes
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (pollFails) {
        throw new Error('network down')
      }
      return new Response(JSON.stringify(nodes), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
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
