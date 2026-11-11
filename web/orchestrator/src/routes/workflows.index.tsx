import { Link, createFileRoute } from '@tanstack/react-router'
import { WorkflowLibrary } from '../components/organisms/WorkflowLibrary'
import { PageLayout } from '../components/templates/PageLayout'
import { useWorkflowLibrary } from '../workflows/useWorkflowLibrary'

const WorkflowLibraryPage = () => {
  const library = useWorkflowLibrary()

  return (
    <PageLayout
      title="Workflows"
      subtitle="Create and edit drawings of nodes and connections."
      current="workflows"
      actions={
        <Link
          to="/workflows/new"
          className="border border-signal-dim px-4 py-2 text-xs tracking-[0.16em] text-signal uppercase"
        >
          New workflow
        </Link>
      }
    >
      {library.status === 'loading' ? (
        <p className="text-sm text-muted">Loading workflows…</p>
      ) : null}
      {library.status === 'error' ? (
        <p className="border border-line bg-surface px-5 py-6 text-sm text-signal">{library.message}</p>
      ) : null}
      {library.status === 'ready' ? <WorkflowLibrary items={library.items} /> : null}
    </PageLayout>
  )
}

export const Route = createFileRoute('/workflows/')({
  component: WorkflowLibraryPage,
})
