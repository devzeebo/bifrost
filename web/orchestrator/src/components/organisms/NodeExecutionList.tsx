import type { NodeExecutionRow, WaitingConnection } from '../../workItems/nodeExecutions'
import { StatusMark } from '../atoms/StatusMark'
import { NodeId } from '../atoms/NodeId'

type NodeExecutionListProps = {
  readonly rows: readonly NodeExecutionRow[]
  readonly error?: string | null
  readonly onRetry?: () => void
}

const toneForFace = (face: NodeExecutionRow['face']) => {
  switch (face) {
    case 'pending':
    case 'waiting':
      return 'stale' as const
    case 'needs-attention':
      return 'quiet' as const
    case 'claimed':
    case 'running':
    case 'succeeded':
      return 'live' as const
    case 'failed':
    case 'canceled':
      return 'quiet' as const
  }
}

const labelForFace = (face: NodeExecutionRow['face']): string => {
  switch (face) {
    case 'pending':
      return 'waiting for a worker'
    case 'claimed':
    case 'running':
      return face
    case 'needs-attention':
      return 'answer owed'
    case 'waiting':
      return 'waiting on inputs'
    case 'succeeded':
    case 'failed':
    case 'canceled':
      return face
  }
}

const describeWait = (wait: WaitingConnection): string => {
  const feeder = wait.feederNodeName
  switch (wait.feederStatus) {
    case 'pending':
      return `${feeder} is waiting for a worker`
    case 'claimed':
    case 'running':
      return `${feeder} is under way`
    case 'needs-attention':
      return `answer owed on ${feeder}`
    case 'failed':
    case 'canceled':
      return `${feeder} ended ${wait.feederStatus}`
    case 'succeeded':
      return `${feeder} concluded`
    case 'unissued':
      return `${feeder} has not started`
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
          <li
            key={row.workItemId ?? row.nodeId ?? row.nodeName ?? 'node'}
            className="border border-line px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-fg">{row.nodeName ?? 'Node'}</span>
                {row.workItemId !== null ? <NodeId id={row.workItemId} /> : null}
              </div>
              <StatusMark tone={toneForFace(row.face)} label={labelForFace(row.face)} />
            </div>
            {row.failureReason !== null ? (
              <p className="mt-2 text-sm text-muted">{row.failureReason}</p>
            ) : null}
            {row.waitingOn.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {row.waitingOn.map((wait) => (
                  <li key={wait.connectionId} className="text-sm text-muted">
                    {wait.inputPortName}: {describeWait(wait)}
                  </li>
                ))}
              </ul>
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
