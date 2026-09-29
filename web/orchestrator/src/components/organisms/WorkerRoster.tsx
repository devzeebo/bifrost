import { WorkerRow, type WorkerRowProps } from './WorkerRow'

type WorkerRosterProps = {
  readonly workers: readonly WorkerRowProps[]
}

export const WorkerRoster = ({ workers }: WorkerRosterProps) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Worker nodes</h2>
    {workers.length === 0 ? (
      <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
        No worker nodes are registered.
      </p>
    ) : (
      <ul className="flex flex-col gap-3">
        {workers.map((worker) => (
          <li key={worker.id}>
            <WorkerRow
              id={worker.id}
              isAvailable={worker.isAvailable}
              freshness={worker.freshness}
              lastHeartbeatAt={worker.lastHeartbeatAt}
            />
          </li>
        ))}
      </ul>
    )}
  </section>
)
