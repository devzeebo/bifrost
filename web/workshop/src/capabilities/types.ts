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
