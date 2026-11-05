import { useCallback, useEffect, useState } from 'react'
import { changeCapabilityAsk, getCapability, renameCapability } from './api'
import type { CapabilityDetail } from './types'

export type CapabilityState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly capability: CapabilityDetail }
  | { readonly status: 'error'; readonly message: string }

export const useCapability = (id: string) => {
  const [state, setState] = useState<CapabilityState>({ status: 'loading' })

  const reload = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const capability = await getCapability(id)
      setState({ status: 'ready', capability })
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load capability',
      })
    }
  }, [id])

  useEffect(() => {
    void reload()
  }, [reload])

  const saveAsk = useCallback(
    async (ask: string) => {
      await changeCapabilityAsk({ id, ask })
      await reload()
    },
    [id, reload],
  )

  const saveName = useCallback(
    async (name: string) => {
      await renameCapability({ id, name })
      await reload()
    },
    [id, reload],
  )

  return { state, saveAsk, saveName }
}
