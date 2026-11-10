import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyCapabilityProposal,
  dismissCapabilityProposal,
  getCapabilityChat,
  postCapabilityChatMessage,
  rereadCapabilityProposal,
} from './api'
import type { CapabilityChat, ChatMessage, Proposal } from './types'

export type CapabilityChatState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      readonly messages: readonly ChatMessage[]
      readonly pendingProposals: readonly Proposal[]
    }
  | { readonly status: 'error'; readonly message: string }

export const useCapabilityChat = (capabilityId: string, onCapabilityChanged: () => Promise<void>) => {
  const [state, setState] = useState<CapabilityChatState>({ status: 'loading' })
  const [busy, setBusy] = useState(false)
  const loadGeneration = useRef(0)

  const applyChat = useCallback((chat: CapabilityChat) => {
    setState({
      status: 'ready',
      messages: chat.messages,
      pendingProposals: chat.pendingProposals,
    })
  }, [])

  const reload = useCallback(async () => {
    const generation = ++loadGeneration.current
    try {
      const chat = await getCapabilityChat(capabilityId)
      if (generation !== loadGeneration.current) {
        return
      }
      applyChat(chat)
    } catch (error) {
      if (generation !== loadGeneration.current) {
        return
      }
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load chat',
      })
    }
  }, [applyChat, capabilityId])

  useEffect(() => {
    setState({ status: 'loading' })
    void reload()
  }, [reload])

  const sendMessage = useCallback(
    async (message: string) => {
      setBusy(true)
      try {
        const result = await postCapabilityChatMessage({ id: capabilityId, message })
        setState({
          status: 'ready',
          messages: result.messages,
          pendingProposals: result.pendingProposals,
        })
      } finally {
        setBusy(false)
      }
    },
    [capabilityId],
  )

  const applyProposal = useCallback(
    async (proposalId: string) => {
      setBusy(true)
      try {
        const result = await applyCapabilityProposal({ id: capabilityId, proposalId })
        setState({
          status: 'ready',
          messages: result.messages,
          pendingProposals: result.pendingProposals,
        })
        if (result.outcome === 'Applied') {
          await onCapabilityChanged()
        }
      } finally {
        setBusy(false)
      }
    },
    [capabilityId, onCapabilityChanged],
  )

  const dismissProposal = useCallback(
    async (proposalId: string) => {
      setBusy(true)
      try {
        applyChat(await dismissCapabilityProposal({ id: capabilityId, proposalId }))
      } finally {
        setBusy(false)
      }
    },
    [applyChat, capabilityId],
  )

  const rereadProposal = useCallback(
    async (proposalId: string) => {
      setBusy(true)
      try {
        const result = await rereadCapabilityProposal({ id: capabilityId, proposalId })
        setState({
          status: 'ready',
          messages: result.messages,
          pendingProposals: result.pendingProposals,
        })
      } finally {
        setBusy(false)
      }
    },
    [capabilityId],
  )

  return {
    state,
    busy,
    reload,
    sendMessage,
    applyProposal,
    dismissProposal,
    rereadProposal,
  }
}
