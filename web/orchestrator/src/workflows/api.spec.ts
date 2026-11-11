import { describe, expect, vi } from 'vitest'
import test, { withAspect } from 'vitest-gwt'
import {
  WorkflowConflictError,
  WorkflowNotFoundError,
  WorkflowValidationError,
  createWorkflow,
  deleteWorkflow,
  getWorkflow,
  listWorkflows,
  parseWorkflowDetail,
  saveWorkflow,
} from './api'

describe('workflow api', () => {
  withAspect(reset_fetch, reset_fetch)

  test('listWorkflows maps library rows', {
    given: {
      a_workflow_list_response,
    },
    when: {
      listing_workflows,
    },
    then: {
      the_summaries_are_returned,
    },
  })

  test('getWorkflow maps version nodes and connections', {
    given: {
      a_workflow_detail_response,
    },
    when: {
      getting_a_workflow,
    },
    then: {
      the_detail_is_returned,
    },
  })

  test('getWorkflow maps 404 to WorkflowNotFoundError', {
    given: {
      a_not_found_response,
    },
    when: {
      getting_a_workflow_fails,
    },
    then: {
      a_not_found_error_is_thrown,
    },
  })

  test('saveWorkflow maps 409 to WorkflowConflictError', {
    given: {
      a_conflict_response,
    },
    when: {
      saving_a_workflow_fails,
    },
    then: {
      a_conflict_error_is_thrown,
    },
  })

  test('saveWorkflow maps 400 to WorkflowValidationError', {
    given: {
      a_validation_response,
    },
    when: {
      saving_a_workflow_fails,
    },
    then: {
      a_validation_error_is_thrown,
    },
  })

  test('createWorkflow posts the whole drawing', {
    given: {
      an_empty_success_response,
    },
    when: {
      creating_a_workflow,
    },
    then: {
      create_was_posted,
    },
  })

  test('deleteWorkflow posts the workflow id', {
    given: {
      an_empty_success_response,
    },
    when: {
      deleting_a_workflow,
    },
    then: {
      delete_was_posted,
    },
  })

  test('deleteWorkflow maps 404 to WorkflowNotFoundError', {
    given: {
      a_not_found_response,
    },
    when: {
      deleting_a_workflow_fails,
    },
    then: {
      a_not_found_error_is_thrown,
    },
  })

  test('parseWorkflowDetail rejects missing position', {
    given: {},
    when: {
      parsing_a_node_without_position,
    },
    then: {
      an_api_error_is_thrown,
    },
  })
})

type Context = {
  fetchMock: ReturnType<typeof vi.fn>
  result: unknown
  error: unknown
}

function reset_fetch(this: Context) {
  this.fetchMock = vi.fn()
  this.result = undefined
  this.error = undefined
  vi.stubGlobal('fetch', this.fetchMock)
}

function a_workflow_list_response(this: Context) {
  this.fetchMock.mockResolvedValue(
    jsonResponse({
      items: [{ id: '11111111-1111-1111-1111-111111111111', name: 'alpha' }],
    }),
  )
}

function a_workflow_detail_response(this: Context) {
  this.fetchMock.mockResolvedValue(
    jsonResponse({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'alpha',
      version: 2,
      nodes: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'start',
          position: { x: 10, y: 20 },
          inputs: [],
          outputs: [
            {
              id: '33333333-3333-3333-3333-333333333333',
              name: 'out',
              schema: true,
            },
          ],
          definition: { style: 'script', spec: { image: 'bifrost/node', body: 'x' } },
        },
      ],
      connections: [],
    }),
  )
}

function a_not_found_response(this: Context) {
  this.fetchMock.mockResolvedValue(
    problemResponse(404, 'Workflow 11111111-1111-1111-1111-111111111111 not found.'),
  )
}

function a_conflict_response(this: Context) {
  this.fetchMock.mockResolvedValue(
    problemResponse(409, 'Workflow changed since it was opened.'),
  )
}

function a_validation_response(this: Context) {
  this.fetchMock.mockResolvedValue(problemResponse(400, "Node 'x' is missing a definition."))
}

function an_empty_success_response(this: Context) {
  this.fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
}

async function listing_workflows(this: Context) {
  this.result = await listWorkflows()
}

async function getting_a_workflow(this: Context) {
  this.result = await getWorkflow('11111111-1111-1111-1111-111111111111')
}

async function getting_a_workflow_fails(this: Context) {
  try {
    await getWorkflow('11111111-1111-1111-1111-111111111111')
  } catch (error) {
    this.error = error
  }
}

async function saving_a_workflow_fails(this: Context) {
  try {
    await saveWorkflow({
      drawing: {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'alpha',
        nodes: [],
        connections: [],
      },
      expectedVersion: 1,
    })
  } catch (error) {
    this.error = error
  }
}

async function creating_a_workflow(this: Context) {
  await createWorkflow({
    id: '11111111-1111-1111-1111-111111111111',
    name: 'alpha',
    nodes: [],
    connections: [],
  })
}

async function deleting_a_workflow(this: Context) {
  await deleteWorkflow('11111111-1111-1111-1111-111111111111')
}

async function deleting_a_workflow_fails(this: Context) {
  try {
    await deleteWorkflow('11111111-1111-1111-1111-111111111111')
  } catch (error) {
    this.error = error
  }
}

function parsing_a_node_without_position(this: Context) {
  try {
    parseWorkflowDetail({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'alpha',
      version: 1,
      nodes: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'start',
          inputs: [],
          outputs: [],
          definition: null,
        },
      ],
      connections: [],
    })
  } catch (error) {
    this.error = error
  }
}

function the_summaries_are_returned(this: Context) {
  expect(this.result).toEqual([
    { id: '11111111-1111-1111-1111-111111111111', name: 'alpha' },
  ])
}

function the_detail_is_returned(this: Context) {
  expect(this.result).toEqual({
    id: '11111111-1111-1111-1111-111111111111',
    name: 'alpha',
    version: 2,
    nodes: [
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'start',
        position: { x: 10, y: 20 },
        inputs: [],
        outputs: [
          {
            id: '33333333-3333-3333-3333-333333333333',
            name: 'out',
            schema: true,
          },
        ],
        definition: { style: 'script', spec: { image: 'bifrost/node', body: 'x' } },
      },
    ],
    connections: [],
  })
}

function a_not_found_error_is_thrown(this: Context) {
  expect(this.error).toBeInstanceOf(WorkflowNotFoundError)
}

function a_conflict_error_is_thrown(this: Context) {
  expect(this.error).toBeInstanceOf(WorkflowConflictError)
  expect((this.error as Error).message).toBe('Workflow changed since it was opened.')
}

function a_validation_error_is_thrown(this: Context) {
  expect(this.error).toBeInstanceOf(WorkflowValidationError)
}

function create_was_posted(this: Context) {
  expect(this.fetchMock).toHaveBeenCalledWith(
    '/create-workflow',
    expect.objectContaining({ method: 'POST' }),
  )
}

function delete_was_posted(this: Context) {
  expect(this.fetchMock).toHaveBeenCalledWith(
    '/delete-workflow',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ id: '11111111-1111-1111-1111-111111111111' }),
    }),
  )
}

function an_api_error_is_thrown(this: Context) {
  expect(this.error).toBeInstanceOf(Error)
}

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

const problemResponse = (status: number, detail: string) =>
  new Response(JSON.stringify({ detail }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
