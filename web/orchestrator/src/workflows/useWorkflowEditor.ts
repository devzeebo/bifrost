import { useCallback, useEffect, useState } from 'react'
import {
  WorkflowConflictError,
  WorkflowNotFoundError,
  WorkflowValidationError,
  createWorkflow,
  getWorkflow,
  saveWorkflow,
} from './api'
import { emptyDrawing, isDrawingDirty, snapshotDrawing } from './drawing'
import { highlightFromRefusal } from './refusalHighlight'
import type { SaveRefusalHighlight, WorkflowDrawing } from './types'

type EditorMode = 'new' | 'existing'

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found'; readonly message: string }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready'
      readonly drawing: WorkflowDrawing
      readonly version: number | null
      readonly exists: boolean
      readonly dirty: boolean
      readonly saving: boolean
      readonly refusal: SaveRefusalHighlight | null
      readonly conflictOpen: boolean
      readonly saveError: string | null
    }

type EditorControls = {
  readonly setDrawing: (updater: (current: WorkflowDrawing) => WorkflowDrawing) => void
  readonly setName: (name: string) => void
  readonly save: () => Promise<boolean>
  readonly overwrite: () => Promise<boolean>
  readonly discardRemote: () => Promise<void>
  readonly dismissConflict: () => void
  readonly clearRefusal: () => void
}

export const useWorkflowEditor = (
  workflowId: string,
  mode: EditorMode,
): { readonly state: LoadState } & EditorControls => {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [baseline, setBaseline] = useState<string | null>(null)

  const loadExisting = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const detail = await getWorkflow(workflowId)
      const drawing: WorkflowDrawing = {
        id: detail.id,
        name: detail.name,
        nodes: detail.nodes,
        connections: detail.connections,
      }
      const snap = snapshotDrawing(drawing)
      setBaseline(snap)
      setState({
        status: 'ready',
        drawing,
        version: detail.version,
        exists: true,
        dirty: false,
        saving: false,
        refusal: null,
        conflictOpen: false,
        saveError: null,
      })
    } catch (error) {
      if (error instanceof WorkflowNotFoundError) {
        setState({ status: 'not-found', message: error.message })
        return
      }
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Could not load workflow',
      })
    }
  }, [workflowId])

  useEffect(() => {
    if (mode === 'new') {
      const drawing = emptyDrawing(workflowId)
      const snap = snapshotDrawing(drawing)
      setBaseline(snap)
      setState({
        status: 'ready',
        drawing,
        version: null,
        exists: false,
        dirty: false,
        saving: false,
        refusal: null,
        conflictOpen: false,
        saveError: null,
      })
      return
    }
    void loadExisting()
  }, [loadExisting, mode, workflowId])

  const withReady = (mutate: (ready: Extract<LoadState, { status: 'ready' }>) => LoadState) => {
    setState((current) => {
      if (current.status !== 'ready') {
        return current
      }
      return mutate(current)
    })
  }

  const setDrawing = (updater: (current: WorkflowDrawing) => WorkflowDrawing) => {
    withReady((ready) => {
      if (ready.saving) {
        return ready
      }
      const drawing = updater(ready.drawing)
      return {
        ...ready,
        drawing,
        dirty: isDrawingDirty(drawing, baseline),
        refusal: null,
        saveError: null,
      }
    })
  }

  const setName = (name: string) => {
    setDrawing((drawing) => ({ ...drawing, name }))
  }

  const persist = async (overwrite: boolean): Promise<boolean> => {
    if (state.status !== 'ready' || state.saving) {
      return false
    }
    const ready = state
    let exists = ready.exists
    setState({ ...ready, saving: true, saveError: null, refusal: null })
    try {
      if (!exists) {
        await createWorkflow(ready.drawing)
        exists = true
        setState({
          ...ready,
          exists: true,
          saving: true,
          saveError: null,
          refusal: null,
        })
      } else {
        await saveWorkflow({
          drawing: ready.drawing,
          expectedVersion: ready.version ?? 0,
          overwrite,
        })
      }
      const detail = await getWorkflow(ready.drawing.id)
      const drawing: WorkflowDrawing = {
        id: detail.id,
        name: detail.name,
        nodes: detail.nodes,
        connections: detail.connections,
      }
      const snap = snapshotDrawing(drawing)
      setBaseline(snap)
      setState({
        status: 'ready',
        drawing,
        version: detail.version,
        exists: true,
        dirty: false,
        saving: false,
        refusal: null,
        conflictOpen: false,
        saveError: null,
      })
      return true
    } catch (error) {
      if (error instanceof WorkflowValidationError) {
        setState({
          ...ready,
          exists,
          saving: false,
          refusal: highlightFromRefusal(error.message, ready.drawing),
        })
        return false
      }
      if (error instanceof WorkflowConflictError) {
        setState({
          ...ready,
          exists,
          saving: false,
          conflictOpen: true,
          saveError: error.message,
        })
        return false
      }
      setState({
        ...ready,
        exists,
        saving: false,
        saveError: error instanceof Error ? error.message : 'Could not save workflow',
      })
      return false
    }
  }

  const discardRemote = async () => {
    if (state.status !== 'ready' || state.saving) {
      return
    }
    const ready = state
    setState({ ...ready, saving: true, saveError: null })
    try {
      const detail = await getWorkflow(workflowId)
      const drawing: WorkflowDrawing = {
        id: detail.id,
        name: detail.name,
        nodes: detail.nodes,
        connections: detail.connections,
      }
      const snap = snapshotDrawing(drawing)
      setBaseline(snap)
      setState({
        status: 'ready',
        drawing,
        version: detail.version,
        exists: true,
        dirty: false,
        saving: false,
        refusal: null,
        conflictOpen: false,
        saveError: null,
      })
    } catch (error) {
      if (error instanceof WorkflowNotFoundError) {
        setState({ status: 'not-found', message: error.message })
        return
      }
      setState({
        ...ready,
        saving: false,
        conflictOpen: true,
        saveError: error instanceof Error ? error.message : 'Could not reload workflow',
      })
    }
  }

  return {
    state,
    setDrawing,
    setName,
    save: () => persist(false),
    overwrite: () => persist(true),
    discardRemote,
    dismissConflict: () => {
      withReady((ready) => {
        if (ready.saving) {
          return ready
        }
        return { ...ready, conflictOpen: false }
      })
    },
    clearRefusal: () => {
      withReady((ready) => ({ ...ready, refusal: null }))
    },
  }
}
