import { useMemo } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { WorkflowEditor } from '../components/organisms/WorkflowEditor'
import { EditorLayout } from '../components/templates/EditorLayout'
import { useWorkflowEditor } from '../workflows/useWorkflowEditor'

const NewWorkflowPage = () => {
  const navigate = useNavigate()
  const workflowId = useMemo(() => crypto.randomUUID(), [])
  const editor = useWorkflowEditor(workflowId, 'new')

  if (editor.state.status !== 'ready') {
    return (
      <EditorLayout title="New workflow" subtitle="Loading…">
        <p className="text-sm text-muted">Preparing editor…</p>
      </EditorLayout>
    )
  }

  return (
    <EditorLayout
      title="New workflow"
      subtitle="Place nodes, connect ports, and save the whole drawing."
      actions={
        <Link to="/workflows" className="text-sm text-muted hover:text-fg">
          ← Workflows
        </Link>
      }
    >
      <WorkflowEditor
        drawing={editor.state.drawing}
        dirty={editor.state.dirty}
        saving={editor.state.saving}
        refusalMessage={editor.state.refusal?.message ?? null}
        highlight={editor.state.refusal}
        conflictOpen={editor.state.conflictOpen}
        saveError={editor.state.saveError}
        exists={editor.state.exists}
        onChangeDrawing={editor.setDrawing}
        onChangeName={editor.setName}
        onSave={async () => {
          const saved = await editor.save()
          if (saved) {
            await navigate({
              to: '/workflows/$workflowId',
              params: { workflowId },
            })
          }
          return saved
        }}
        onOverwrite={editor.overwrite}
        onDiscardRemote={editor.discardRemote}
        onDismissConflict={editor.dismissConflict}
      />
    </EditorLayout>
  )
}

export const Route = createFileRoute('/workflows/new')({
  component: NewWorkflowPage,
})
