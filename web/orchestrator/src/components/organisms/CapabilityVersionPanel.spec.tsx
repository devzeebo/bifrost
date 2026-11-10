import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'
import test, { withAspect } from 'vitest-gwt'
import { CapabilityVersionPanel } from './CapabilityVersionPanel'

const listCapabilityVersions = vi.hoisted(() => vi.fn())
const getCapabilityVersion = vi.hoisted(() => vi.fn())
const restoreCapabilityVersion = vi.hoisted(() => vi.fn())
const compareCapabilityVersions = vi.hoisted(() => vi.fn())

vi.mock('../../capabilities/api', () => ({
  listCapabilityVersions,
  getCapabilityVersion,
  restoreCapabilityVersion,
  compareCapabilityVersions,
}))

describe('CapabilityVersionPanel', () => {
  withAspect(reset_page, reset_page)

  test('lists versions newest first and opens read-only', {
    given: {
      two_capability_versions,
    },
    when: {
      the_panel_renders,
      the_newest_version_is_opened,
    },
    then: {
      the_ask_is_shown_read_only,
    },
  })
})

type Context = {
  onRestored: () => Promise<void>
}

function reset_page(this: Context) {
  cleanup()
  vi.clearAllMocks()
  this.onRestored = vi.fn(async () => undefined)
  window.confirm = vi.fn(() => true)
}

function two_capability_versions() {
  listCapabilityVersions.mockResolvedValue([
    {
      versionId: '22222222-2222-2222-2222-222222222222',
      recordedAt: '2026-11-05T18:00:00Z',
    },
    {
      versionId: '11111111-1111-1111-1111-111111111111',
      recordedAt: '2026-11-05T17:00:00Z',
    },
  ])
  getCapabilityVersion.mockResolvedValue({
    versionId: '22222222-2222-2222-2222-222222222222',
    capabilityId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    recordedAt: '2026-11-05T18:00:00Z',
    snapshot: {
      ask: 'Newest ask wording',
      criteria: [],
      evals: [],
    },
  })
}

async function the_panel_renders(this: Context) {
  render(
    <CapabilityVersionPanel
      capabilityId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
      onRestored={this.onRestored}
    />,
  )
  await waitFor(() => {
    expect(listCapabilityVersions).toHaveBeenCalled()
  })
}

async function the_newest_version_is_opened() {
  const buttons = await screen.findAllByRole('button')
  const openNewest = buttons.find((button) => button.textContent?.includes('22222222'))
  expect(openNewest).toBeTruthy()
  fireEvent.click(openNewest!)
}

async function the_ask_is_shown_read_only() {
  await waitFor(() => {
    expect(screen.getByText('Newest ask wording')).toBeInTheDocument()
  })
  expect(screen.getByText(/read only/i)).toBeInTheDocument()
}
