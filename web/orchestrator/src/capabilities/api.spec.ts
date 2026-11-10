import { describe, expect, vi } from 'vitest'
import test, { withAspect } from 'vitest-gwt'
import {
  CapabilityApiError,
  createCapability,
  getCapability,
  listCapabilities,
} from './api'

describe('capability api', () => {
  withAspect(reset_fetch, reset_fetch)

  test('listCapabilities maps library rows', {
    given: {
      a_capability_list_response,
    },
    when: {
      listing_capabilities,
    },
    then: {
      the_summaries_are_returned,
    },
  })

  test('getCapability maps the living ask and empty layers', {
    given: {
      a_capability_detail_response,
    },
    when: {
      getting_a_capability,
    },
    then: {
      the_detail_is_returned,
    },
  })

  test('createCapability posts name and ask', {
    given: {
      an_empty_success_response,
    },
    when: {
      creating_a_capability,
    },
    then: {
      create_was_posted,
    },
  })

  test('listCapabilities rejects a bad payload', {
    given: {
      an_invalid_list_response,
    },
    when: {
      listing_capabilities_fails,
    },
    then: {
      a_capability_api_error_is_thrown,
    },
  })

  test('listCapabilities surfaces ProblemDetails detail', {
    given: {
      a_problem_details_error_response,
    },
    when: {
      listing_capabilities_fails,
    },
    then: {
      the_problem_detail_is_thrown,
    },
  })
})

type Context = {
  fetchMock: ReturnType<typeof vi.fn>
  result: unknown
  error: unknown
}

function reset_fetch(this: Context) {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  this.fetchMock = vi.fn()
  this.result = undefined
  this.error = undefined
  vi.stubGlobal('fetch', this.fetchMock)
}

function a_capability_list_response(this: Context) {
  this.fetchMock.mockResolvedValue(
    new Response(
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
    ),
  )
}

function a_capability_detail_response(this: Context) {
  this.fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Draft replies',
        ask: 'Write clear customer replies.',
        criteria: [],
        evals: [],
        hasPublishedSkill: false,
        skillMarkdown: '',
        currentCapabilityVersionId: '22222222-2222-2222-2222-222222222222',
        currentSkillVersionId: null,
        derivedAgainstCapabilityVersionId: null,
        hasUnsavedCapabilityDraft: false,
        hasUnsavedSkillDraft: false,
        isSkillStale: false,
        skillStaleLayers: {
          askChanged: false,
          criteriaChanged: false,
          evalsChanged: false,
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  )
}

function an_empty_success_response(this: Context) {
  this.fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
}

function an_invalid_list_response(this: Context) {
  this.fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ items: 'nope' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

function a_problem_details_error_response(this: Context) {
  this.fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 502,
        title: 'Capability editor unavailable',
        detail: 'The capability editor could not respond. Try again.',
      }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    ),
  )
}

async function listing_capabilities(this: Context) {
  this.result = await listCapabilities()
}

async function getting_a_capability(this: Context) {
  this.result = await getCapability('11111111-1111-1111-1111-111111111111')
}

async function creating_a_capability(this: Context) {
  await createCapability({
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Draft replies',
    ask: 'Write clear customer replies.',
  })
}

async function listing_capabilities_fails(this: Context) {
  try {
    await listCapabilities()
  } catch (error) {
    this.error = error
  }
}

function the_summaries_are_returned(this: Context) {
  expect(this.result).toEqual([
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Draft replies',
      hasPublishedSkill: false,
    },
  ])
}

function the_detail_is_returned(this: Context) {
  expect(this.result).toEqual({
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Draft replies',
    ask: 'Write clear customer replies.',
    criteria: [],
    evals: [],
    hasPublishedSkill: false,
    skillMarkdown: '',
    currentCapabilityVersionId: '22222222-2222-2222-2222-222222222222',
    currentSkillVersionId: null,
    derivedAgainstCapabilityVersionId: null,
    hasUnsavedCapabilityDraft: false,
    hasUnsavedSkillDraft: false,
    isSkillStale: false,
    skillStaleLayers: {
      askChanged: false,
      criteriaChanged: false,
      evalsChanged: false,
    },
  })
}

function create_was_posted(this: Context) {
  expect(this.fetchMock).toHaveBeenCalledWith(
    '/create-capability',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Draft replies',
        ask: 'Write clear customer replies.',
      }),
    }),
  )
}

function a_capability_api_error_is_thrown(this: Context) {
  expect(this.error).toBeInstanceOf(CapabilityApiError)
}

function the_problem_detail_is_thrown(this: Context) {
  expect(this.error).toBeInstanceOf(CapabilityApiError)
  expect((this.error as CapabilityApiError).message).toBe(
    'The capability editor could not respond. Try again.',
  )
}
