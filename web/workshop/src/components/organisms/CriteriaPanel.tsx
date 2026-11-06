import type { CriterionSnapshot } from '../../capabilities/types'

type CriteriaPanelProps = {
  readonly criteria: readonly CriterionSnapshot[]
}

export const CriteriaPanel = ({ criteria }: CriteriaPanelProps) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Criteria</h2>
    {criteria.length === 0 ? (
      <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
        No criteria yet. Decompose the ask into independent, eval-backed criteria.
      </p>
    ) : (
      <ul className="flex flex-col gap-2 border border-line bg-surface px-5 py-6">
        {criteria.map((criterion) => (
          <li key={criterion.id} className="text-sm text-fg">
            {criterion.statement}
          </li>
        ))}
      </ul>
    )}
  </section>
)
