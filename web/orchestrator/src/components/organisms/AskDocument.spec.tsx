import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'
import test, { withAspect } from 'vitest-gwt'
import type { HandSaveResult, Proposal } from '../../capabilities/types'
import { AskDocument } from './AskDocument'

describe('AskDocument', () => {
  withAspect(reset_page, reset_page)

  test('save that proposes sync shows the proposal without wiping the draft', {
    given: {
      a_save_that_proposes_sync,
    },
    when: {
      the_document_renders,
      the_ask_is_edited,
      save_is_clicked,
    },
    then: {
      the_draft_is_kept,
      the_proposal_is_shown,
    },
  })

  test('layer-moved notice appears when version changes under a dirty draft', {
    given: {
      a_direct_apply_save,
    },
    when: {
      the_document_renders,
      the_ask_is_edited,
      the_capability_version_moves,
    },
    then: {
      the_layer_moved_notice_is_shown,
      the_draft_is_kept,
    },
  })
})

type Context = {
  onSaveAsk: (ask: string) => Promise<HandSaveResult>
  currentCapabilityVersionId: string | null
  rerender: ReturnType<typeof render>['rerender'] | null
}

function reset_page(this: Context) {
  cleanup()
  this.onSaveAsk = vi.fn(async () => ({
    outcome: 'Applied',
    proposal: null,
    messages: [],
    pendingProposals: [],
  }))
  this.currentCapabilityVersionId = 'version-1'
  this.rerender = null
}

function a_save_that_proposes_sync(this: Context) {
  const proposal: Proposal = {
    id: 'proposal-1',
    createdAt: '2026-11-10T00:00:00Z',
    summary: 'Amend ask and sync criteria',
    expectedCapabilityVersionId: 'version-1',
    expectedSkillMarkdown: '',
    effects: [
      {
        kind: 'AmendAsk',
        description: 'Reword the ask',
        ask: 'Updated ask for the work',
      },
      {
        kind: 'SharpenCriterion',
        description: 'Re-read criterion against the ask',
        criterionId: 'criterion-1',
        statement: 'Updated ask for the work',
      },
    ],
    isStale: false,
  }
  this.onSaveAsk = vi.fn(async () => ({
    outcome: 'Proposed',
    proposal,
    messages: [],
    pendingProposals: [proposal],
  }))
}

function a_direct_apply_save(this: Context) {
  this.onSaveAsk = vi.fn(async () => ({
    outcome: 'Applied',
    proposal: null,
    messages: [],
    pendingProposals: [],
  }))
}

function the_document_renders(this: Context) {
  const view = render(
    <AskDocument
      ask="Original ask"
      name="Capability"
      hasUnsavedDraft={false}
      currentCapabilityVersionId={this.currentCapabilityVersionId}
      onSaveAsk={this.onSaveAsk}
      onSaveName={async () => undefined}
      onApplyProposal={async () => undefined}
      onDismissProposal={async () => undefined}
      onRereadProposal={async () => undefined}
      proposalBusy={false}
    />,
  )
  this.rerender = view.rerender
}

function the_ask_is_edited() {
  fireEvent.change(screen.getByDisplayValue('Original ask'), {
    target: { value: 'Updated ask for the work' },
  })
}

async function save_is_clicked() {
  fireEvent.click(screen.getByRole('button', { name: 'Save ask' }))
  await waitFor(() => {
    expect(screen.getByText('Amend ask and sync criteria')).toBeInTheDocument()
  })
}

function the_capability_version_moves(this: Context) {
  this.currentCapabilityVersionId = 'version-2'
  this.rerender?.(
    <AskDocument
      ask="Original ask"
      name="Capability"
      hasUnsavedDraft={false}
      currentCapabilityVersionId={this.currentCapabilityVersionId}
      onSaveAsk={this.onSaveAsk}
      onSaveName={async () => undefined}
      onApplyProposal={async () => undefined}
      onDismissProposal={async () => undefined}
      onRereadProposal={async () => undefined}
      proposalBusy={false}
    />,
  )
}

function the_draft_is_kept() {
  expect(screen.getByDisplayValue('Updated ask for the work')).toBeInTheDocument()
}

function the_proposal_is_shown() {
  expect(screen.getByText('Amend ask and sync criteria')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument()
}

function the_layer_moved_notice_is_shown() {
  expect(
    screen.getByText(/This layer moved underneath your draft/i),
  ).toBeInTheDocument()
}
