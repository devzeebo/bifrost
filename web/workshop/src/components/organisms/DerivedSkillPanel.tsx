type DerivedSkillPanelProps = {
  readonly hasPublishedSkill: boolean
}

export const DerivedSkillPanel = ({ hasPublishedSkill }: DerivedSkillPanelProps) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Derived skill</h2>
    <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
      {hasPublishedSkill
        ? 'A skill version has been published for real work.'
        : 'No derived skill yet. The skill is the workshop’s output after evals exist.'}
    </p>
  </section>
)
