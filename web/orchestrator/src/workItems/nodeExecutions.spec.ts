import { describe, expect } from 'vitest'
import test from 'vitest-gwt'
import { mergeBlockedRows, type NodeExecutionRow, type WorkflowSnapshotGraph } from './nodeExecutions'

describe('mergeBlockedRows', () => {
  test('adds waiting rows for unissued nodes with inbound connections', {
    given: {
      a_fan_out_snapshot_with_one_issued_feeder,
    },
    when: {
      merging_blocked_rows,
    },
    then: {
      the_downstream_node_waits_on_the_feeder,
    },
  })
})

type Context = {
  snapshot: WorkflowSnapshotGraph
  issued: NodeExecutionRow[]
  rows: readonly NodeExecutionRow[]
}

function a_fan_out_snapshot_with_one_issued_feeder(this: Context) {
  const feederId = '11111111-1111-1111-1111-111111111111'
  const blockedId = '22222222-2222-2222-2222-222222222222'
  const feederOut = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const blockedIn = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  this.snapshot = {
    id: 'wf',
    name: 'fan',
    version: 1,
    nodes: [
      {
        id: 'input',
        name: 'Work item',
        style: 'work-item-input',
        inputs: [],
        outputs: [{ id: 'out', name: 'work item' }],
      },
      {
        id: feederId,
        name: 'feeder',
        style: 'harness',
        inputs: [{ id: 'in', name: 'in' }],
        outputs: [{ id: feederOut, name: 'out' }],
      },
      {
        id: blockedId,
        name: 'blocked',
        style: 'harness',
        inputs: [{ id: blockedIn, name: 'in' }],
        outputs: [{ id: 'bout', name: 'out' }],
      },
    ],
    connections: [
      {
        id: 'c1',
        outputPortId: 'out',
        inputPortId: 'in',
      },
      {
        id: 'c2',
        outputPortId: feederOut,
        inputPortId: blockedIn,
      },
    ],
  }
  this.issued = [
    {
      workItemId: 'work-feeder',
      nodeId: feederId,
      nodeName: 'feeder',
      face: 'needs-attention',
      status: 'needs-attention',
      issuedInputs: null,
      producedOutputs: null,
      failureReason: null,
      holderId: null,
      waitingOn: [],
    },
  ]
}

function merging_blocked_rows(this: Context) {
  this.rows = mergeBlockedRows(this.snapshot, this.issued)
}

function the_downstream_node_waits_on_the_feeder(this: Context) {
  const blocked = this.rows.find((row) => row.nodeName === 'blocked')
  expect(blocked?.face).toBe('waiting')
  expect(blocked?.workItemId).toBeNull()
  expect(blocked?.waitingOn).toHaveLength(1)
  expect(blocked?.waitingOn[0]?.feederStatus).toBe('needs-attention')
  expect(blocked?.waitingOn[0]?.feederNodeName).toBe('feeder')
}
