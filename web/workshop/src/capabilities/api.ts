import type {
  CapabilityDetail,
  CapabilitySummary,
  CapabilityVersionDetail,
  CapabilityVersionSnapshot,
  CriterionSnapshot,
  EvalSnapshot,
  SkillVersionDetail,
  SkillVersionSnapshot,
  SkillVersionSummary,
  VersionSummary,
} from './types'

export class CapabilityApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CapabilityApiError'
  }
}

export const listCapabilities = async (): Promise<readonly CapabilitySummary[]> => {
  const response = await fetch('/list-capabilities', {
    method: 'QUERY',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: '{}',
  })
  if (!response.ok) {
    throw new CapabilityApiError(`Skills returned ${response.status}`)
  }
  return parseCapabilityList(await response.json())
}

export const getCapability = async (id: string): Promise<CapabilityDetail> => {
  const response = await fetch(`/get-capability/${id}`, {
    method: 'QUERY',
    headers: {
      accept: 'application/json',
    },
    body: '{}',
  })
  if (!response.ok) {
    throw new CapabilityApiError(`Skills returned ${response.status}`)
  }
  return parseCapabilityDetail(await response.json())
}

export const createCapability = async (input: {
  readonly id: string
  readonly name: string
  readonly ask: string
}): Promise<void> => {
  await postEmpty('/create-capability', input)
}

export const amendCapabilityAsk = async (input: {
  readonly id: string
  readonly ask: string
}): Promise<void> => {
  await postEmpty('/amend-capability-ask', input)
}

export const renameCapability = async (input: {
  readonly id: string
  readonly name: string
}): Promise<void> => {
  await postEmpty('/rename-capability', input)
}

export const saveDerivedSkill = async (input: {
  readonly id: string
  readonly markdown: string
}): Promise<void> => {
  await postEmpty('/save-derived-skill', input)
}

export const restoreCapabilityVersion = async (input: {
  readonly id: string
  readonly versionId: string
}): Promise<void> => {
  await postEmpty('/restore-capability-version', input)
}

export const restoreSkillVersion = async (input: {
  readonly id: string
  readonly versionId: string
}): Promise<void> => {
  await postEmpty('/restore-skill-version', input)
}

export const listCapabilityVersions = async (
  id: string,
): Promise<readonly VersionSummary[]> => {
  const response = await queryJson(`/list-capability-versions/${id}`)
  return parseVersionList(response)
}

export const getCapabilityVersion = async (
  id: string,
  versionId: string,
): Promise<CapabilityVersionDetail> => {
  const response = await queryJson(`/get-capability-version/${id}/${versionId}`)
  return parseCapabilityVersionDetail(response)
}

export const compareCapabilityVersions = async (
  id: string,
  leftVersionId: string,
  rightVersionId: string,
): Promise<{ readonly left: CapabilityVersionDetail; readonly right: CapabilityVersionDetail }> => {
  const response = await queryJson(
    `/compare-capability-versions/${id}/${leftVersionId}/${rightVersionId}`,
  )
  return parseCapabilityCompare(response)
}

export const listSkillVersions = async (id: string): Promise<readonly SkillVersionSummary[]> => {
  const response = await queryJson(`/list-skill-versions/${id}`)
  return parseSkillVersionList(response)
}

export const getSkillVersion = async (
  id: string,
  versionId: string,
): Promise<SkillVersionDetail> => {
  const response = await queryJson(`/get-skill-version/${id}/${versionId}`)
  return parseSkillVersionDetail(response)
}

export const compareSkillVersions = async (
  id: string,
  leftVersionId: string,
  rightVersionId: string,
): Promise<{ readonly left: SkillVersionDetail; readonly right: SkillVersionDetail }> => {
  const response = await queryJson(
    `/compare-skill-versions/${id}/${leftVersionId}/${rightVersionId}`,
  )
  return parseSkillCompare(response)
}

const queryJson = async (path: string): Promise<unknown> => {
  const response = await fetch(path, {
    method: 'QUERY',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: '{}',
  })
  if (!response.ok) {
    throw new CapabilityApiError(`Skills returned ${response.status}`)
  }
  return response.json()
}

const postEmpty = async (path: string, body: unknown): Promise<void> => {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new CapabilityApiError(`Skills returned ${response.status}`)
  }
}

const parseCapabilityList = (value: unknown): readonly CapabilitySummary[] => {
  if (!isRecord(value) || !Array.isArray(value['items'])) {
    throw new CapabilityApiError('Capability list response was invalid')
  }
  return value['items'].map(parseCapabilitySummary)
}

const parseCapabilitySummary = (value: unknown): CapabilitySummary => {
  if (!isRecord(value)) {
    throw new CapabilityApiError('Capability list response was invalid')
  }
  const id = value['id']
  const name = value['name']
  const hasPublishedSkill = value['hasPublishedSkill']
  if (typeof id !== 'string' || typeof name !== 'string' || typeof hasPublishedSkill !== 'boolean') {
    throw new CapabilityApiError('Capability list response was invalid')
  }
  return { id, name, hasPublishedSkill }
}

const parseCapabilityDetail = (value: unknown): CapabilityDetail => {
  if (!isRecord(value)) {
    throw new CapabilityApiError('Capability detail response was invalid')
  }
  const id = value['id']
  const name = value['name']
  const ask = value['ask']
  const hasPublishedSkill = value['hasPublishedSkill']
  const criteria = value['criteria']
  const evals = value['evals']
  const skillMarkdown = value['skillMarkdown']
  const hasUnsavedCapabilityDraft = value['hasUnsavedCapabilityDraft']
  const hasUnsavedSkillDraft = value['hasUnsavedSkillDraft']
  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof ask !== 'string' ||
    typeof hasPublishedSkill !== 'boolean' ||
    !Array.isArray(criteria) ||
    !Array.isArray(evals) ||
    typeof skillMarkdown !== 'string' ||
    typeof hasUnsavedCapabilityDraft !== 'boolean' ||
    typeof hasUnsavedSkillDraft !== 'boolean'
  ) {
    throw new CapabilityApiError('Capability detail response was invalid')
  }
  return {
    id,
    name,
    ask,
    criteria: criteria.map(parseCriterionSnapshot),
    evals: evals.map(parseEvalSnapshot),
    hasPublishedSkill,
    skillMarkdown,
    currentCapabilityVersionId: optionalGuid(value['currentCapabilityVersionId']),
    currentSkillVersionId: optionalGuid(value['currentSkillVersionId']),
    derivedAgainstCapabilityVersionId: optionalGuid(value['derivedAgainstCapabilityVersionId']),
    hasUnsavedCapabilityDraft,
    hasUnsavedSkillDraft,
  }
}

const parseVersionList = (value: unknown): readonly VersionSummary[] => {
  if (!isRecord(value) || !Array.isArray(value['items'])) {
    throw new CapabilityApiError('Version list response was invalid')
  }
  return value['items'].map(parseVersionSummary)
}

const parseSkillVersionList = (value: unknown): readonly SkillVersionSummary[] => {
  if (!isRecord(value) || !Array.isArray(value['items'])) {
    throw new CapabilityApiError('Skill version list response was invalid')
  }
  return value['items'].map(parseSkillVersionSummary)
}

const parseVersionSummary = (value: unknown): VersionSummary => {
  if (!isRecord(value)) {
    throw new CapabilityApiError('Version list response was invalid')
  }
  const versionId = value['versionId']
  const recordedAt = value['recordedAt']
  if (typeof versionId !== 'string' || typeof recordedAt !== 'string') {
    throw new CapabilityApiError('Version list response was invalid')
  }
  return { versionId, recordedAt }
}

const parseSkillVersionSummary = (value: unknown): SkillVersionSummary => {
  const base = parseVersionSummary(value)
  if (!isRecord(value)) {
    throw new CapabilityApiError('Skill version list response was invalid')
  }
  const derivedAgainstCapabilityVersionId = value['derivedAgainstCapabilityVersionId']
  if (typeof derivedAgainstCapabilityVersionId !== 'string') {
    throw new CapabilityApiError('Skill version list response was invalid')
  }
  return { ...base, derivedAgainstCapabilityVersionId }
}

const parseCapabilityVersionDetail = (value: unknown): CapabilityVersionDetail => {
  if (!isRecord(value)) {
    throw new CapabilityApiError('Capability version response was invalid')
  }
  const versionId = value['versionId']
  const capabilityId = value['capabilityId']
  const recordedAt = value['recordedAt']
  if (
    typeof versionId !== 'string' ||
    typeof capabilityId !== 'string' ||
    typeof recordedAt !== 'string'
  ) {
    throw new CapabilityApiError('Capability version response was invalid')
  }
  return {
    versionId,
    capabilityId,
    recordedAt,
    snapshot: parseCapabilityVersionSnapshot(value['snapshot']),
  }
}

const parseSkillVersionDetail = (value: unknown): SkillVersionDetail => {
  if (!isRecord(value)) {
    throw new CapabilityApiError('Skill version response was invalid')
  }
  const versionId = value['versionId']
  const capabilityId = value['capabilityId']
  const recordedAt = value['recordedAt']
  if (
    typeof versionId !== 'string' ||
    typeof capabilityId !== 'string' ||
    typeof recordedAt !== 'string'
  ) {
    throw new CapabilityApiError('Skill version response was invalid')
  }
  return {
    versionId,
    capabilityId,
    recordedAt,
    snapshot: parseSkillVersionSnapshot(value['snapshot']),
  }
}

const parseCapabilityCompare = (
  value: unknown,
): { readonly left: CapabilityVersionDetail; readonly right: CapabilityVersionDetail } => {
  if (!isRecord(value)) {
    throw new CapabilityApiError('Capability compare response was invalid')
  }
  return {
    left: parseCapabilityVersionDetail(value['left']),
    right: parseCapabilityVersionDetail(value['right']),
  }
}

const parseSkillCompare = (
  value: unknown,
): { readonly left: SkillVersionDetail; readonly right: SkillVersionDetail } => {
  if (!isRecord(value)) {
    throw new CapabilityApiError('Skill compare response was invalid')
  }
  return {
    left: parseSkillVersionDetail(value['left']),
    right: parseSkillVersionDetail(value['right']),
  }
}

const parseCapabilityVersionSnapshot = (value: unknown): CapabilityVersionSnapshot => {
  if (!isRecord(value) || typeof value['ask'] !== 'string' || !Array.isArray(value['criteria']) || !Array.isArray(value['evals'])) {
    throw new CapabilityApiError('Capability version snapshot was invalid')
  }
  return {
    ask: value['ask'],
    criteria: value['criteria'].map(parseCriterionSnapshot),
    evals: value['evals'].map(parseEvalSnapshot),
  }
}

const parseSkillVersionSnapshot = (value: unknown): SkillVersionSnapshot => {
  if (
    !isRecord(value) ||
    typeof value['markdown'] !== 'string' ||
    typeof value['derivedAgainstCapabilityVersionId'] !== 'string'
  ) {
    throw new CapabilityApiError('Skill version snapshot was invalid')
  }
  return {
    markdown: value['markdown'],
    derivedAgainstCapabilityVersionId: value['derivedAgainstCapabilityVersionId'],
  }
}

const parseCriterionSnapshot = (value: unknown): CriterionSnapshot => {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['statement'] !== 'string') {
    throw new CapabilityApiError('Criterion snapshot was invalid')
  }
  return { id: value['id'], statement: value['statement'] }
}

const parseEvalSnapshot = (value: unknown): EvalSnapshot => {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    typeof value['criterionId'] !== 'string' ||
    typeof value['scenario'] !== 'string'
  ) {
    throw new CapabilityApiError('Eval snapshot was invalid')
  }
  return {
    id: value['id'],
    criterionId: value['criterionId'],
    scenario: value['scenario'],
  }
}

const optionalGuid = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value !== 'string') {
    throw new CapabilityApiError('Expected a guid or null')
  }
  return value
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
