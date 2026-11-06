import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'
import test, { withAspect } from 'vitest-gwt'
import type { CriterionSnapshot, EvalSnapshot } from '../../capabilities/types'
import { SuitePanel } from './SuitePanel'

describe('SuitePanel', () => {
  withAspect(reset_page, reset_page)

  test('empty criteria invite decomposition', {
    given: {
      no_criteria,
    },
    when: {
      the_panel_renders,
    },
    then: {
      decomposition_invitation_is_shown,
    },
  })

  test('groups evals under criteria and calls out uncovered', {
    given: {
      one_covered_and_one_uncovered_criterion,
    },
    when: {
      the_panel_renders,
    },
    then: {
      criterion_and_scenario_are_shown,
      uncovered_callout_is_shown,
      never_run_badge_is_shown,
    },
  })

  test('opening an eval reveals prompt context checks and script', {
    given: {
      one_covered_and_one_uncovered_criterion,
    },
    when: {
      the_panel_renders,
      the_eval_is_opened,
      the_script_is_opened,
    },
    then: {
      prompt_context_and_checks_are_shown,
      script_body_is_shown,
      check_textarea_is_absent,
    },
  })

  test('kind toggle swaps script to human review', {
    given: {
      one_covered_and_one_uncovered_criterion,
    },
    when: {
      the_panel_renders,
      the_eval_is_opened,
      use_human_review_is_clicked,
    },
    then: {
      amend_was_called_with_human_review,
    },
  })

  test('retiring the last eval confirms uncovering', {
    given: {
      one_covered_and_one_uncovered_criterion,
      confirm_returns_true,
    },
    when: {
      the_panel_renders,
      retire_is_clicked,
    },
    then: {
      confirm_warned_about_last_eval,
      retire_was_called,
    },
  })

  test('run controls call through and show suite summary', {
    given: {
      one_covered_and_one_uncovered_criterion,
      run_handlers_are_provided,
    },
    when: {
      the_panel_renders,
      run_is_clicked,
    },
    then: {
      suite_summary_is_shown,
      run_case_was_called,
    },
  })
})

type Context = {
  criteria: readonly CriterionSnapshot[]
  evals: readonly EvalSnapshot[]
  onAmend: Parameters<typeof SuitePanel>[0]['onAmend']
  onDuplicate: Parameters<typeof SuitePanel>[0]['onDuplicate']
  onRetire: Parameters<typeof SuitePanel>[0]['onRetire']
  onRunCase?: Parameters<typeof SuitePanel>[0]['onRunCase']
  onRunSuite?: Parameters<typeof SuitePanel>[0]['onRunSuite']
  suiteSummary?: Parameters<typeof SuitePanel>[0]['suiteSummary']
  confirmSpy: ReturnType<typeof vi.spyOn>
}

function reset_page(this: Context) {
  cleanup()
  this.criteria = []
  this.evals = []
  this.onAmend = vi.fn(async () => undefined)
  this.onDuplicate = vi.fn(async () => undefined)
  this.onRetire = vi.fn(async () => undefined)
  this.onRunCase = undefined
  this.onRunSuite = undefined
  this.suiteSummary = undefined
  this.confirmSpy?.mockRestore()
  this.confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
}

function run_handlers_are_provided(this: Context) {
  this.onRunCase = vi.fn(async () => undefined)
  this.onRunSuite = vi.fn(async () => undefined)
  this.suiteSummary = {
    passed: 0,
    failed: 0,
    unsettled: 1,
    neverCompleted: 0,
    neverRun: 1,
  }
}

function no_criteria(this: Context) {
  this.criteria = []
  this.evals = []
}

function one_covered_and_one_uncovered_criterion(this: Context) {
  this.criteria = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      statement: 'Replies stay in plain language',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      statement: 'Citations name their sources',
    },
  ]
  this.evals = [
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      criterionId: '11111111-1111-1111-1111-111111111111',
      scenario: 'Given a jargon-heavy ask, the reply stays plain',
      prompt: 'Rewrite this in plain language',
      context: 'Audience: workshop users',
      checks: [
        {
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          statement: 'The work satisfies: Replies stay in plain language',
          kind: 'Script',
          script:
            "export default function check(transcript: string, context: string): boolean {\n  return true;\n}\n",
        },
      ],
    },
  ]
}

function confirm_returns_true(this: Context) {
  this.confirmSpy.mockReturnValue(true)
}

function the_panel_renders(this: Context) {
  render(
    <SuitePanel
      criteria={this.criteria}
      evals={this.evals}
      currentCapabilityVersionId="cap-1"
      currentSkillVersionId={null}
      {...(this.suiteSummary ? { suiteSummary: this.suiteSummary } : {})}
      {...(this.onRunCase ? { onRunCase: this.onRunCase } : {})}
      {...(this.onRunSuite ? { onRunSuite: this.onRunSuite } : {})}
      onAmend={this.onAmend}
      onDuplicate={this.onDuplicate}
      onRetire={this.onRetire}
    />,
  )
}

function run_is_clicked() {
  fireEvent.click(screen.getByRole('button', { name: 'Run' }))
}

function suite_summary_is_shown() {
  expect(screen.getByText('1 unsettled · 1 never run')).toBeInTheDocument()
}

function run_case_was_called(this: Context) {
  expect(vi.mocked(this.onRunCase!)).toHaveBeenCalledWith(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  )
}

function the_eval_is_opened() {
  fireEvent.click(screen.getByText('Given a jargon-heavy ask, the reply stays plain'))
}

function the_script_is_opened() {
  fireEvent.click(screen.getByRole('button', { name: 'Open script' }))
}

function use_human_review_is_clicked() {
  fireEvent.click(screen.getByRole('button', { name: 'Use human review' }))
}

function retire_is_clicked() {
  fireEvent.click(screen.getByRole('button', { name: 'Retire' }))
}

function decomposition_invitation_is_shown() {
  expect(
    screen.getByText(
      'No criteria yet. Decompose the ask into independent, eval-backed criteria.',
    ),
  ).toBeInTheDocument()
}

function criterion_and_scenario_are_shown() {
  expect(screen.getByText('Replies stay in plain language')).toBeInTheDocument()
  expect(
    screen.getByText('Given a jargon-heavy ask, the reply stays plain'),
  ).toBeInTheDocument()
}

function uncovered_callout_is_shown() {
  expect(
    screen.getByText('Uncovered — no eval backs this criterion yet.'),
  ).toBeInTheDocument()
}

function never_run_badge_is_shown() {
  expect(screen.getByText('Never run')).toBeInTheDocument()
}

function prompt_context_and_checks_are_shown() {
  expect(screen.getByText('Rewrite this in plain language')).toBeInTheDocument()
  expect(screen.getByText('Audience: workshop users')).toBeInTheDocument()
  expect(
    screen.getByText('The work satisfies: Replies stay in plain language'),
  ).toBeInTheDocument()
}

function script_body_is_shown() {
  expect(screen.getByText(/export default function check/)).toBeInTheDocument()
}

function check_textarea_is_absent() {
  expect(screen.queryByLabelText(/Checks/i)).not.toBeInTheDocument()
  expect(screen.queryByText('Checks (one per line)')).not.toBeInTheDocument()
}

function amend_was_called_with_human_review(this: Context) {
  expect(vi.mocked(this.onAmend)).toHaveBeenCalledWith(
    expect.objectContaining({
      evalId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      checks: [
        expect.objectContaining({
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          kind: 'HumanReview',
          script: null,
        }),
      ],
    }),
  )
}

function confirm_warned_about_last_eval(this: Context) {
  expect(this.confirmSpy).toHaveBeenCalledWith(
    expect.stringContaining('last eval behind its criterion'),
  )
}

function retire_was_called(this: Context) {
  expect(vi.mocked(this.onRetire)).toHaveBeenCalledWith(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  )
}
