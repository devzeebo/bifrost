import { formatTime } from '../../status/freshness'
import type { WorkItemRun } from '../../workItems/types'
import { NodeId } from '../atoms/NodeId'
import { Fact } from '../molecules/Fact'

type RunListProps = {
  readonly runs: readonly WorkItemRun[]
}

export const RunList = ({ runs }: RunListProps) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Runs</h2>
    {runs.length === 0 ? (
      <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
        No runs for this work item.
      </p>
    ) : (
      <ul className="flex flex-col gap-3">
        {runs.map((run) => (
          <li key={run.id}>
            <article className="grid items-center gap-4 border border-line bg-surface px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="flex flex-wrap items-center gap-3">
                <NodeId id={run.id} />
                <span className="text-sm text-muted">#{run.position}</span>
              </div>
              <div className="flex flex-wrap gap-6">
                <Fact label="Created" value={formatTime(run.createdAt)} />
                <Fact label="Outcome" value={run.outcome ?? '—'} />
              </div>
            </article>
          </li>
        ))}
      </ul>
    )}
  </section>
)
