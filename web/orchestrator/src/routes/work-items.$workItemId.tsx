import { Link, createFileRoute } from '@tanstack/react-router'
import { RunList } from '../components/organisms/RunList'
import { WorkItemDetail } from '../components/organisms/WorkItemDetail'
import { PageLayout } from '../components/templates/PageLayout'
import { useTrackedWorkItemDetail } from '../workItems/useTrackedWorkItemDetail'

const WorkItemDetailPage = () => {
  const { workItemId } = Route.useParams()
  const detail = useTrackedWorkItemDetail(workItemId)

  return (
    <PageLayout
      title="Tracked work item"
      subtitle="Lifecycle status, runs, and operator actions."
      current="status"
    >
      <p className="text-sm">
        <Link to="/" className="text-muted hover:text-fg">
          ← Cluster status
        </Link>
      </p>
      {detail.kind === 'loading' ? (
        <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
          Loading work item…
        </p>
      ) : null}
      {detail.kind === 'error' ? (
        <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">{detail.message}</p>
      ) : null}
      {detail.kind === 'ready' ? (
        <>
          <WorkItemDetail
            item={detail.item}
            attachedWorkflow={detail.attachedWorkflow}
            actionPending={detail.actionPending}
            actionError={detail.actionError}
            onCancel={() => {
              if (window.confirm('Cancel this tracked work item?')) {
                void detail.cancel()
              }
            }}
            onRelease={() => {
              if (window.confirm('Release this tracked work item back to pending?')) {
                void detail.release()
              }
            }}
          />
          <RunList runs={detail.runs} />
        </>
      ) : null}
    </PageLayout>
  )
}

export const Route = createFileRoute('/work-items/$workItemId')({
  component: WorkItemDetailPage,
})
