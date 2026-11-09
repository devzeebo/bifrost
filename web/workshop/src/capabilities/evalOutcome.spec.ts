import { describe, expect } from 'vitest'
import test from 'vitest-gwt'
import { neverRunOutcome, outcomeEarnedUnderNote, outcomeLabel } from './evalOutcome'
import type { EvalLatestOutcome } from './types'

describe('evalOutcome', () => {
  test('neverRunOutcome is never_run with null versions', {
    when: {
      a_never_run_outcome_is_built,
    },
    then: {
      status_is_never_run,
    },
  })

  test('outcomeLabel names each status', {
    when: {
      labels_are_read,
    },
    then: {
      each_status_has_a_label,
    },
  })

  test('outcomeEarnedUnderNote is silent when versions match', {
    given: {
      a_passed_outcome_on_current_versions,
    },
    when: {
      the_earned_note_is_read,
    },
    then: {
      there_is_no_earned_note,
    },
  })

  test('outcomeEarnedUnderNote names older versions', {
    given: {
      a_passed_outcome_on_older_versions,
    },
    when: {
      the_earned_note_is_read,
    },
    then: {
      the_earned_note_names_versions,
    },
  })
})

type Context = {
  outcome: EvalLatestOutcome
  note: string | null
  labels: Record<string, string>
}

function a_never_run_outcome_is_built(this: Context) {
  this.outcome = neverRunOutcome()
}

function status_is_never_run(this: Context) {
  expect(this.outcome).toEqual({
    status: 'never_run',
    caseRunId: null,
    capabilityVersionId: null,
    skillVersionId: null,
  })
}

function labels_are_read(this: Context) {
  this.labels = {
    passed: outcomeLabel('passed'),
    failed: outcomeLabel('failed'),
    unsettled: outcomeLabel('unsettled'),
    never_run: outcomeLabel('never_run'),
    never_completed: outcomeLabel('never_completed'),
  }
}

function each_status_has_a_label(this: Context) {
  expect(this.labels).toEqual({
    passed: 'Passed',
    failed: 'Failed',
    unsettled: 'Unsettled',
    never_run: 'Never run',
    never_completed: 'Never completed',
  })
}

function a_passed_outcome_on_current_versions(this: Context) {
  this.outcome = {
    status: 'passed',
    caseRunId: 'run-1',
    capabilityVersionId: 'cap-1',
    skillVersionId: 'skill-1',
  }
}

function a_passed_outcome_on_older_versions(this: Context) {
  this.outcome = {
    status: 'passed',
    caseRunId: 'run-old',
    capabilityVersionId: 'cap-old',
    skillVersionId: 'skill-old',
  }
}

function the_earned_note_is_read(this: Context) {
  this.note = outcomeEarnedUnderNote({
    outcome: this.outcome,
    currentCapabilityVersionId:
      this.outcome.capabilityVersionId === 'cap-old' ? 'cap-new' : 'cap-1',
    currentSkillVersionId:
      this.outcome.skillVersionId === 'skill-old' ? 'skill-new' : 'skill-1',
  })
}

function there_is_no_earned_note(this: Context) {
  expect(this.note).toBeNull()
}

function the_earned_note_names_versions(this: Context) {
  expect(this.note).toBe('Earned under capability cap-old / skill skill-old')
}
