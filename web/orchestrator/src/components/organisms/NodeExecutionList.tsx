import type { NodeExecutionRow } from '../../workItems/nodeExecutions'
import { StatusMark } from '../atoms/StatusMark'
import { NodeId } from '../atoms/NodeId'

type NodeExecutionListProps = {
  readonly rows: readonly NodeExecutionRow[]
  readonly error?: string | null
  readonly onRetry?: () => void
}

const toneForStatus = (status: NodeExecutionRow['status']) => {
  switch (status) {
    case 'pending':
      return 'stale' as const
    case 'needs-attention':
      return 'quiet' as const
    case 'claimed':
    case 'running':
    case 'executing':
    case 'succeeded':
      return 'live' as const
    case 'failed':
    case 'canceled':
      return 'quiet' as const
  }
}

const labelForStatus = (status: NodeExecutionRow['status']): string => {
  switch (status) {
    case 'pending':
      return 'waiting for a worker'
    case 'claimed':
    case 'running':
      return status
    case 'needs-attention':
      return 'needs attention'
    default:
      return status
  }
}

export const NodeExecutionList = ({ rows, error = null, onRetry }: NodeExecutionListProps) => {
  if (error !== null && rows.length === 0) {
    return (
      <section className="border border-line bg-surface px-5 py-5">
        <h2 className="text-sm font-medium text-fg">Node executions</h2>
        <p className="mt-2 text-sm text-muted">{error}</p>
        {onRetry ? (
          <button
            type="button"
            className="mt-3 text-sm text-fg underline"
            onClick={() => {
              onRetry()
            }}
          >
            Retry
          </button>
        ) : null}
      </section>
    )
  }

  if (rows.length === 0) {
    return (
      <section className="border border-line bg-surface px-5 py-5">
        <h2 className="text-sm font-medium text-fg">Node executions</h2>
        <p className="mt-2 text-sm text-muted">No node executions issued yet.</p>
      </section>
    )
  }

  return (
    <section className="border border-line bg-surface px-5 py-5">
      <h2 className="text-sm font-medium text-fg">Node executions</h2>
      {error !== null ? (
        <p className="mt-2 text-sm text-muted">
          {error}
          {onRetry ? (
            <>
              {' '}
              <button
                type="button"
                className="underline text-fg"
                onClick={() => {
                  onRetry()
                }}
              >
                Retry
              </button>
            </>
          ) : null}
        </p>
      ) : null}
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.workItemId} className="border border-line px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-fg">{row.nodeName ?? 'Node'}</span>
                <NodeId id={row.workItemId} />
              </div>
              <StatusMark tone={toneForStatus(row.status)} label={labelForStatus(row.status)} />
            </div>
            {row.failureReason !== null ? (
              <p className="mt-2 text-sm text-muted">{row.failureReason}</p>
            ) : null}
            {row.issuedInputs !== null ? (
              <pre className="mt-3 overflow-x-auto text-xs text-muted">
                {JSON.stringify(row.issuedInputs, null, 2)}
              </pre>
            ) : null}
            {row.producedOutputs !== null ? (
              <pre className="mt-3 overflow-x-auto text-xs text-muted">
                {JSON.stringify(row.producedOutputs, null, 2)}
              </pre>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
