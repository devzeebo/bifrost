import type { EvalSnapshot } from '../../capabilities/types'

type EvalsPanelProps = {
  readonly evals: readonly EvalSnapshot[]
}

export const EvalsPanel = ({ evals }: EvalsPanelProps) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Evals</h2>
    {evals.length === 0 ? (
      <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
        No evals yet. Each criterion needs scenarios that can prove it.
      </p>
    ) : (
      <ul className="flex flex-col gap-2 border border-line bg-surface px-5 py-6">
        {evals.map((item) => (
          <li key={item.id} className="text-sm text-fg">
            {item.scenario}
          </li>
        ))}
      </ul>
    )}
  </section>
)
