export type CapabilitySummary = {
  readonly id: string
  readonly name: string
  readonly hasPublishedSkill: boolean
}

export type CriterionSnapshot = {
  readonly id: string
  readonly statement: string
}

export type CheckKind = 'Script' | 'HumanReview'

export type CheckSnapshot = {
  readonly id: string
  readonly statement: string
  readonly kind: CheckKind
  readonly script: string | null
}

export type EvalOutcomeStatus =
  | 'passed'
  | 'failed'
  | 'unsettled'
  | 'never_run'
  | 'never_completed'

export type EvalLatestOutcome = {
  readonly status: EvalOutcomeStatus
  readonly caseRunId: string | null
  readonly capabilityVersionId: string | null
  readonly skillVersionId: string | null
}

export type TranscriptLine = {
  readonly role: string
  readonly text: string
}

export type EvalSpend = {
  readonly model: string
  readonly inputTokens: number
  readonly outputTokens: number
  readonly totalTokens: number
  readonly cost: number | null
}

export type EvalCheckVerdict = {
  readonly checkId: string
  readonly kind: string
  readonly status: string
  readonly reason: string
}

export type EvalCaseRun = {
  readonly id: string
  readonly capabilityId: string
  readonly evalId: string
  readonly criterionId: string
  readonly suiteRunId: string | null
  readonly skillVersionId: string | null
  readonly capabilityVersionId: string | null
  readonly isEval: boolean
  readonly status: string
  readonly outcome: string | null
  readonly transcript: readonly TranscriptLine[]
  readonly spend: EvalSpend | null
  readonly checks: readonly EvalCheckVerdict[]
  readonly startedAt: string
  readonly completedAt: string | null
}

export type SuiteEvalSummary = {
  readonly passed: number
  readonly failed: number
  readonly unsettled: number
  readonly neverCompleted: number
  readonly neverRun: number
}

export type CriterionEvalRollup = {
  readonly criterionId: string
  readonly passed: number
  readonly failed: number
  readonly unsettled: number
  readonly neverCompleted: number
  readonly neverRun: number
}

export type CapabilityEvalOutcomes = {
  readonly capabilityId: string
  readonly suite: SuiteEvalSummary
  readonly criteria: readonly CriterionEvalRollup[]
  readonly evals: readonly (EvalLatestOutcome & {
    readonly evalId: string
    readonly criterionId: string
  })[]
}

export type EvalSuiteRunResult = {
  readonly suiteRunId: string
  readonly status: string
  readonly summary: SuiteEvalSummary
  readonly cases: readonly EvalCaseRun[]
}

export type EvalSnapshot = {
  readonly id: string
  readonly criterionId: string
  readonly scenario: string
  readonly prompt: string
  readonly context: string
  readonly checks: readonly CheckSnapshot[]
}

export type CapabilityVersionSnapshot = {
  readonly ask: string
  readonly criteria: readonly CriterionSnapshot[]
  readonly evals: readonly EvalSnapshot[]
}

export type SkillVersionSnapshot = {
  readonly markdown: string
  readonly derivedAgainstCapabilityVersionId: string
}

export type CapabilityDetail = {
  readonly id: string
  readonly name: string
  readonly ask: string
  readonly criteria: readonly CriterionSnapshot[]
  readonly evals: readonly EvalSnapshot[]
  readonly hasPublishedSkill: boolean
  readonly skillMarkdown: string
  readonly currentCapabilityVersionId: string | null
  readonly currentSkillVersionId: string | null
  readonly derivedAgainstCapabilityVersionId: string | null
  readonly hasUnsavedCapabilityDraft: boolean
  readonly hasUnsavedSkillDraft: boolean
}

export type VersionSummary = {
  readonly versionId: string
  readonly recordedAt: string
}

export type SkillVersionSummary = VersionSummary & {
  readonly derivedAgainstCapabilityVersionId: string
}

export type CapabilityVersionDetail = {
  readonly versionId: string
  readonly capabilityId: string
  readonly recordedAt: string
  readonly snapshot: CapabilityVersionSnapshot
}

export type SkillVersionDetail = {
  readonly versionId: string
  readonly capabilityId: string
  readonly recordedAt: string
  readonly snapshot: SkillVersionSnapshot
}

export type ProposalEffect = {
  readonly kind: string
  readonly description?: string | null
  readonly ask?: string | null
  readonly criterionId?: string | null
  readonly statement?: string | null
  readonly newCriteria?: readonly CriterionSnapshot[] | null
  readonly evalId?: string | null
  readonly sourceEvalId?: string | null
  readonly scenario?: string | null
  readonly prompt?: string | null
  readonly context?: string | null
  readonly checks?: readonly CheckSnapshot[] | null
  readonly markdown?: string | null
  readonly servedCriterionIds?: readonly string[] | null
}

export type Proposal = {
  readonly id: string
  readonly createdAt: string
  readonly summary: string
  readonly expectedCapabilityVersionId: string | null
  readonly expectedCapabilitySnapshot?: CapabilityVersionSnapshot | null
  readonly expectedSkillMarkdown: string
  readonly effects: readonly ProposalEffect[]
  readonly isStale: boolean
  readonly staleNote?: string | null
}

export type ChatMessage = {
  readonly id: string
  readonly at: string
  readonly role: string
  readonly text: string
  readonly proposalId?: string | null
}

export type CapabilityChat = {
  readonly capabilityId: string
  readonly messages: readonly ChatMessage[]
  readonly pendingProposals: readonly Proposal[]
}

export type ApplyProposalResult = {
  readonly outcome: 'Applied' | 'Reoffered' | 'Withdrawn'
  readonly note?: string | null
  readonly proposal?: Proposal | null
  readonly messages: readonly ChatMessage[]
  readonly pendingProposals: readonly Proposal[]
}

export type RereadProposalResult = {
  readonly outcome: 'Reoffered' | 'Withdrawn'
  readonly note?: string | null
  readonly proposal?: Proposal | null
  readonly messages: readonly ChatMessage[]
  readonly pendingProposals: readonly Proposal[]
}
