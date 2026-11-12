import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { CreateWorkflowWorkItemForm } from '../components/organisms/CreateWorkflowWorkItemForm'
import { OrchestratorPanel } from '../components/organisms/OrchestratorPanel'
import { PendingQueue } from '../components/organisms/PendingQueue'
import { WorkerRoster } from '../components/organisms/WorkerRoster'
import { PageLayout } from '../components/templates/PageLayout'
import { useClusterStatus } from '../status/useClusterStatus'

const StatusPage = () => {
  const status = useClusterStatus()
  const [formOpen, setFormOpen] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  return (
    <PageLayout
      title="Cluster status"
      subtitle="Refreshes every 2 seconds."
      current="status"
      actions={
        <button
          type="button"
          onClick={() => {
            setSubmittedId(null)
            setFormOpen((open) => !open)
          }}
          className="border border-signal-dim px-4 py-2 text-xs tracking-[0.16em] text-signal uppercase"
        >
          {formOpen ? 'Close form' : 'Create workflow work item'}
        </button>
      }
    >
      <OrchestratorPanel reachable={status.reachable} lastSuccessAt={status.lastSuccessAt} />
      {formOpen ? (
        <CreateWorkflowWorkItemForm
          onCancel={() => setFormOpen(false)}
          onSubmitted={(workItemId) => {
            setSubmittedId(workItemId)
            setFormOpen(false)
          }}
        />
      ) : null}
      {submittedId !== null ? (
        <p className="text-sm text-muted">
          Submitted{' '}
          <Link
            to="/work-items/$workItemId"
            params={{ workItemId: submittedId }}
            className="text-fg hover:text-signal"
          >
            {submittedId.slice(0, 8)}
          </Link>
          . It should appear in the pending queue shortly.
        </p>
      ) : null}
      <PendingQueue items={status.pending} />
      <WorkerRoster workers={status.workers} />
    </PageLayout>
  )
}

export const Route = createFileRoute('/')({
  component: StatusPage,
})
