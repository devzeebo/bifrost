import { createFileRoute } from '@tanstack/react-router'
import { useCapability } from '../../capabilities/useCapability'
import { useCapabilityChat } from '../../capabilities/useCapabilityChat'
import { useEvalRuns } from '../../capabilities/useEvalRuns'
import { AskDocument } from '../../components/organisms/AskDocument'
import { CapabilityChatPanel } from '../../components/organisms/CapabilityChatPanel'
import { CapabilityVersionPanel } from '../../components/organisms/CapabilityVersionPanel'
import { DerivedSkillPanel } from '../../components/organisms/DerivedSkillPanel'
import { SuitePanel } from '../../components/organisms/SuitePanel'
import { WorkshopLayout } from '../../components/templates/WorkshopLayout'

const CapabilityPage = () => {
  const { capabilityId } = Route.useParams()
  const { state, saveAsk, saveName, saveEval, duplicateEval, retireEval, reload } =
    useCapability(capabilityId)
  const chat = useCapabilityChat(capabilityId, reload)
  const evalRuns = useEvalRuns(capabilityId)

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

  const refreshAfterMutation = async (mutate: () => Promise<void>) => {
    await mutate()
    await evalRuns.reload()
  }

  return (
    <WorkshopLayout
      title={capability.name}
      subtitle={
        capability.hasPublishedSkill ? 'Published skill available' : 'Never published'
      }
    >
      <CapabilityChatPanel
        messages={chat.state.status === 'ready' ? chat.state.messages : []}
        pendingProposals={chat.state.status === 'ready' ? chat.state.pendingProposals : []}
        busy={chat.busy || chat.state.status === 'loading'}
        onSend={chat.sendMessage}
        onApply={async (proposalId) => {
          await chat.applyProposal(proposalId)
          await evalRuns.reload()
        }}
        onDismiss={chat.dismissProposal}
        onReread={chat.rereadProposal}
      />
      {chat.state.status === 'error' ? (
        <p className="border border-line bg-surface px-5 py-4 text-sm text-signal">{chat.state.message}</p>
      ) : null}
      <AskDocument
        ask={capability.ask}
        name={capability.name}
        hasUnsavedDraft={capability.hasUnsavedCapabilityDraft}
        onSaveAsk={saveAsk}
        onSaveName={saveName}
      />
      <SuitePanel
        criteria={capability.criteria}
        evals={capability.evals}
        currentCapabilityVersionId={capability.currentCapabilityVersionId}
        currentSkillVersionId={capability.currentSkillVersionId}
        outcomes={evalRuns.outcomes}
        caseRuns={evalRuns.caseRuns}
        criterionRollups={evalRuns.criterionRollups}
        suiteSummary={evalRuns.suiteSummary}
        skillVersions={evalRuns.skillVersions}
        skillTarget={evalRuns.skillTarget}
        onSkillTargetChange={evalRuns.setSkillTarget}
        busyEvalIds={evalRuns.busyEvalIds}
        suiteBusy={evalRuns.suiteBusy}
        canCancelSuite={evalRuns.activeSuiteRunId !== null}
        runError={evalRuns.error}
        onRunCase={evalRuns.runCase}
        onRunSuite={evalRuns.runSuite}
        onCancelSuite={evalRuns.cancelSuite}
        onAmend={saveEval}
        onDuplicate={(evalId) => refreshAfterMutation(() => duplicateEval(evalId))}
        onRetire={(evalId) => refreshAfterMutation(() => retireEval(evalId))}
      />
      <DerivedSkillPanel
        capabilityId={capability.id}
        hasPublishedSkill={capability.hasPublishedSkill}
        skillMarkdown={capability.skillMarkdown}
        hasUnsavedSkillDraft={capability.hasUnsavedSkillDraft}
        onRestored={async () => {
          await reload()
          await evalRuns.reload()
        }}
      />
      <CapabilityVersionPanel
        capabilityId={capability.id}
        onRestored={async () => {
          await reload()
          await evalRuns.reload()
        }}
      />
    </WorkshopLayout>
  )
}

export const Route = createFileRoute('/capabilities/$capabilityId')({
  component: CapabilityPage,
  remountDeps: ({ params }) => [params.capabilityId],
})
