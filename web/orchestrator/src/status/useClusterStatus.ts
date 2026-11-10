import { useEffect, useState } from 'react'
import type { WorkerRowProps } from '../components/organisms/WorkerRow'
import { fetchHeldWorkItems } from '../workItems/heldWorkItems'
import { fetchPendingWorkItems } from '../workItems/pendingWorkItems'
import type { TrackedWorkItem } from '../workItems/types'
import { freshnessOf, pollIntervalMs } from './freshness'
import { fetchWorkerNodes } from './workerNodes'

export type ClusterWorker = WorkerRowProps & {
  readonly held: readonly TrackedWorkItem[]
}

export type ClusterStatus = {
  readonly reachable: boolean
  readonly lastSuccessAt: string | null
  readonly workers: readonly ClusterWorker[]
  readonly pending: readonly TrackedWorkItem[]
}

const initialStatus: ClusterStatus = {
  reachable: false,
  lastSuccessAt: null,
  workers: [],
  pending: [],
}

export const useClusterStatus = (): ClusterStatus => {
  const [status, setStatus] = useState<ClusterStatus>(initialStatus)

  useEffect(() => {
    let cancelled = false

    const poll = async (): Promise<void> => {
      try {
        const nodes = await fetchWorkerNodes()
        const [pending, heldByWorker] = await Promise.all([
          fetchPendingWorkItems().catch(() => [] as readonly TrackedWorkItem[]),
          Promise.all(
            nodes.map(async (node) => ({
              workerId: node.id,
              held: await fetchHeldWorkItems(node.id).catch(() => [] as readonly TrackedWorkItem[]),
            })),
          ),
        ])
        if (cancelled) {
          return
        }
        const heldMap = new Map(heldByWorker.map((entry) => [entry.workerId, entry.held]))
        const now = Date.now()
        setStatus({
          reachable: true,
          lastSuccessAt: new Date(now).toISOString(),
          pending,
          workers: nodes.map((node) => ({
            id: node.id,
            isAvailable: node.isAvailable,
            freshness: node.isOnline ? freshnessOf(node.lastHeartbeatAt, now) : 'offline',
            lastHeartbeatAt: node.lastHeartbeatAt,
            held: heldMap.get(node.id) ?? [],
          })),
        })
      } catch {
        if (cancelled) {
          return
        }
        setStatus((current) => ({ ...current, reachable: false }))
      }
    }

    void poll()
    const timer = setInterval(() => {
      void poll()
    }, pollIntervalMs)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return status
}
