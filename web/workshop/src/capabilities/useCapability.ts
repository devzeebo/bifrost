import { useCallback, useEffect, useState } from 'react'
import {
  amendCapabilityAsk,
  amendCapabilityEval,
  duplicateCapabilityEval,
  getCapability,
  renameCapability,
  retireCapabilityEval,
} from './api'
import type { CapabilityDetail, CheckSnapshot } from './types'

export type CapabilityState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly capability: CapabilityDetail }
  | { readonly status: 'error'; readonly message: string }

export const useCapability = (id: string) => {
  const [state, setState] = useState<CapabilityState>({ status: 'loading' })

  const reload = useCallback(async () => {
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
    setState({ status: 'loading' })
    void reload()
  }, [reload])

  const saveAsk = useCallback(
    async (ask: string) => {
      await amendCapabilityAsk({ id, ask })
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

  const saveEval = useCallback(
    async (input: {
      readonly evalId: string
      readonly scenario: string
      readonly prompt: string
      readonly context: string
      readonly checks?: readonly CheckSnapshot[] | null
    }) => {
      await amendCapabilityEval({ id, ...input })
      await reload()
    },
    [id, reload],
  )

  const duplicateEval = useCallback(
    async (sourceEvalId: string) => {
      await duplicateCapabilityEval({
        id,
        sourceEvalId,
        newEvalId: crypto.randomUUID(),
      })
      await reload()
    },
    [id, reload],
  )

  const retireEval = useCallback(
    async (evalId: string) => {
      await retireCapabilityEval({ id, evalId })
      await reload()
    },
    [id, reload],
  )

  return { state, saveAsk, saveName, saveEval, duplicateEval, retireEval, reload }
}
