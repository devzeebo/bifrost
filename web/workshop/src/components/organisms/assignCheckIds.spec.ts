import { describe, expect } from 'vitest'
import test from 'vitest-gwt'
import type { CheckSnapshot } from '../../capabilities/types'
import { assignCheckIds } from './SuitePanel'

describe('assignCheckIds', () => {
  test('reuses ids for unchanged statements', {
    given: {
      two_existing_checks,
      same_statements_reordered,
    },
    when: {
      ids_are_assigned,
    },
    then: {
      both_original_ids_are_kept,
    },
  })

  test('mints a new id when a statement changes or is inserted', {
    given: {
      two_existing_checks,
      first_deleted_and_new_line_added,
    },
    when: {
      ids_are_assigned,
    },
    then: {
      surviving_statement_keeps_its_id,
      new_statement_gets_a_fresh_id,
    },
  })
})

type Context = {
  existing: CheckSnapshot[]
  statements: string[]
  result: CheckSnapshot[]
}

function two_existing_checks(this: Context) {
  this.existing = [
    { id: 'check-a', statement: 'Alpha holds' },
    { id: 'check-b', statement: 'Beta holds' },
  ]
}

function same_statements_reordered(this: Context) {
  this.statements = ['Beta holds', 'Alpha holds']
}

function first_deleted_and_new_line_added(this: Context) {
  this.statements = ['Beta holds', 'Gamma holds']
}

function ids_are_assigned(this: Context) {
  this.result = assignCheckIds(this.statements, this.existing)
}

function both_original_ids_are_kept(this: Context) {
  expect(this.result).toEqual([
    { id: 'check-b', statement: 'Beta holds' },
    { id: 'check-a', statement: 'Alpha holds' },
  ])
}

function surviving_statement_keeps_its_id(this: Context) {
  expect(this.result[0]).toEqual({ id: 'check-b', statement: 'Beta holds' })
}

function new_statement_gets_a_fresh_id(this: Context) {
  expect(this.result[1]?.statement).toBe('Gamma holds')
  expect(this.result[1]?.id).not.toBe('check-a')
  expect(this.result[1]?.id).not.toBe('check-b')
}
