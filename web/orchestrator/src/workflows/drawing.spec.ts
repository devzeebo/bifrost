import { describe, expect } from 'vitest'
import test from 'vitest-gwt'
import {
  addConnection,
  emptyDrawing,
  isDrawingDirty,
  moveNode,
  removeNode,
  snapshotDrawing,
} from './drawing'
import type { WorkflowDrawing, WorkflowNode } from './types'

describe('workflow drawing', () => {
  test('isDrawingDirty is false for the baseline snapshot', {
    given: {
      an_empty_drawing,
      a_baseline_from_the_drawing,
    },
    when: {
      checking_dirty,
    },
    then: {
      dirty_is_false,
    },
  })

  test('isDrawingDirty is true after a node move', {
    given: {
      a_drawing_with_one_node,
      a_baseline_from_the_drawing,
      the_node_is_moved,
    },
    when: {
      checking_dirty,
    },
    then: {
      dirty_is_true,
    },
  })

  test('removeNode drops connections that touch its ports', {
    given: {
      a_drawing_with_linked_nodes,
    },
    when: {
      removing_the_producer,
    },
    then: {
      connections_are_gone,
    },
  })

  test('addConnection is idempotent for the same port pair', {
    given: {
      a_drawing_with_linked_nodes,
    },
    when: {
      adding_the_same_connection_again,
    },
    then: {
      only_one_connection_remains,
    },
  })

  test('addConnection replaces an existing wire into the same input', {
    given: {
      a_drawing_with_two_producers_and_one_linked_input,
    },
    when: {
      reconnecting_the_input_from_the_other_output,
    },
    then: {
      only_the_new_output_feeds_the_input,
    },
  })

  test('addConnection rejects a node feeding itself', {
    given: {
      a_drawing_with_one_self_connectable_node,
    },
    when: {
      connecting_the_node_to_itself,
    },
    then: {
      no_connections_exist,
    },
  })
})

type Context = {
  drawing: WorkflowDrawing
  baseline: string | null
  dirty: boolean
  producer: WorkflowNode
  otherProducer: WorkflowNode
  consumer: WorkflowNode
}

function an_empty_drawing(this: Context) {
  this.drawing = emptyDrawing('11111111-1111-1111-1111-111111111111')
}

function a_drawing_with_one_node(this: Context) {
  this.producer = {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'A',
    position: { x: 0, y: 0 },
    inputs: [],
    outputs: [{ id: 'out-1', name: 'out', schema: true }],
    definition: { style: 'script', spec: { body: '' } },
  }
  this.drawing = {
    ...emptyDrawing('11111111-1111-1111-1111-111111111111'),
    nodes: [this.producer],
  }
}

function a_drawing_with_linked_nodes(this: Context) {
  this.producer = {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'A',
    position: { x: 0, y: 0 },
    inputs: [],
    outputs: [{ id: 'out-1', name: 'out', schema: true }],
    definition: { style: 'script', spec: { body: '' } },
  }
  this.consumer = {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'B',
    position: { x: 200, y: 0 },
    inputs: [{ id: 'in-1', name: 'in', schema: true }],
    outputs: [],
    definition: { style: 'script', spec: { body: '' } },
  }
  this.drawing = {
    ...emptyDrawing('11111111-1111-1111-1111-111111111111'),
    nodes: [this.producer, this.consumer],
    connections: [
      {
        id: 'conn-1',
        outputPortId: 'out-1',
        inputPortId: 'in-1',
      },
    ],
  }
}

function a_baseline_from_the_drawing(this: Context) {
  this.baseline = snapshotDrawing(this.drawing)
}

function the_node_is_moved(this: Context) {
  this.drawing = moveNode(this.drawing, this.producer.id, 40, 50)
}

function checking_dirty(this: Context) {
  this.dirty = isDrawingDirty(this.drawing, this.baseline)
}

function removing_the_producer(this: Context) {
  this.drawing = removeNode(this.drawing, this.producer.id)
}

function a_drawing_with_two_producers_and_one_linked_input(this: Context) {
  a_drawing_with_linked_nodes.call(this)
  this.otherProducer = {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'C',
    position: { x: 0, y: 120 },
    inputs: [],
    outputs: [{ id: 'out-2', name: 'out', schema: true }],
    definition: { style: 'script', spec: { body: '' } },
  }
  this.drawing = {
    ...this.drawing,
    nodes: [...this.drawing.nodes, this.otherProducer],
  }
}

function adding_the_same_connection_again(this: Context) {
  this.drawing = addConnection(this.drawing, 'out-1', 'in-1')
}

function reconnecting_the_input_from_the_other_output(this: Context) {
  this.drawing = addConnection(this.drawing, 'out-2', 'in-1')
}

function a_drawing_with_one_self_connectable_node(this: Context) {
  this.producer = {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'A',
    position: { x: 0, y: 0 },
    inputs: [{ id: 'in-1', name: 'in', schema: true }],
    outputs: [{ id: 'out-1', name: 'out', schema: true }],
    definition: { style: 'script', spec: { body: '' } },
  }
  this.drawing = {
    ...emptyDrawing('11111111-1111-1111-1111-111111111111'),
    nodes: [this.producer],
  }
}

function connecting_the_node_to_itself(this: Context) {
  this.drawing = addConnection(this.drawing, 'out-1', 'in-1')
}

function dirty_is_false(this: Context) {
  expect(this.dirty).toBe(false)
}

function dirty_is_true(this: Context) {
  expect(this.dirty).toBe(true)
}

function connections_are_gone(this: Context) {
  expect(this.drawing.nodes).toHaveLength(1)
  expect(this.drawing.connections).toEqual([])
}

function only_one_connection_remains(this: Context) {
  expect(this.drawing.connections).toHaveLength(1)
}

function only_the_new_output_feeds_the_input(this: Context) {
  expect(this.drawing.connections).toHaveLength(1)
  expect(this.drawing.connections[0]).toMatchObject({
    outputPortId: 'out-2',
    inputPortId: 'in-1',
  })
}

function no_connections_exist(this: Context) {
  expect(this.drawing.connections).toEqual([])
}
