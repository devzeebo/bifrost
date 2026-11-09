import { createFileRoute } from '@tanstack/react-router'
import { OrchestratorPanel } from '../components/organisms/OrchestratorPanel'
import { WorkerRoster } from '../components/organisms/WorkerRoster'
import { PageLayout } from '../components/templates/PageLayout'
import { useClusterStatus } from '../status/useClusterStatus'

const StatusPage = () => {
  const status = useClusterStatus()
  return (
    <PageLayout
      title="Cluster status"
      subtitle="Refreshes every 2 seconds."
      current="status"
    >
      <OrchestratorPanel reachable={status.reachable} lastSuccessAt={status.lastSuccessAt} />
      <WorkerRoster workers={status.workers} />
    </PageLayout>
  )
}

export const Route = createFileRoute('/')({
  component: StatusPage,
})
