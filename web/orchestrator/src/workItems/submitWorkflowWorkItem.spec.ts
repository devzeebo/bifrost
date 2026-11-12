import { describe, expect, vi } from 'vitest'
import test, { withAspect } from 'vitest-gwt'
import { submitWorkflowWorkItem } from './submitWorkflowWorkItem'

const workflowId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const workItemId = '11111111-1111-1111-1111-111111111111'

describe('submitWorkflowWorkItem', () => {
  withAspect(reset_fetch, reset_fetch)

  test('attaches then tracks with the same work item id', {
    given: {
      attach_and_track_succeed,
    },
    when: {
      submitting_a_workflow_work_item,
    },
    then: {
      both_posts_share_the_work_item_id,
      the_result_returns_that_id,
    },
  })

  test('surfaces an attach failure without tracking', {
    given: {
      attach_fails,
    },
    when: {
      submitting_and_catching,
    },
    then: {
      the_error_is_from_attach,
      track_was_not_called,
    },
  })

  test('surfaces a track failure after a successful attach', {
    given: {
      track_fails,
    },
    when: {
      submitting_and_catching,
    },
    then: {
      the_error_is_from_track,
      attach_was_called,
    },
  })
})

type Context = {
  fetchMock: ReturnType<typeof vi.fn>
  posts: string[]
  result: { workItemId: string } | null
  error: unknown
}

function reset_fetch(this: Context) {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  this.posts = []
  this.result = null
  this.error = null
  this.fetchMock = vi.fn()
  vi.stubGlobal('fetch', this.fetchMock)
}

function attach_and_track_succeed(this: Context) {
  this.fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/create-attached-work-item')) {
      this.posts.push('attach')
      return new Response(null, { status: 204 })
    }
    if (url.includes('/create-tracked-work-item')) {
      this.posts.push('track')
      return new Response(null, { status: 204 })
    }
    throw new Error(`unexpected fetch ${url}`)
  })
}

function attach_fails(this: Context) {
  this.fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/create-attached-work-item')) {
      this.posts.push('attach')
      return jsonProblem(400, 'Workflow is not startable')
    }
    if (url.includes('/create-tracked-work-item')) {
      this.posts.push('track')
      return new Response(null, { status: 204 })
    }
    throw new Error(`unexpected fetch ${url}`)
  })
}

function track_fails(this: Context) {
  this.fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/create-attached-work-item')) {
      this.posts.push('attach')
      return new Response(null, { status: 204 })
    }
    if (url.includes('/create-tracked-work-item')) {
      this.posts.push('track')
      return jsonProblem(400, 'Track refused')
    }
    throw new Error(`unexpected fetch ${url}`)
  })
}

async function submitting_a_workflow_work_item(this: Context) {
  this.result = await submitWorkflowWorkItem({
    workflowId,
    workItemId,
    data: { hello: 'world' },
  })
}

async function submitting_and_catching(this: Context) {
  try {
    await submitWorkflowWorkItem({
      workflowId,
      workItemId,
      data: { hello: 'world' },
    })
  } catch (error) {
    this.error = error
  }
}

function both_posts_share_the_work_item_id(this: Context) {
  expect(this.posts).toEqual(['attach', 'track'])
  const attachBody = JSON.parse(String(this.fetchMock.mock.calls[0]?.[1]?.body)) as {
    workItemId: string
    workflowId: string
  }
  const trackBody = JSON.parse(String(this.fetchMock.mock.calls[1]?.[1]?.body)) as {
    id: string
  }
  expect(attachBody.workItemId).toBe(workItemId)
  expect(attachBody.workflowId).toBe(workflowId)
  expect(trackBody.id).toBe(workItemId)
}

function the_result_returns_that_id(this: Context) {
  expect(this.result?.workItemId).toBe(workItemId)
}

function the_error_is_from_attach(this: Context) {
  expect(this.error).toBeInstanceOf(Error)
  expect((this.error as Error).message).toContain('Workflow is not startable')
}

function track_was_not_called(this: Context) {
  expect(this.posts).toEqual(['attach'])
}

function the_error_is_from_track(this: Context) {
  expect(this.error).toBeInstanceOf(Error)
  expect((this.error as Error).message).toContain('Track refused')
}

function attach_was_called(this: Context) {
  expect(this.posts).toContain('attach')
}

function jsonProblem(status: number, detail: string): Response {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
