import { Link } from '@tanstack/react-router'
import type { CapabilitySummary } from '../../capabilities/types'

type CapabilityLibraryProps = {
  readonly items: readonly CapabilitySummary[]
}

export const CapabilityLibrary = ({ items }: CapabilityLibraryProps) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Capabilities</h2>
    {items.length === 0 ? (
      <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
        No capabilities yet. Create one with a name and an ask.
      </p>
    ) : (
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              to="/capabilities/$capabilityId"
              params={{ capabilityId: item.id }}
              className="flex items-center justify-between gap-4 border border-line bg-surface px-5 py-4 hover:border-signal-dim"
            >
              <span className="text-base text-fg">{item.name}</span>
              <span className="text-xs tracking-[0.12em] text-muted uppercase">
                {item.hasPublishedSkill ? 'Published' : 'Never published'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </section>
)
