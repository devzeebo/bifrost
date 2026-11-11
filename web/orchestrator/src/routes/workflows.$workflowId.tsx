import { Link, createFileRoute } from '@tanstack/react-router'
import { WorkflowEditor } from '../components/organisms/WorkflowEditor'
import { EditorLayout } from '../components/templates/EditorLayout'
import { PageLayout } from '../components/templates/PageLayout'
import { useWorkflowEditor } from '../workflows/useWorkflowEditor'

const WorkflowEditorPage = () => {
  const { workflowId } = Route.useParams()
  const editor = useWorkflowEditor(workflowId, 'existing')

  if (editor.state.status === 'loading') {
    return (
      <EditorLayout title="Workflow" subtitle="Loading…">
        <p className="text-sm">
          <Link to="/workflows" className="text-muted hover:text-fg">
            ← Workflows
          </Link>
        </p>
        <p className="text-sm text-muted">Loading workflow…</p>
      </EditorLayout>
    )
  }

  if (editor.state.status === 'not-found') {
    return (
      <PageLayout title="Workflow not found" subtitle="This link does not match a saved workflow." current="workflows">
        <p className="text-sm">
          <Link to="/workflows" className="text-muted hover:text-fg">
            ← Workflows
          </Link>
        </p>
        <p className="border border-line bg-surface px-5 py-6 text-sm text-signal">{editor.state.message}</p>
      </PageLayout>
    )
  }

  if (editor.state.status === 'error') {
    return (
      <PageLayout title="Workflow" subtitle="Could not load" current="workflows">
        <p className="text-sm">
          <Link to="/workflows" className="text-muted hover:text-fg">
            ← Workflows
          </Link>
        </p>
        <p className="border border-line bg-surface px-5 py-6 text-sm text-signal">{editor.state.message}</p>
      </PageLayout>
    )
  }

  return (
    <EditorLayout
      title={editor.state.drawing.name}
      subtitle="Edit the drawing and save the whole graph."
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
        onSave={editor.save}
        onOverwrite={editor.overwrite}
        onDiscardRemote={editor.discardRemote}
        onDismissConflict={editor.dismissConflict}
      />
    </EditorLayout>
  )
}

export const Route = createFileRoute('/workflows/$workflowId')({
  component: WorkflowEditorPage,
})
