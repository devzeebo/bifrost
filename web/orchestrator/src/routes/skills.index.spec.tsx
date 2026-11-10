import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'
import test, { withAspect } from 'vitest-gwt'
import { routeTree } from '../routeTree.gen'

describe('skills library route', () => {
  withAspect(reset_page, reset_page)

  test('ready library lists capabilities', {
    given: {
      a_capability_in_the_library,
    },
    when: {
      the_library_page_opens,
    },
    then: {
      the_capability_is_listed,
      never_published_is_shown,
    },
  })

  test('failed load shows the error', {
    given: {
      the_list_fails,
    },
    when: {
      the_library_page_opens,
    },
    then: {
      the_error_is_shown,
    },
  })
})

type Context = {
  listFails: boolean
}

function reset_page(this: Context) {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  this.listFails = false
}

function a_capability_in_the_library(this: Context) {
  this.listFails = false
}

function the_list_fails(this: Context) {
  this.listFails = true
}

async function the_library_page_opens(this: Context) {
  const listFails = this.listFails
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (listFails) {
        return new Response('boom', { status: 500 })
      }
      return new Response(
        JSON.stringify({
          items: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              name: 'Draft replies',
              hasPublishedSkill: false,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }),
  )

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/skills'] }),
  })
  render(<RouterProvider router={router} />)
  await router.load()
}

async function the_capability_is_listed() {
  expect(await screen.findByText('Draft replies')).toBeInTheDocument()
}

async function never_published_is_shown() {
  expect(await screen.findByText('Never published')).toBeInTheDocument()
}

async function the_error_is_shown() {
  expect(await screen.findByText('Skills returned 500')).toBeInTheDocument()
}
