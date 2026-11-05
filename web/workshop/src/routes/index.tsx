import { Link, createFileRoute } from '@tanstack/react-router'
import { useCapabilityLibrary } from '../capabilities/useCapabilityLibrary'
import { CapabilityLibrary } from '../components/organisms/CapabilityLibrary'
import { WorkshopLayout } from '../components/templates/WorkshopLayout'

const LibraryPage = () => {
  const library = useCapabilityLibrary()

  return (
    <WorkshopLayout
      title="Capability library"
      subtitle="Named asks that the workshop decomposes into criteria, evals, and a derived skill."
      actions={
        <Link
          to="/capabilities/new"
          className="border border-signal-dim px-4 py-2 text-xs tracking-[0.16em] text-signal uppercase"
        >
          New capability
        </Link>
      }
    >
      {library.status === 'loading' ? (
        <p className="text-sm text-muted">Loading capabilities…</p>
      ) : null}
      {library.status === 'error' ? (
        <p className="border border-line bg-surface px-5 py-6 text-sm text-signal">{library.message}</p>
      ) : null}
      {library.status === 'ready' ? <CapabilityLibrary items={library.items} /> : null}
    </WorkshopLayout>
  )
}

export const Route = createFileRoute('/')({
  component: LibraryPage,
})
