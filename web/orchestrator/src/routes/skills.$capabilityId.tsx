import { Link, createFileRoute } from '@tanstack/react-router'
import { useCapability } from '../capabilities/useCapability'
import { useCapabilityChat } from '../capabilities/useCapabilityChat'
import { useEvalRuns } from '../capabilities/useEvalRuns'
import { AskDocument } from '../components/organisms/AskDocument'
import { CapabilityChatPanel } from '../components/organisms/CapabilityChatPanel'
import { CapabilityVersionPanel } from '../components/organisms/CapabilityVersionPanel'
import { CriteriaPanel } from '../components/organisms/CriteriaPanel'
import { DerivedSkillPanel } from '../components/organisms/DerivedSkillPanel'
import { SuitePanel } from '../components/organisms/SuitePanel'
import { PageLayout } from '../components/templates/PageLayout'

const CapabilityPage = () => {
  const { capabilityId } = Route.useParams()
  const {
    state,
    saveAsk,
    saveCriterion,
    saveName,
    saveEval,
    duplicateEval,
    retireEval,
    reload,
  } = useCapability(capabilityId)
  const chat = useCapabilityChat(capabilityId, reload)
  const evalRuns = useEvalRuns(capabilityId)

  if (state.status === 'loading') {
    return (
      <PageLayout title="Capability" subtitle="Loading…" current="skills">
        <p className="text-sm">
          <Link to="/skills" className="text-muted hover:text-fg">
            ← Capability library
          </Link>
        </p>
        <p className="text-sm text-muted">Loading capability…</p>
      </PageLayout>
    )
  }

  if (state.status === 'error') {
    return (
      <PageLayout title="Capability" subtitle="Could not load" current="skills">
        <p className="text-sm">
          <Link to="/skills" className="text-muted hover:text-fg">
            ← Capability library
          </Link>
        </p>
        <p className="border border-line bg-surface px-5 py-6 text-sm text-signal">{state.message}</p>
      </PageLayout>
    )
  }

  const { capability } = state

  const refreshAfterMutation = async (mutate: () => Promise<void>) => {
    await mutate()
    await evalRuns.reload()
  }

  const afterHandSave = async (
    save: () => Promise<{ readonly outcome: string }>,
  ) => {
    const result = await save()
    await chat.reload()
    if (result.outcome !== 'Proposed') {
      await evalRuns.reload()
    }
    return result
  }

  return (
    <PageLayout
      title={capability.name}
      subtitle={
        capability.hasPublishedSkill ? 'Published skill available' : 'Never published'
      }
      current="skills"
    >
      <p className="text-sm">
        <Link to="/skills" className="text-muted hover:text-fg">
          ← Capability library
        </Link>
      </p>
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
        currentCapabilityVersionId={capability.currentCapabilityVersionId}
        onSaveAsk={(ask) => afterHandSave(() => saveAsk(ask))}
        onSaveName={saveName}
        onApplyProposal={async (proposalId) => {
          await chat.applyProposal(proposalId)
          await evalRuns.reload()
        }}
        onDismissProposal={chat.dismissProposal}
        onRereadProposal={chat.rereadProposal}
        proposalBusy={chat.busy}
      />
      <CriteriaPanel
        criteria={capability.criteria}
        currentCapabilityVersionId={capability.currentCapabilityVersionId}
        onSaveCriterion={(criterionId, statement) =>
          afterHandSave(() => saveCriterion(criterionId, statement))
        }
        onApplyProposal={async (proposalId) => {
          await chat.applyProposal(proposalId)
          await evalRuns.reload()
        }}
        onDismissProposal={chat.dismissProposal}
        onRereadProposal={chat.rereadProposal}
        proposalBusy={chat.busy}
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
        onAmend={(input) => afterHandSave(() => saveEval(input))}
        onDuplicate={(evalId) => refreshAfterMutation(() => duplicateEval(evalId))}
        onRetire={(evalId) => refreshAfterMutation(() => retireEval(evalId))}
        onApplyProposal={async (proposalId) => {
          await chat.applyProposal(proposalId)
          await evalRuns.reload()
        }}
        onDismissProposal={chat.dismissProposal}
        onRereadProposal={chat.rereadProposal}
        proposalBusy={chat.busy}
      />
      <DerivedSkillPanel
        capabilityId={capability.id}
        hasPublishedSkill={capability.hasPublishedSkill}
        skillMarkdown={capability.skillMarkdown}
        hasUnsavedSkillDraft={capability.hasUnsavedSkillDraft}
        isSkillStale={capability.isSkillStale}
        skillStaleLayers={capability.skillStaleLayers}
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
    </PageLayout>
  )
}

export const Route = createFileRoute('/skills/$capabilityId')({
  component: CapabilityPage,
  remountDeps: ({ params }) => [params.capabilityId],
})
