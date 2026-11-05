import { createFileRoute } from '@tanstack/react-router'
import { useCapability } from '../../capabilities/useCapability'
import { AskDocument } from '../../components/organisms/AskDocument'
import { CapabilityVersionPanel } from '../../components/organisms/CapabilityVersionPanel'
import { CriteriaPanel } from '../../components/organisms/CriteriaPanel'
import { DerivedSkillPanel } from '../../components/organisms/DerivedSkillPanel'
import { EvalsPanel } from '../../components/organisms/EvalsPanel'
import { WorkshopLayout } from '../../components/templates/WorkshopLayout'

const CapabilityPage = () => {
  const { capabilityId } = Route.useParams()
  const { state, saveAsk, saveName, reload } = useCapability(capabilityId)

  if (state.status === 'loading') {
    return (
      <WorkshopLayout title="Capability" subtitle="Loading…">
        <p className="text-sm text-muted">Loading capability…</p>
      </WorkshopLayout>
    )
  }

  if (state.status === 'error') {
    return (
      <WorkshopLayout title="Capability" subtitle="Could not load">
        <p className="border border-line bg-surface px-5 py-6 text-sm text-signal">{state.message}</p>
      </WorkshopLayout>
    )
  }

  const { capability } = state

  return (
    <WorkshopLayout
      title={capability.name}
      subtitle={
        capability.hasPublishedSkill ? 'Published skill available' : 'Never published'
      }
    >
      <AskDocument
        ask={capability.ask}
        name={capability.name}
        hasUnsavedDraft={capability.hasUnsavedCapabilityDraft}
        onSaveAsk={saveAsk}
        onSaveName={saveName}
      />
      <CriteriaPanel count={capability.criteria.length} />
      <EvalsPanel count={capability.evals.length} />
      <DerivedSkillPanel
        capabilityId={capability.id}
        hasPublishedSkill={capability.hasPublishedSkill}
        skillMarkdown={capability.skillMarkdown}
        hasUnsavedSkillDraft={capability.hasUnsavedSkillDraft}
        onRestored={reload}
      />
      <CapabilityVersionPanel capabilityId={capability.id} onRestored={reload} />
    </WorkshopLayout>
  )
}

export const Route = createFileRoute('/capabilities/$capabilityId')({
  component: CapabilityPage,
})
