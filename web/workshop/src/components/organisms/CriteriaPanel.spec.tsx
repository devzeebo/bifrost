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
})

type Context = {
  count: number
}

function reset_page(this: Context) {
  cleanup()
  this.count = 0
}

function no_criteria(this: Context) {
  this.count = 0
}

function the_panel_renders(this: Context) {
  render(<CriteriaPanel count={this.count} />)
}

function decomposition_invitation_is_shown() {
  expect(
    screen.getByText(
      'No criteria yet. Decompose the ask into independent, eval-backed criteria.',
    ),
  ).toBeInTheDocument()
}
