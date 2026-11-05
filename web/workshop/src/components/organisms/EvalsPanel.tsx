type EvalsPanelProps = {
  readonly count: number
}

export const EvalsPanel = ({ count }: EvalsPanelProps) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Evals</h2>
    <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
      {count === 0
        ? 'Evals appear behind criteria once the ask is decomposed.'
        : `${count} evals backing the criteria.`}
    </p>
  </section>
)
