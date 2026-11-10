import { useEffect, useState } from 'react'
import { listCapabilities } from './api'
import type { CapabilitySummary } from './types'

export type CapabilityLibraryState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly items: readonly CapabilitySummary[] }
  | { readonly status: 'error'; readonly message: string }

export const useCapabilityLibrary = (): CapabilityLibraryState => {
  const [state, setState] = useState<CapabilityLibraryState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const items = await listCapabilities()
        if (!cancelled) {
          setState({ status: 'ready', items })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to load capabilities',
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
