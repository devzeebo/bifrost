type FactProps = {
  readonly label: string
  readonly value: string
}

export const Fact = ({ label, value }: FactProps) => (
  <div className="flex min-w-28 flex-col gap-1">
    <span className="text-xs tracking-[0.14em] text-muted uppercase">{label}</span>
    <span className="text-sm text-fg">{value}</span>
  </div>
)
