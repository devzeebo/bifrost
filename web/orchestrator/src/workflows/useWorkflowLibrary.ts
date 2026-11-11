import { useEffect, useState } from 'react'
import { deleteWorkflow as deleteWorkflowRequest, listWorkflows } from './api'
import type { WorkflowSummary } from './types'

type LibraryState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready'
      readonly items: readonly WorkflowSummary[]
      readonly deleteError: string | null
      readonly deleteWorkflow: (id: string) => Promise<void>
    }

export const useWorkflowLibrary = (): LibraryState => {
  const [state, setState] = useState<
    | { readonly status: 'loading' }
    | { readonly status: 'error'; readonly message: string }
    | {
        readonly status: 'ready'
        readonly items: readonly WorkflowSummary[]
        readonly deleteError: string | null
      }
  >({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const items = await listWorkflows()
        if (!cancelled) {
          setState({ status: 'ready', items, deleteError: null })
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

  if (state.status !== 'ready') {
    return state
  }

  return {
    ...state,
    deleteWorkflow: async (id: string) => {
      const confirmed = window.confirm('Delete this workflow?')
      if (!confirmed) {
        return
      }
      try {
        await deleteWorkflowRequest(id)
        setState((current) => {
          if (current.status !== 'ready') {
            return current
          }
          return {
            status: 'ready',
            items: current.items.filter((item) => item.id !== id),
            deleteError: null,
          }
        })
      } catch (error) {
        setState((current) => {
          if (current.status !== 'ready') {
            return current
          }
          return {
            ...current,
            deleteError:
              error instanceof Error ? error.message : 'Could not delete workflow',
          }
        })
      }
    },
  }
}
