import { useEffect, useState } from 'react'
import { cancelTrackedWorkItem } from './cancelTrackedWorkItem'
import { releaseTrackedWorkItem } from './releaseTrackedWorkItem'
import { fetchRunsForWorkItem } from './runs'
import { fetchTrackedWorkItem } from './trackedWorkItem'
import type { TrackedWorkItem, WorkItemRun } from './types'

export type TrackedWorkItemDetailStatus =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | {
      readonly kind: 'ready'
      readonly item: TrackedWorkItem
      readonly runs: readonly WorkItemRun[]
      readonly actionError: string | null
      readonly actionPending: boolean
    }

export type TrackedWorkItemDetail = TrackedWorkItemDetailStatus & {
  readonly refresh: () => Promise<void>
  readonly cancel: () => Promise<void>
  readonly release: () => Promise<void>
}

export const useTrackedWorkItemDetail = (workItemId: string): TrackedWorkItemDetail => {
  const [status, setStatus] = useState<TrackedWorkItemDetailStatus>({ kind: 'loading' })

  const load = async (): Promise<TrackedWorkItemDetailStatus> => {
    try {
      const [item, runs] = await Promise.all([
        fetchTrackedWorkItem(workItemId),
        fetchRunsForWorkItem(workItemId),
      ])
      return {
        kind: 'ready',
        item,
        runs,
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
    void load().then((next) => {
      if (!cancelled) {
        setStatus(next)
      }
    })
    return () => {
      cancelled = true
    }
  }, [workItemId])

  const refresh = async (): Promise<void> => {
    setStatus(await load())
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
    cancel,
    release,
  }
}
