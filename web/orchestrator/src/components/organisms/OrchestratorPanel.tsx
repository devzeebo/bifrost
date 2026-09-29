import { TimeLabel } from '../atoms/TimeLabel'
import { PodIdentity } from '../molecules/PodIdentity'

type OrchestratorPanelProps = {
  readonly reachable: boolean
  readonly lastSuccessAt: string | null
}

export const OrchestratorPanel = ({ reachable, lastSuccessAt }: OrchestratorPanelProps) => (
  <section className="flex flex-col gap-5 border border-line bg-surface px-5 py-5">
    <PodIdentity
      role="Orchestrator"
      tone={reachable ? 'live' : 'quiet'}
      status={reachable ? 'Reachable' : 'Unreachable'}
    />
    <div className="flex flex-col gap-1">
      <span className="text-xs tracking-[0.14em] text-muted uppercase">Last poll</span>
      <TimeLabel at={lastSuccessAt} />
    </div>
  </section>
)
