import { useEffect, useState } from 'react'
import type { WorkerRowProps } from '../components/organisms/WorkerRow'
import { freshnessOf, pollIntervalMs } from './freshness'
import { fetchWorkerNodes } from './workerNodes'

export type ClusterStatus = {
  readonly reachable: boolean
  readonly lastSuccessAt: string | null
  readonly workers: readonly WorkerRowProps[]
}

const initialStatus: ClusterStatus = {
  reachable: false,
  lastSuccessAt: null,
  workers: [],
}

export const useClusterStatus = (): ClusterStatus => {
  const [status, setStatus] = useState<ClusterStatus>(initialStatus)

  useEffect(() => {
    let cancelled = false

    const poll = async (): Promise<void> => {
      try {
        const nodes = await fetchWorkerNodes()
        if (cancelled) {
          return
        }
        const now = Date.now()
        setStatus({
          reachable: true,
          lastSuccessAt: new Date(now).toISOString(),
          workers: nodes.map((node) => ({
            id: node.id,
            isAvailable: node.isAvailable,
            freshness: freshnessOf(node.lastHeartbeatAt, now),
            lastHeartbeatAt: node.lastHeartbeatAt,
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
