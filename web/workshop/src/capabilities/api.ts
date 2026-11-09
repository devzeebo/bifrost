import type {
  ApplyProposalResult,
  CapabilityChat,
  CapabilityDetail,
  CapabilityEvalOutcomes,
  CapabilitySummary,
  CapabilityVersionDetail,
  CapabilityVersionSnapshot,
  ChatMessage,
  CheckSnapshot,
  CriterionEvalRollup,
  CriterionSnapshot,
  EvalCaseRun,
  EvalCheckVerdict,
  EvalLatestOutcome,
  EvalOutcomeStatus,
  EvalSnapshot,
  EvalSpend,
  EvalSuiteRunResult,
  Proposal,
  ProposalEffect,
  RereadProposalResult,
  SkillVersionDetail,
  SkillVersionSnapshot,
  SkillVersionSummary,
  SuiteEvalSummary,
  TranscriptLine,
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
    throw new CapabilityApiError(await readErrorDetail(response))
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
    throw new CapabilityApiError(await readErrorDetail(response))
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

export const amendCapabilityEval = async (input: {
  readonly id: string
  readonly evalId: string
  readonly scenario: string
  readonly prompt: string
  readonly context: string
  readonly checks?: readonly CheckSnapshot[] | null
}): Promise<void> => {
  await postEmpty('/amend-capability-eval', input)
}

export const duplicateCapabilityEval = async (input: {
  readonly id: string
  readonly sourceEvalId: string
  readonly newEvalId: string
}): Promise<void> => {
  await postEmpty('/duplicate-capability-eval', input)
}

export const retireCapabilityEval = async (input: {
  readonly id: string
  readonly evalId: string
}): Promise<{
  readonly leftCriterionUncovered: boolean
  readonly uncoveredCriterionId: string | null
  readonly note: string | null
}> => {
  const response = await postJson('/retire-capability-eval', input)
  return parseRetireEvalResult(response)
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

export const getCapabilityChat = async (id: string): Promise<CapabilityChat> => {
  const response = await queryJson(`/get-capability-chat/${id}`)
  return parseCapabilityChat(response)
}

export const postCapabilityChatMessage = async (input: {
  readonly id: string
  readonly message: string
}): Promise<{
  readonly assistantMessage: ChatMessage
  readonly proposal: Proposal | null
  readonly messages: readonly ChatMessage[]
  readonly pendingProposals: readonly Proposal[]
}> => {
  const response = await postJson('/post-capability-chat-message', input)
  return parsePostChatResponse(response)
}

export const applyCapabilityProposal = async (input: {
  readonly id: string
  readonly proposalId: string
}): Promise<ApplyProposalResult> => {
  const response = await postJson('/apply-capability-proposal', input)
  return parseApplyResult(response)
}

export const dismissCapabilityProposal = async (input: {
  readonly id: string
  readonly proposalId: string
}): Promise<CapabilityChat> => {
  const response = await postJson('/dismiss-capability-proposal', input)
  if (!isRecord(response)) {
    throw new CapabilityApiError('Dismiss response was invalid')
  }
  return {
    capabilityId: input.id,
    messages: parseMessages(response['messages']),
    pendingProposals: parseProposals(response['pendingProposals']),
  }
}

export const rereadCapabilityProposal = async (input: {
  readonly id: string
  readonly proposalId: string
}): Promise<RereadProposalResult> => {
  const response = await postJson('/reread-capability-proposal', input)
  return parseRereadResult(response)
}

export const runCapabilityEval = async (input: {
  readonly id: string
  readonly evalId: string
  readonly skillVersionId?: string | null
}): Promise<EvalCaseRun> => {
  const response = await postJson('/run-capability-eval', {
    id: input.id,
    evalId: input.evalId,
    skillVersionId: input.skillVersionId ?? null,
  })
  if (!isRecord(response)) {
    throw new CapabilityApiError('Run eval response was invalid')
  }
  return parseEvalCaseRun(response['run'])
}

export const runCapabilitySuite = async (input: {
  readonly id: string
  readonly skillVersionId?: string | null
  readonly evalIds?: readonly string[] | null
}): Promise<EvalSuiteRunResult> => {
  const response = await postJson('/run-capability-suite', {
    id: input.id,
    skillVersionId: input.skillVersionId ?? null,
    evalIds: input.evalIds ?? null,
  })
  return parseEvalSuiteRunResult(response)
}

export const cancelEvalSuiteRun = async (suiteRunId: string): Promise<{
  readonly suiteRunId: string
  readonly status: string
  readonly cancelRequested: boolean
}> => {
  const response = await postJson('/cancel-eval-suite-run', { suiteRunId })
  if (!isRecord(response)) {
    throw new CapabilityApiError('Cancel suite response was invalid')
  }
  const id = response['suiteRunId']
  const status = response['status']
  const cancelRequested = response['cancelRequested']
  if (typeof id !== 'string' || typeof status !== 'string' || typeof cancelRequested !== 'boolean') {
    throw new CapabilityApiError('Cancel suite response was invalid')
  }
  return { suiteRunId: id, status, cancelRequested }
}

export const getEvalCaseRun = async (id: string): Promise<EvalCaseRun> => {
  const response = await queryJson(`/get-eval-case-run/${id}`)
  if (!isRecord(response)) {
    throw new CapabilityApiError('Eval case run response was invalid')
  }
  return parseEvalCaseRun(response['run'])
}

export const getEvalSuiteRun = async (id: string): Promise<EvalSuiteRunResult & {
  readonly capabilityId: string
  readonly skillVersionId: string | null
  readonly cancelRequested: boolean
  readonly startedAt: string
  readonly completedAt: string | null
}> => {
  const response = await queryJson(`/get-eval-suite-run/${id}`)
  if (!isRecord(response)) {
    throw new CapabilityApiError('Eval suite run response was invalid')
  }
  const parsed = parseEvalSuiteRunResult(response)
  return {
    ...parsed,
    capabilityId: requireString(response['capabilityId'], 'capabilityId'),
    skillVersionId: optionalGuid(response['skillVersionId']),
    cancelRequested: requireBoolean(response['cancelRequested'], 'cancelRequested'),
    startedAt: requireString(response['startedAt'], 'startedAt'),
    completedAt: optionalString(response['completedAt']),
  }
}

export const listEvalCaseRuns = async (
  capabilityId: string,
  evalId: string,
): Promise<readonly EvalCaseRun[]> => {
  const response = await queryJson(`/list-eval-case-runs/${capabilityId}/${evalId}`)
  if (!isRecord(response) || !Array.isArray(response['items'])) {
    throw new CapabilityApiError('Eval case run list was invalid')
  }
  return response['items'].map(parseEvalCaseRun)
}

export const getCapabilityEvalOutcomes = async (
  id: string,
): Promise<CapabilityEvalOutcomes> => {
  const response = await queryJson(`/get-capability-eval-outcomes/${id}`)
  return parseCapabilityEvalOutcomes(response)
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
    throw new CapabilityApiError(await readErrorDetail(response))
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
    throw new CapabilityApiError(await readErrorDetail(response))
  }
}

const postJson = async (path: string, body: unknown): Promise<unknown> => {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new CapabilityApiError(await readErrorDetail(response))
  }
  if (response.status === 204) {
    return null
  }
  return response.json()
}

const readErrorDetail = async (response: Response): Promise<string> => {
  try {
    const body: unknown = await response.json()
    if (isRecord(body) && typeof body['detail'] === 'string' && body['detail'].trim() !== '') {
      return body['detail']
    }
  } catch {
    // Fall through to status text when the body is not ProblemDetails JSON.
  }
  return `Skills returned ${response.status}`
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

const parseCheckKind = (value: unknown): CheckSnapshot['kind'] => {
  if (value === 'HumanReview') {
    return 'HumanReview'
  }
  return 'Script'
}

const parseCheckSnapshot = (value: unknown): CheckSnapshot => {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['statement'] !== 'string') {
    throw new CapabilityApiError('Check snapshot was invalid')
  }
  const script = value['script']
  return {
    id: value['id'],
    statement: value['statement'],
    kind: parseCheckKind(value['kind']),
    script: typeof script === 'string' ? script : null,
  }
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
  const prompt = value['prompt']
  const context = value['context']
  const checks = value['checks']
  return {
    id: value['id'],
    criterionId: value['criterionId'],
    scenario: value['scenario'],
    prompt: typeof prompt === 'string' ? prompt : '',
    context: typeof context === 'string' ? context : '',
    checks: Array.isArray(checks) ? checks.map(parseCheckSnapshot) : [],
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

const parseCapabilityChat = (value: unknown): CapabilityChat => {
  if (!isRecord(value) || typeof value['capabilityId'] !== 'string') {
    throw new CapabilityApiError('Capability chat response was invalid')
  }
  return {
    capabilityId: value['capabilityId'],
    messages: parseMessages(value['messages']),
    pendingProposals: parseProposals(value['pendingProposals']),
  }
}

const parsePostChatResponse = (
  value: unknown,
): {
  readonly assistantMessage: ChatMessage
  readonly proposal: Proposal | null
  readonly messages: readonly ChatMessage[]
  readonly pendingProposals: readonly Proposal[]
} => {
  if (!isRecord(value)) {
    throw new CapabilityApiError('Chat message response was invalid')
  }
  return {
    assistantMessage: parseChatMessage(value['assistantMessage']),
    proposal: value['proposal'] == null ? null : parseProposal(value['proposal']),
    messages: parseMessages(value['messages']),
    pendingProposals: parseProposals(value['pendingProposals']),
  }
}

const parseApplyResult = (value: unknown): ApplyProposalResult => {
  if (!isRecord(value) || typeof value['outcome'] !== 'string') {
    throw new CapabilityApiError('Apply proposal response was invalid')
  }
  const outcome = value['outcome']
  if (outcome !== 'Applied' && outcome !== 'Reoffered' && outcome !== 'Withdrawn') {
    throw new CapabilityApiError('Apply proposal response was invalid')
  }
  return {
    outcome,
    note: optionalString(value['note']),
    proposal: value['proposal'] == null ? null : parseProposal(value['proposal']),
    messages: parseMessages(value['messages']),
    pendingProposals: parseProposals(value['pendingProposals']),
  }
}

const parseRereadResult = (value: unknown): RereadProposalResult => {
  if (!isRecord(value) || typeof value['outcome'] !== 'string') {
    throw new CapabilityApiError('Reread proposal response was invalid')
  }
  const outcome = value['outcome']
  if (outcome !== 'Reoffered' && outcome !== 'Withdrawn') {
    throw new CapabilityApiError('Reread proposal response was invalid')
  }
  return {
    outcome,
    note: optionalString(value['note']),
    proposal: value['proposal'] == null ? null : parseProposal(value['proposal']),
    messages: parseMessages(value['messages']),
    pendingProposals: parseProposals(value['pendingProposals']),
  }
}

const parseMessages = (value: unknown): readonly ChatMessage[] => {
  if (!Array.isArray(value)) {
    throw new CapabilityApiError('Chat messages were invalid')
  }
  return value.map(parseChatMessage)
}

const parseProposals = (value: unknown): readonly Proposal[] => {
  if (!Array.isArray(value)) {
    throw new CapabilityApiError('Proposals were invalid')
  }
  return value.map(parseProposal)
}

const parseChatMessage = (value: unknown): ChatMessage => {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    typeof value['at'] !== 'string' ||
    typeof value['role'] !== 'string' ||
    typeof value['text'] !== 'string'
  ) {
    throw new CapabilityApiError('Chat message was invalid')
  }
  return {
    id: value['id'],
    at: value['at'],
    role: value['role'],
    text: value['text'],
    proposalId: optionalGuid(value['proposalId']),
  }
}

const parseProposal = (value: unknown): Proposal => {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    typeof value['createdAt'] !== 'string' ||
    typeof value['summary'] !== 'string' ||
    typeof value['expectedSkillMarkdown'] !== 'string' ||
    !Array.isArray(value['effects']) ||
    typeof value['isStale'] !== 'boolean'
  ) {
    throw new CapabilityApiError('Proposal was invalid')
  }
  return {
    id: value['id'],
    createdAt: value['createdAt'],
    summary: value['summary'],
    expectedCapabilityVersionId: optionalGuid(value['expectedCapabilityVersionId']),
    expectedCapabilitySnapshot:
      value['expectedCapabilitySnapshot'] == null
        ? null
        : parseCapabilityVersionSnapshot(value['expectedCapabilitySnapshot']),
    expectedSkillMarkdown: value['expectedSkillMarkdown'],
    effects: value['effects'].map(parseProposalEffect),
    isStale: value['isStale'],
    staleNote: optionalString(value['staleNote']),
  }
}

const parseProposalEffect = (value: unknown): ProposalEffect => {
  if (!isRecord(value) || typeof value['kind'] !== 'string') {
    throw new CapabilityApiError('Proposal effect was invalid')
  }
  return {
    kind: value['kind'],
    description: optionalString(value['description']),
    ask: optionalString(value['ask']),
    criterionId: optionalGuid(value['criterionId']),
    statement: optionalString(value['statement']),
    newCriteria: value['newCriteria'] == null ? null : parseCriterionList(value['newCriteria']),
    evalId: optionalGuid(value['evalId']),
    sourceEvalId: optionalGuid(value['sourceEvalId']),
    scenario: optionalString(value['scenario']),
    prompt: optionalString(value['prompt']),
    context: optionalString(value['context']),
    checks: value['checks'] == null ? null : parseCheckList(value['checks']),
    markdown: optionalString(value['markdown']),
    servedCriterionIds:
      value['servedCriterionIds'] == null
        ? null
        : parseGuidList(value['servedCriterionIds']),
  }
}

const parseCheckList = (value: unknown): readonly CheckSnapshot[] => {
  if (!Array.isArray(value)) {
    throw new CapabilityApiError('Check list was invalid')
  }
  return value.map(parseCheckSnapshot)
}

const parseRetireEvalResult = (
  value: unknown,
): {
  readonly leftCriterionUncovered: boolean
  readonly uncoveredCriterionId: string | null
  readonly note: string | null
} => {
  if (!isRecord(value) || typeof value['leftCriterionUncovered'] !== 'boolean') {
    throw new CapabilityApiError('Retire eval response was invalid')
  }
  return {
    leftCriterionUncovered: value['leftCriterionUncovered'],
    uncoveredCriterionId: optionalGuid(value['uncoveredCriterionId']),
    note: optionalString(value['note']),
  }
}

const parseCriterionList = (value: unknown): readonly CriterionSnapshot[] => {
  if (!Array.isArray(value)) {
    throw new CapabilityApiError('Criterion list was invalid')
  }
  return value.map(parseCriterionSnapshot)
}

const parseGuidList = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) {
    throw new CapabilityApiError('Guid list was invalid')
  }
  return value.map((item) => {
    if (typeof item !== 'string') {
      throw new CapabilityApiError('Guid list was invalid')
    }
    return item
  })
}

const optionalString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value !== 'string') {
    throw new CapabilityApiError('Expected a string or null')
  }
  return value
}

const requireString = (value: unknown, field: string): string => {
  if (typeof value !== 'string') {
    throw new CapabilityApiError(`Expected string for ${field}`)
  }
  return value
}

const requireBoolean = (value: unknown, field: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new CapabilityApiError(`Expected boolean for ${field}`)
  }
  return value
}

const requireNumber = (value: unknown, field: string): number => {
  if (typeof value !== 'number') {
    throw new CapabilityApiError(`Expected number for ${field}`)
  }
  return value
}

const parseEvalOutcomeStatus = (value: unknown): EvalOutcomeStatus => {
  if (
    value === 'passed'
    || value === 'failed'
    || value === 'unsettled'
    || value === 'never_run'
    || value === 'never_completed'
  ) {
    return value
  }
  throw new CapabilityApiError('Eval outcome status was invalid')
}

const parseSuiteEvalSummary = (value: unknown): SuiteEvalSummary => {
  if (!isRecord(value)) {
    throw new CapabilityApiError('Suite summary was invalid')
  }
  return {
    passed: requireNumber(value['passed'], 'passed'),
    failed: requireNumber(value['failed'], 'failed'),
    unsettled: requireNumber(value['unsettled'], 'unsettled'),
    neverCompleted: requireNumber(value['neverCompleted'], 'neverCompleted'),
    neverRun: requireNumber(value['neverRun'], 'neverRun'),
  }
}

const parseTranscriptLine = (value: unknown): TranscriptLine => {
  if (!isRecord(value)) {
    throw new CapabilityApiError('Transcript line was invalid')
  }
  return {
    role: requireString(value['role'], 'role'),
    text: requireString(value['text'], 'text'),
  }
}

const parseEvalSpend = (value: unknown): EvalSpend | null => {
  if (value === null || value === undefined) {
    return null
  }
  if (!isRecord(value)) {
    throw new CapabilityApiError('Eval spend was invalid')
  }
  const cost = value['cost']
  return {
    model: requireString(value['model'], 'model'),
    inputTokens: requireNumber(value['inputTokens'], 'inputTokens'),
    outputTokens: requireNumber(value['outputTokens'], 'outputTokens'),
    totalTokens: requireNumber(value['totalTokens'], 'totalTokens'),
    cost: cost === null || cost === undefined ? null : requireNumber(cost, 'cost'),
  }
}

const parseEvalCheckVerdict = (value: unknown): EvalCheckVerdict => {
  if (!isRecord(value)) {
    throw new CapabilityApiError('Check verdict was invalid')
  }
  return {
    checkId: requireString(value['checkId'], 'checkId'),
    statement: optionalString(value['statement']) ?? '',
    kind: requireString(value['kind'], 'kind'),
    status: requireString(value['status'], 'status'),
    reason: requireString(value['reason'], 'reason'),
  }
}

const parseEvalCaseRun = (value: unknown): EvalCaseRun => {
  if (!isRecord(value)) {
    throw new CapabilityApiError('Eval case run was invalid')
  }
  const transcript = value['transcript']
  const checks = value['checks']
  if (!Array.isArray(transcript) || !Array.isArray(checks)) {
    throw new CapabilityApiError('Eval case run was invalid')
  }
  return {
    id: requireString(value['id'], 'id'),
    capabilityId: requireString(value['capabilityId'], 'capabilityId'),
    evalId: requireString(value['evalId'], 'evalId'),
    criterionId: requireString(value['criterionId'], 'criterionId'),
    suiteRunId: optionalGuid(value['suiteRunId']),
    skillVersionId: optionalGuid(value['skillVersionId']),
    capabilityVersionId: optionalGuid(value['capabilityVersionId']),
    isEval: requireBoolean(value['isEval'], 'isEval'),
    status: requireString(value['status'], 'status'),
    outcome: optionalString(value['outcome']),
    failureReason: optionalString(value['failureReason']),
    transcript: transcript.map(parseTranscriptLine),
    spend: parseEvalSpend(value['spend']),
    checks: checks.map(parseEvalCheckVerdict),
    startedAt: requireString(value['startedAt'], 'startedAt'),
    completedAt: optionalString(value['completedAt']),
  }
}

const parseEvalSuiteRunResult = (value: unknown): EvalSuiteRunResult => {
  if (!isRecord(value)) {
    throw new CapabilityApiError('Eval suite run was invalid')
  }
  const cases = value['cases']
  if (!Array.isArray(cases)) {
    throw new CapabilityApiError('Eval suite run was invalid')
  }
  return {
    suiteRunId: requireString(value['suiteRunId'], 'suiteRunId'),
    status: requireString(value['status'], 'status'),
    summary: parseSuiteEvalSummary(value['summary']),
    cases: cases.map(parseEvalCaseRun),
  }
}

const parseCapabilityEvalOutcomes = (value: unknown): CapabilityEvalOutcomes => {
  if (!isRecord(value)) {
    throw new CapabilityApiError('Eval outcomes response was invalid')
  }
  const criteria = value['criteria']
  const evals = value['evals']
  if (!Array.isArray(criteria) || !Array.isArray(evals)) {
    throw new CapabilityApiError('Eval outcomes response was invalid')
  }
  return {
    capabilityId: requireString(value['capabilityId'], 'capabilityId'),
    activeSuiteRunId: optionalGuid(value['activeSuiteRunId']),
    suite: parseSuiteEvalSummary(value['suite']),
    criteria: criteria.map((item): CriterionEvalRollup => {
      if (!isRecord(item)) {
        throw new CapabilityApiError('Criterion rollup was invalid')
      }
      return {
        criterionId: requireString(item['criterionId'], 'criterionId'),
        passed: requireNumber(item['passed'], 'passed'),
        failed: requireNumber(item['failed'], 'failed'),
        unsettled: requireNumber(item['unsettled'], 'unsettled'),
        neverCompleted: requireNumber(item['neverCompleted'], 'neverCompleted'),
        neverRun: requireNumber(item['neverRun'], 'neverRun'),
      }
    }),
    evals: evals.map((item) => {
      if (!isRecord(item)) {
        throw new CapabilityApiError('Eval latest outcome was invalid')
      }
      const outcome: EvalLatestOutcome & {
        readonly evalId: string
        readonly criterionId: string
      } = {
        evalId: requireString(item['evalId'], 'evalId'),
        criterionId: requireString(item['criterionId'], 'criterionId'),
        status: parseEvalOutcomeStatus(item['status']),
        caseRunId: optionalGuid(item['caseRunId']),
        capabilityVersionId: optionalGuid(item['capabilityVersionId']),
        skillVersionId: optionalGuid(item['skillVersionId']),
      }
      return outcome
    }),
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
