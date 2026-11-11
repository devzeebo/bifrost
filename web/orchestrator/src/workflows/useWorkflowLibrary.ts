import { useEffect, useState } from 'react'
import { listWorkflows } from './api'
import type { WorkflowSummary } from './types'

type LibraryState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly items: readonly WorkflowSummary[] }

export const useWorkflowLibrary = (): LibraryState => {
  const [state, setState] = useState<LibraryState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const items = await listWorkflows()
        if (!cancelled) {
          setState({ status: 'ready', items })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Could not load workflows',
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
