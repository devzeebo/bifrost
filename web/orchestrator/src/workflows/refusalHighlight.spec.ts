import { describe, expect } from 'vitest'
import test from 'vitest-gwt'
import { emptyDrawing } from './drawing'
import { highlightFromRefusal } from './refusalHighlight'
import type { SaveRefusalHighlight, WorkflowDrawing } from './types'

describe('refusalHighlight', () => {
  test('highlights a connection named in the refusal', {
    given: {
      a_drawing_with_one_connection,
      a_connection_refusal_message,
    },
    when: {
      highlighting,
    },
    then: {
      the_connection_is_highlighted,
    },
  })

  test('highlights a node named in the refusal', {
    given: {
      a_drawing_with_one_connection,
      a_node_refusal_message,
    },
    when: {
      highlighting,
    },
    then: {
      the_node_is_highlighted,
    },
  })
})

type Context = {
  drawing: WorkflowDrawing
  message: string
  highlight: SaveRefusalHighlight
}

function a_drawing_with_one_connection(this: Context) {
  this.drawing = {
    ...emptyDrawing('11111111-1111-1111-1111-111111111111'),
    nodes: [
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Producer',
        position: { x: 0, y: 0 },
        inputs: [],
        outputs: [{ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'out', schema: true }],
        definition: { style: 'script', spec: {} },
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Consumer',
        position: { x: 200, y: 0 },
        inputs: [{ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'in', schema: true }],
        outputs: [],
        definition: { style: 'script', spec: {} },
      },
    ],
    connections: [
      {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        outputPortId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        inputPortId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      },
    ],
  }
}

function a_connection_refusal_message(this: Context) {
  this.message =
    "Connection 'cccccccc-cccc-cccc-cccc-cccccccccccc' from output 'out' (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa) to input 'in' (bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb) is rejected: schemas do not meet."
}

function a_node_refusal_message(this: Context) {
  this.message =
    "Node 'Producer (22222222-2222-2222-2222-222222222222)' is missing a definition."
}

function highlighting(this: Context) {
  this.highlight = highlightFromRefusal(this.message, this.drawing)
}

function the_connection_is_highlighted(this: Context) {
  expect(this.highlight.connectionIds).toEqual(['cccccccc-cccc-cccc-cccc-cccccccccccc'])
}

function the_node_is_highlighted(this: Context) {
  expect(this.highlight.nodeIds).toEqual(['22222222-2222-2222-2222-222222222222'])
}
