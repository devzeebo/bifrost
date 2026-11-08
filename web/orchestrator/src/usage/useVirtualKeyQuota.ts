import { useEffect, useState } from 'react'
import { fetchVirtualKeyQuota, type VirtualKeyQuota } from './virtualKeyQuota'

export type VirtualKeyQuotaStatus =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly quota: VirtualKeyQuota }
  | { readonly kind: 'error'; readonly message: string }

export const useVirtualKeyQuota = (): VirtualKeyQuotaStatus => {
  const [status, setStatus] = useState<VirtualKeyQuotaStatus>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false

    const load = async (): Promise<void> => {
      try {
        const quota = await fetchVirtualKeyQuota()
        if (cancelled) {
          return
        }
        setStatus({ kind: 'ready', quota })
      } catch (error) {
        if (cancelled) {
          return
        }
        setStatus({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Failed to load quota',
        })
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return status
}
