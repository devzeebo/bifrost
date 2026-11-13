import { useEffect, useState } from 'react'
import { getWorkflow, WorkflowNotFoundError } from '../workflows/api'
import { cancelTrackedWorkItem } from './cancelTrackedWorkItem'
import { fetchLedgerWorkItem } from './ledgerWorkItem'
import {
  fetchNodeExecutionsForRoot,
  readWorkflowSnapshot,
  type NodeExecutionRow,
  type WorkflowSnapshotSummary,
} from './nodeExecutions'
import { releaseTrackedWorkItem } from './releaseTrackedWorkItem'
import { fetchRunsForWorkItem } from './runs'
import { fetchTrackedWorkItem } from './trackedWorkItem'
import { isActiveStatus, type TrackedWorkItem, type WorkItemRun } from './types'

export type AttachedWorkflow =
  | { readonly kind: 'none' }
  | { readonly kind: 'id-only'; readonly id: string }
  | { readonly kind: 'resolved'; readonly id: string; readonly name: string }
  | { readonly kind: 'unresolved'; readonly id: string }

export type TrackedWorkItemDetailStatus =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | {
      readonly kind: 'ready'
      readonly item: TrackedWorkItem
      readonly runs: readonly WorkItemRun[]
      readonly attachedWorkflow: AttachedWorkflow
      readonly workflowSnapshot: WorkflowSnapshotSummary | null
      readonly nodeExecutions: readonly NodeExecutionRow[]
      readonly nodeExecutionsError: string | null
      readonly actionError: string | null
      readonly actionPending: boolean
    }

export type TrackedWorkItemDetail = TrackedWorkItemDetailStatus & {
  readonly refresh: () => Promise<void>
  readonly retryNodeExecutions: () => Promise<void>
  readonly cancel: () => Promise<void>
  readonly release: () => Promise<void>
}

const POLL_MS = 2000

export const useTrackedWorkItemDetail = (workItemId: string): TrackedWorkItemDetail => {
  const [status, setStatus] = useState<TrackedWorkItemDetailStatus>({ kind: 'loading' })

  const load = async (): Promise<TrackedWorkItemDetailStatus> => {
    try {
      const [item, runs, ledger] = await Promise.all([
        fetchTrackedWorkItem(workItemId),
        fetchRunsForWorkItem(workItemId),
        fetchLedgerWorkItem(workItemId).catch(() => null),
      ])
      const attachedWorkflow = await resolveAttachedWorkflow(ledger?.attachedWorkflowId ?? null)
      const workflowSnapshot = ledger ? readWorkflowSnapshot(ledger.metadata) : null
      let nodeExecutions: readonly NodeExecutionRow[] = []
      let nodeExecutionsError: string | null = null
      if (ledger?.attachedWorkflowId !== null && ledger?.attachedWorkflowId !== undefined) {
        try {
          nodeExecutions = await fetchNodeExecutionsForRoot(workItemId)
        } catch (error) {
          nodeExecutionsError =
            error instanceof Error ? error.message : 'Failed to load node executions'
        }
      }
      return {
        kind: 'ready',
        item,
        runs,
        attachedWorkflow,
        workflowSnapshot,
        nodeExecutions,
        nodeExecutionsError,
        actionError: null,
        actionPending: false,
      }
    } catch (error) {
      return {
        kind: 'error',
        message: error instanceof Error ? error.message : 'Failed to load work item',
      }
    }
  }

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async (): Promise<void> => {
      const next = await load()
      if (cancelled) {
        return
      }
      setStatus((prev) => preserveActionState(prev, next))
      if (next.kind === 'ready' && shouldPoll(next)) {
        timer = setTimeout(() => {
          void tick()
        }, POLL_MS)
      }
    }

    void tick()

    return () => {
      cancelled = true
      if (timer !== undefined) {
        clearTimeout(timer)
      }
    }
  }, [workItemId])

  const refresh = async (): Promise<void> => {
    setStatus(await load())
  }

  const retryNodeExecutions = async (): Promise<void> => {
    if (status.kind !== 'ready') {
      return
    }
    const current = status
    try {
      const nodeExecutions = await fetchNodeExecutionsForRoot(workItemId)
      setStatus({
        ...current,
        nodeExecutions,
        nodeExecutionsError: null,
      })
    } catch (error) {
      setStatus({
        ...current,
        nodeExecutionsError:
          error instanceof Error ? error.message : 'Failed to load node executions',
      })
    }
  }

  const cancel = async (): Promise<void> => {
    if (status.kind !== 'ready' || status.actionPending) {
      return
    }
    const current = status
    setStatus({ ...current, actionPending: true, actionError: null })
    try {
      await cancelTrackedWorkItem({ id: current.item.id, status: current.item.status })
      setStatus(await load())
    } catch (error) {
      setStatus({
        ...current,
        actionPending: false,
        actionError: error instanceof Error ? error.message : 'Cancel failed',
      })
    }
  }

  const release = async (): Promise<void> => {
    if (status.kind !== 'ready' || status.actionPending) {
      return
    }
    const current = status
    setStatus({ ...current, actionPending: true, actionError: null })
    try {
      await releaseTrackedWorkItem({ id: current.item.id, status: current.item.status })
      setStatus(await load())
    } catch (error) {
      setStatus({
        ...current,
        actionPending: false,
        actionError: error instanceof Error ? error.message : 'Release failed',
      })
    }
  }

  return {
    ...status,
    refresh,
    retryNodeExecutions,
    cancel,
    release,
  }
}

const shouldPoll = (ready: Extract<TrackedWorkItemDetailStatus, { kind: 'ready' }>): boolean => {
  if (isActiveStatus(ready.item.status)) {
    return true
  }
  return ready.nodeExecutions.some((row) => isActiveStatus(row.status))
}

const preserveActionState = (
  prev: TrackedWorkItemDetailStatus,
  next: TrackedWorkItemDetailStatus,
): TrackedWorkItemDetailStatus => {
  if (prev.kind !== 'ready' || next.kind !== 'ready' || !prev.actionPending) {
    return next
  }
  return {
    ...next,
    actionPending: prev.actionPending,
    actionError: prev.actionError,
  }
}

const resolveAttachedWorkflow = async (workflowId: string | null): Promise<AttachedWorkflow> => {
  if (workflowId === null) {
    return { kind: 'none' }
  }
  try {
    const workflow = await getWorkflow(workflowId)
    return { kind: 'resolved', id: workflow.id, name: workflow.name }
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) {
      return { kind: 'unresolved', id: workflowId }
    }
    return { kind: 'id-only', id: workflowId }
  }
}
