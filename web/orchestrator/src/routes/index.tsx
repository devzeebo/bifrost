import { createFileRoute } from '@tanstack/react-router'
import { OrchestratorPanel } from '../components/organisms/OrchestratorPanel'
import { WorkerRoster } from '../components/organisms/WorkerRoster'
import { StatusLayout } from '../components/templates/StatusLayout'
import { useClusterStatus } from '../status/useClusterStatus'

const StatusPage = () => {
  const status = useClusterStatus()
  return (
    <StatusLayout>
      <OrchestratorPanel reachable={status.reachable} lastSuccessAt={status.lastSuccessAt} />
      <WorkerRoster workers={status.workers} />
    </StatusLayout>
  )
}

export const Route = createFileRoute('/')({
  component: StatusPage,
})
