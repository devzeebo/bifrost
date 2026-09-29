type NodeIdProps = {
  readonly id: string
}

const shortIdLength = 8

export const NodeId = ({ id }: NodeIdProps) => (
  <span title={id} className="font-mono text-sm tabular-nums tracking-tight text-fg">
    {id.slice(0, shortIdLength)}
  </span>
)
