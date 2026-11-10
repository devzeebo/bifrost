import { describe, expect } from 'vitest'
import test from 'vitest-gwt'
import { diffCriteria, diffLines, evalCountByCriterion } from './diff'

describe('diff helpers', () => {
  test('diffLines marks additions and removals', {
    given: {
      two_ask_texts,
    },
    when: {
      lines_are_diffed,
    },
    then: {
      added_and_removed_rows_are_present,
    },
  })

  test('diffCriteria joins by identity', {
    given: {
      criteria_on_both_sides,
    },
    when: {
      criteria_are_diffed,
    },
    then: {
      shared_and_missing_criteria_are_listed,
    },
  })

  test('evalCountByCriterion tallies per criterion', {
    given: {
      evals_for_two_criteria,
    },
    when: {
      counts_are_taken,
    },
    then: {
      counts_match_the_suite,
    },
  })
})

type Context = {
  left: string
  right: string
  leftCriteria: { id: string; statement: string }[]
  rightCriteria: { id: string; statement: string }[]
  evals: { criterionId: string }[]
  lineDiff: ReturnType<typeof diffLines>
  criterionDiff: ReturnType<typeof diffCriteria>
  counts: ReturnType<typeof evalCountByCriterion>
}

function two_ask_texts(this: Context) {
  this.left = 'alpha\nshared'
  this.right = 'beta\nshared'
}

function criteria_on_both_sides(this: Context) {
  this.leftCriteria = [
    { id: 'a', statement: 'A' },
    { id: 'b', statement: 'B old' },
  ]
  this.rightCriteria = [
    { id: 'b', statement: 'B new' },
    { id: 'c', statement: 'C' },
  ]
}

function evals_for_two_criteria(this: Context) {
  this.evals = [{ criterionId: 'a' }, { criterionId: 'a' }, { criterionId: 'b' }]
}

function lines_are_diffed(this: Context) {
  this.lineDiff = diffLines(this.left, this.right)
}

function criteria_are_diffed(this: Context) {
  this.criterionDiff = diffCriteria(this.leftCriteria, this.rightCriteria)
}

function counts_are_taken(this: Context) {
  this.counts = evalCountByCriterion(this.evals)
}

function added_and_removed_rows_are_present(this: Context) {
  expect(this.lineDiff).toEqual([
    { kind: 'removed', text: 'alpha' },
    { kind: 'added', text: 'beta' },
    { kind: 'same', text: 'shared' },
  ])
}

function shared_and_missing_criteria_are_listed(this: Context) {
  expect(this.criterionDiff).toEqual([
    { id: 'a', leftStatement: 'A', rightStatement: null },
    { id: 'b', leftStatement: 'B old', rightStatement: 'B new' },
    { id: 'c', leftStatement: null, rightStatement: 'C' },
  ])
}

function counts_match_the_suite(this: Context) {
  expect(this.counts.get('a')).toBe(2)
  expect(this.counts.get('b')).toBe(1)
}
