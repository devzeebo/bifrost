export type CapabilitySummary = {
  readonly id: string
  readonly name: string
  readonly hasPublishedSkill: boolean
}

export type CapabilityDetail = {
  readonly id: string
  readonly name: string
  readonly ask: string
  readonly criteria: readonly unknown[]
  readonly evals: readonly unknown[]
  readonly hasPublishedSkill: boolean
}
