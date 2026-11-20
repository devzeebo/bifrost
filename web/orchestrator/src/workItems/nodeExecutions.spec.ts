import { describe, expect, vi } from 'vitest'
import test, { withAspect } from 'vitest-gwt'
import {
  fetchNodeExecutionsForRoot,
  mergeBlockedRows,
  type NodeExecutionRow,
  type WorkflowSnapshotGraph,
} from './nodeExecutions'

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

describe('fetchNodeExecutionsForRoot', () => {
  withAspect(reset_fetch, reset_fetch)

  test('shows incomplete drafts when tracking is not ready yet', {
    given: {
      listed_child_with_ledger_but_no_tracking,
    },
    when: {
      fetching_node_executions,
    },
    then: {
      the_draft_row_is_pending,
    },
  })

  test('fails when a listed child ledger cannot load', {
    given: {
      listed_child_with_missing_ledger,
    },
    when: {
      fetching_and_catching,
    },
    then: {
      the_error_is_failed_to_load,
    },
  })

  test('fails when tracking returns a non-missing error', {
    given: {
      listed_child_with_tracking_server_error,
    },
    when: {
      fetching_and_catching,
    },
    then: {
      the_error_is_failed_to_load,
    },
  })
})

type Context = {
  snapshot: WorkflowSnapshotGraph
  issued: NodeExecutionRow[]
  rows: readonly NodeExecutionRow[]
  fetchMock: ReturnType<typeof vi.fn>
  fetched: readonly NodeExecutionRow[] | null
  error: unknown
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

const rootId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const childId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const nodeId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

function reset_fetch(this: Context) {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  this.fetched = null
  this.error = null
  this.fetchMock = vi.fn()
  vi.stubGlobal('fetch', this.fetchMock)
}

function listed_child_with_ledger_but_no_tracking(this: Context) {
  this.fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/list-work-items')) {
      return jsonOk({ items: [{ id: childId }] })
    }
    if (url.includes(`/get-work-item/${childId}`)) {
      return jsonOk({
        id: childId,
        status: 'pending',
        metadata: {
          nodeId,
          nodeName: 'draft-node',
        },
      })
    }
    if (url.includes(`/get-tracked-work-item/${childId}`)) {
      return new Response(null, { status: 404 })
    }
    if (url.includes(`/get-work-item/${rootId}`)) {
      return jsonOk({
        id: rootId,
        status: 'executing',
        metadata: {},
      })
    }
    throw new Error(`unexpected fetch ${url}`)
  })
}

function listed_child_with_missing_ledger(this: Context) {
  this.fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/list-work-items')) {
      return jsonOk({ items: [{ id: childId }] })
    }
    if (url.includes(`/get-work-item/${childId}`)) {
      return new Response(null, { status: 404 })
    }
    throw new Error(`unexpected fetch ${url}`)
  })
}

function listed_child_with_tracking_server_error(this: Context) {
  this.fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/list-work-items')) {
      return jsonOk({ items: [{ id: childId }] })
    }
    if (url.includes(`/get-work-item/${childId}`)) {
      return jsonOk({
        id: childId,
        status: 'pending',
        metadata: {
          nodeId,
          nodeName: 'draft-node',
        },
      })
    }
    if (url.includes(`/get-tracked-work-item/${childId}`)) {
      return new Response(null, { status: 500 })
    }
    throw new Error(`unexpected fetch ${url}`)
  })
}

async function fetching_node_executions(this: Context) {
  this.fetched = await fetchNodeExecutionsForRoot(rootId)
}

async function fetching_and_catching(this: Context) {
  try {
    this.fetched = await fetchNodeExecutionsForRoot(rootId)
  } catch (error) {
    this.error = error
  }
}

function the_draft_row_is_pending(this: Context) {
  expect(this.error).toBeNull()
  expect(this.fetched).toHaveLength(1)
  expect(this.fetched?.[0]).toMatchObject({
    workItemId: childId,
    nodeId,
    nodeName: 'draft-node',
    face: 'pending',
    status: 'pending',
    holderId: null,
  })
}

function the_error_is_failed_to_load(this: Context) {
  expect(this.error).toBeInstanceOf(Error)
  expect((this.error as Error).message).toBe('Failed to load node executions')
}

function jsonOk(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
