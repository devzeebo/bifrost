type CriteriaPanelProps = {
  readonly count: number
}

export const CriteriaPanel = ({ count }: CriteriaPanelProps) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Criteria</h2>
    {count === 0 ? (
      <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
        No criteria yet. Decompose the ask into independent, eval-backed criteria.
      </p>
    ) : (
      <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
        {count} criteria extracted from the ask.
      </p>
    )}
  </section>
)
