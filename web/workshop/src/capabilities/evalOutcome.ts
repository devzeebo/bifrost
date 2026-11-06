import type { EvalLatestOutcome, EvalOutcomeStatus } from './types'

export const neverRunOutcome = (): EvalLatestOutcome => ({
  status: 'never_run',
  capabilityVersionId: null,
  skillVersionId: null,
})

export const outcomeLabel = (status: EvalOutcomeStatus): string => {
  switch (status) {
    case 'passed':
      return 'Passed'
    case 'failed':
      return 'Failed'
    case 'unsettled':
      return 'Unsettled'
    case 'never_run':
      return 'Never run'
  }
}

export const outcomeEarnedUnderNote = (input: {
  readonly outcome: EvalLatestOutcome
  readonly currentCapabilityVersionId: string | null
  readonly currentSkillVersionId: string | null
}): string | null => {
  const { outcome, currentCapabilityVersionId, currentSkillVersionId } = input
  if (outcome.status === 'never_run') {
    return null
  }

  const capabilityDiffers =
    outcome.capabilityVersionId != null
    && currentCapabilityVersionId != null
    && outcome.capabilityVersionId !== currentCapabilityVersionId
  const skillDiffers =
    outcome.skillVersionId != null
    && currentSkillVersionId != null
    && outcome.skillVersionId !== currentSkillVersionId

  if (!capabilityDiffers && !skillDiffers) {
    return null
  }

  const parts: string[] = []
  if (capabilityDiffers && outcome.capabilityVersionId) {
    parts.push(`capability ${outcome.capabilityVersionId}`)
  }
  if (skillDiffers && outcome.skillVersionId) {
    parts.push(`skill ${outcome.skillVersionId}`)
  }
  return `Earned under ${parts.join(' / ')}`
}
