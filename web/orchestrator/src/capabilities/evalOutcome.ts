import type { EvalLatestOutcome, EvalOutcomeStatus } from './types'

export const neverRunOutcome = (): EvalLatestOutcome => ({
  status: 'never_run',
  caseRunId: null,
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
    case 'never_completed':
      return 'Never completed'
  }
}

export const formatSuiteSummary = (summary: {
  readonly passed: number
  readonly failed: number
  readonly unsettled: number
  readonly neverCompleted: number
  readonly neverRun: number
}): string => {
  const parts: string[] = []
  if (summary.passed > 0) {
    parts.push(`${summary.passed} passed`)
  }
  if (summary.failed > 0) {
    parts.push(`${summary.failed} failed`)
  }
  if (summary.unsettled > 0) {
    parts.push(`${summary.unsettled} unsettled`)
  }
  if (summary.neverCompleted > 0) {
    parts.push(`${summary.neverCompleted} never completed`)
  }
  if (summary.neverRun > 0) {
    parts.push(`${summary.neverRun} never run`)
  }
  return parts.length === 0 ? 'No evals' : parts.join(' · ')
}

export const formatCriterionRollup = (rollup: {
  readonly passed: number
  readonly failed: number
  readonly unsettled: number
  readonly neverCompleted: number
  readonly neverRun: number
}): string => formatSuiteSummary(rollup)

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
