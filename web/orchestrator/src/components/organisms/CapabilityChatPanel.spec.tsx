import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'
import test, { withAspect } from 'vitest-gwt'
import type { ChatMessage, Proposal } from '../../capabilities/types'
import { CapabilityChatPanel } from './CapabilityChatPanel'

describe('CapabilityChatPanel', () => {
  withAspect(reset_page, reset_page)

  test('renders persisted messages after remount-shaped props', {
    given: {
      prior_conversation,
    },
    when: {
      the_panel_renders,
    },
    then: {
      prior_messages_are_shown,
    },
  })

  test('apply and dismiss controls call handlers', {
    given: {
      a_pending_proposal,
    },
    when: {
      the_panel_renders,
      apply_is_clicked,
      dismiss_is_clicked,
    },
    then: {
      apply_and_dismiss_were_called,
    },
  })
})

type Context = {
  messages: readonly ChatMessage[]
  pendingProposals: readonly Proposal[]
  onSend: Parameters<typeof CapabilityChatPanel>[0]['onSend']
  onApply: Parameters<typeof CapabilityChatPanel>[0]['onApply']
  onDismiss: Parameters<typeof CapabilityChatPanel>[0]['onDismiss']
  onReread: Parameters<typeof CapabilityChatPanel>[0]['onReread']
}

function reset_page(this: Context) {
  cleanup()
  this.messages = []
  this.pendingProposals = []
  this.onSend = vi.fn(async () => undefined)
  this.onApply = vi.fn(async () => undefined)
  this.onDismiss = vi.fn(async () => undefined)
  this.onReread = vi.fn(async () => undefined)
}

function prior_conversation(this: Context) {
  this.messages = [
    {
      id: 'm1',
      at: '2026-11-06T12:00:00Z',
      role: 'user',
      text: 'sharpen the first criterion',
    },
    {
      id: 'm2',
      at: '2026-11-06T12:00:01Z',
      role: 'assistant',
      text: 'Proposed sharpening a criterion in place.',
    },
  ]
}

function a_pending_proposal(this: Context) {
  this.pendingProposals = [
    {
      id: 'p1',
      createdAt: '2026-11-06T12:00:01Z',
      summary: 'Sharpen criterion',
      expectedCapabilityVersionId: 'v1',
      expectedSkillMarkdown: '',
      isStale: false,
      effects: [
        {
          kind: 'SharpenCriterion',
          description: 'Sharpen criterion wording',
          criterionId: 'c1',
          statement: 'Clearer wording',
        },
      ],
    },
  ]
}

function the_panel_renders(this: Context) {
  render(
    <CapabilityChatPanel
      messages={this.messages}
      pendingProposals={this.pendingProposals}
      busy={false}
      onSend={this.onSend}
      onApply={this.onApply}
      onDismiss={this.onDismiss}
      onReread={this.onReread}
    />,
  )
}

function apply_is_clicked() {
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
}

function dismiss_is_clicked() {
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
}

function prior_messages_are_shown() {
  expect(screen.getByText('sharpen the first criterion')).toBeInTheDocument()
  expect(
    screen.getByText('Proposed sharpening a criterion in place.'),
  ).toBeInTheDocument()
}

function apply_and_dismiss_were_called(this: Context) {
  expect(this.onApply).toHaveBeenCalledWith('p1')
  expect(this.onDismiss).toHaveBeenCalledWith('p1')
}
