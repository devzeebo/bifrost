export type CapabilitySummary = {
  readonly id: string
  readonly name: string
  readonly hasPublishedSkill: boolean
}

export type CriterionSnapshot = {
  readonly id: string
  readonly statement: string
}

export type EvalSnapshot = {
  readonly id: string
  readonly criterionId: string
  readonly scenario: string
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
  readonly scenario?: string | null
  readonly markdown?: string | null
  readonly servedCriterionIds?: readonly string[] | null
}

export type Proposal = {
  readonly id: string
  readonly createdAt: string
  readonly summary: string
  readonly expectedCapabilityVersionId: string | null
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
