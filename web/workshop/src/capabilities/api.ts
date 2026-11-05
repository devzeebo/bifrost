import type { CapabilityDetail, CapabilitySummary } from './types'

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
      'content-type': 'application/json',
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

export const changeCapabilityAsk = async (input: {
  readonly id: string
  readonly ask: string
}): Promise<void> => {
  await postEmpty('/change-capability-ask', input)
}

export const renameCapability = async (input: {
  readonly id: string
  readonly name: string
}): Promise<void> => {
  await postEmpty('/rename-capability', input)
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
  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof ask !== 'string' ||
    typeof hasPublishedSkill !== 'boolean' ||
    !Array.isArray(criteria) ||
    !Array.isArray(evals)
  ) {
    throw new CapabilityApiError('Capability detail response was invalid')
  }
  return { id, name, ask, criteria, evals, hasPublishedSkill }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
