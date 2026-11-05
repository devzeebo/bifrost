import { cleanup, render, screen } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'
import test, { withAspect } from 'vitest-gwt'
import { CapabilityLibrary } from './CapabilityLibrary'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    className,
    to,
    params,
  }: {
    children: React.ReactNode
    className?: string
    to: string
    params?: { capabilityId: string }
  }) => {
    const href =
      params?.capabilityId !== undefined
        ? to.replace('$capabilityId', params.capabilityId)
        : to
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  },
}))

describe('CapabilityLibrary', () => {
  withAspect(reset_page, reset_page)

  test('empty library invites creation', {
    given: {
      no_capabilities,
    },
    when: {
      the_library_renders,
    },
    then: {
      empty_state_is_shown,
    },
  })

  test('lists name and never-published status', {
    given: {
      one_unpublished_capability,
    },
    when: {
      the_library_renders,
    },
    then: {
      the_capability_row_is_shown,
    },
  })
})

type Context = {
  items: Parameters<typeof CapabilityLibrary>[0]['items']
}

function reset_page(this: Context) {
  cleanup()
  this.items = []
}

function no_capabilities(this: Context) {
  this.items = []
}

function one_unpublished_capability(this: Context) {
  this.items = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Draft replies',
      hasPublishedSkill: false,
    },
  ]
}

function the_library_renders(this: Context) {
  render(<CapabilityLibrary items={this.items} />)
}

function empty_state_is_shown() {
  expect(
    screen.getByText('No capabilities yet. Create one with a name and an ask.'),
  ).toBeInTheDocument()
}

function the_capability_row_is_shown() {
  expect(screen.getByText('Draft replies')).toBeInTheDocument()
  expect(screen.getByText('Never published')).toBeInTheDocument()
}
