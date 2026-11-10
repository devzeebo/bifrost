import { describe, expect } from 'vitest'
import test from 'vitest-gwt'
import {
  parseTrackedWorkItem,
  parseTrackedWorkItemList,
  parseWorkItemRunList,
  TrackedWorkItemError,
} from './parse'

describe('tracked work item parsers', () => {
  test('maps a tracked work item payload', {
    given: {
      a_work_item_payload,
    },
    when: {
      the_work_item_is_parsed,
    },
    then: {
      the_work_item_fields_are_present,
    },
  })

  test('maps a pending list payload', {
    given: {
      a_pending_list_payload,
    },
    when: {
      the_list_is_parsed,
    },
    then: {
      the_list_contains_the_item,
    },
  })

  test('maps a run list payload', {
    given: {
      a_run_list_payload,
    },
    when: {
      the_runs_are_parsed,
    },
    then: {
      the_run_fields_are_present,
    },
  })

  test('rejects a non-object work item', {
    given: {
      a_non_object_payload,
    },
    when: {
      parsing_work_item_is_attempted,
    },
    then: {
      a_tracked_work_item_error_is_thrown,
    },
  })
})

type Context = {
  payload: unknown
  item?: ReturnType<typeof parseTrackedWorkItem>
  items?: ReturnType<typeof parseTrackedWorkItemList>
  runs?: ReturnType<typeof parseWorkItemRunList>
  error?: unknown
}

function a_work_item_payload(this: Context) {
  this.payload = {
    id: '11111111-1111-1111-1111-111111111111',
    status: 'pending',
    holderId: null,
  }
}

function a_pending_list_payload(this: Context) {
  this.payload = {
    items: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        status: 'pending',
        holderId: null,
      },
    ],
  }
}

function a_run_list_payload(this: Context) {
  this.payload = {
    items: [
      {
        id: '22222222-2222-2222-2222-222222222222',
        workItemId: '11111111-1111-1111-1111-111111111111',
        position: 1,
        createdAt: '2026-11-09T12:00:00Z',
        outcome: 'abandoned',
      },
    ],
  }
}

function a_non_object_payload(this: Context) {
  this.payload = null
}

function the_work_item_is_parsed(this: Context) {
  this.item = parseTrackedWorkItem(this.payload)
}

function the_list_is_parsed(this: Context) {
  this.items = parseTrackedWorkItemList(this.payload)
}

function the_runs_are_parsed(this: Context) {
  this.runs = parseWorkItemRunList(this.payload)
}

function parsing_work_item_is_attempted(this: Context) {
  try {
    parseTrackedWorkItem(this.payload)
  } catch (error) {
    this.error = error
  }
}

function the_work_item_fields_are_present(this: Context) {
  expect(this.item).toEqual({
    id: '11111111-1111-1111-1111-111111111111',
    status: 'pending',
    holderId: null,
  })
}

function the_list_contains_the_item(this: Context) {
  expect(this.items).toHaveLength(1)
  expect(this.items?.[0]?.id).toBe('11111111-1111-1111-1111-111111111111')
}

function the_run_fields_are_present(this: Context) {
  expect(this.runs).toEqual([
    {
      id: '22222222-2222-2222-2222-222222222222',
      workItemId: '11111111-1111-1111-1111-111111111111',
      position: 1,
      createdAt: '2026-11-09T12:00:00Z',
      outcome: 'abandoned',
    },
  ])
}

function a_tracked_work_item_error_is_thrown(this: Context) {
  expect(this.error).toBeInstanceOf(TrackedWorkItemError)
}
