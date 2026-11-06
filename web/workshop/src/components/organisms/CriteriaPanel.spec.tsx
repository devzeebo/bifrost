import { cleanup, render, screen } from '@testing-library/react'
import { describe, expect } from 'vitest'
import test, { withAspect } from 'vitest-gwt'
import { CriteriaPanel } from './CriteriaPanel'

describe('CriteriaPanel', () => {
  withAspect(reset_page, reset_page)

  test('empty state invites decomposition', {
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

  test('lists criterion statements', {
    given: {
      one_criterion,
    },
    when: {
      the_panel_renders,
    },
    then: {
      the_statement_is_shown,
    },
  })
})

type Context = {
  criteria: Parameters<typeof CriteriaPanel>[0]['criteria']
}

function reset_page(this: Context) {
  cleanup()
  this.criteria = []
}

function no_criteria(this: Context) {
  this.criteria = []
}

function one_criterion(this: Context) {
  this.criteria = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      statement: 'Replies stay in plain language',
    },
  ]
}

function the_panel_renders(this: Context) {
  render(<CriteriaPanel criteria={this.criteria} />)
}

function the_statement_is_shown() {
  expect(screen.getByText('Replies stay in plain language')).toBeInTheDocument()
}

function decomposition_invitation_is_shown() {
  expect(
    screen.getByText(
      'No criteria yet. Decompose the ask into independent, eval-backed criteria.',
    ),
  ).toBeInTheDocument()
}
