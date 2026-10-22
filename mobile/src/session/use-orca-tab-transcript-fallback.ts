import { useEffect, useState } from 'react'
import { AiVaultSearchResponseSchema } from '../../../src/shared/ai-vault-search-contract'
import { isAiVaultAgent } from '../../../src/shared/ai-vault-types'
import { isNativeChatSupportedAgent } from '../../../src/shared/native-chat-agent-support'
import type { RpcClient } from '../transport/rpc-client'
import { bindDeferredRpcOperation, defineRpcOperation } from '../transport/rpc-operation'
import { rpcResultVariant } from '../transport/rpc-operation-result-reader'
import {
  getMobileSessionTabTitle,
  resolveMobileTerminalTabAgentId
} from './mobile-terminal-tab-agent'
import type { MobileSessionTab } from './mobile-session-route-types'

const searchTranscript = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'aiVault.voice-session-match',
    method: 'aiVault.searchSessions',
    acceptance: 'require-result-or-throw-message',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('voice-session-search', AiVaultSearchResponseSchema)
  })
)

export type OrcaTabTranscriptMatch = {
  tabId: string
  agent: string
  sessionId: string
  transcriptPath: string | null
}

export async function findOrcaTabTranscript(args: {
  client: RpcClient
  worktreeId: string
  tabId: string
  title: string
  agent: string
}): Promise<OrcaTabTranscriptMatch | null> {
  if (!isAiVaultAgent(args.agent)) return null
  const response = await searchTranscript.request(args.client, {
    query: args.title,
    scope: 'conversation',
    limit: 10,
    filters: { agents: [args.agent], sort: 'newest' },
    within: { kind: 'workspace', worktreeId: args.worktreeId }
  })
  const result = searchTranscript.interpret(response)
  if (result.kind !== 'results') return null
  const matches = result.hits.filter(
    (hit) =>
      hit.agent === args.agent &&
      hit.title.trim() === args.title &&
      hit.source.presence === 'present'
  )
  if (matches.length !== 1) return null
  const hit = matches[0]
  return {
    tabId: args.tabId,
    agent: args.agent,
    sessionId: hit.sessionId,
    transcriptPath: hit.source.filePath ?? null
  }
}

export function useOrcaTabTranscriptFallback(args: {
  client: RpcClient | null
  connected: boolean
  worktreeId: string
  tab: MobileSessionTab | null
  terminals: readonly { handle: string; agentIdentity?: string }[]
}): OrcaTabTranscriptMatch | null {
  const { client, connected, worktreeId, tab, terminals } = args
  const tabId = tab?.id ?? ''
  const terminalHandle = tab?.type === 'terminal' ? tab.terminal : null
  const hostAgent = terminalHandle
    ? terminals.find((terminal) => terminal.handle === terminalHandle)?.agentIdentity
    : null
  const agent = tab?.type === 'terminal' ? resolveMobileTerminalTabAgentId(tab, hostAgent) : null
  const title = tab ? getMobileSessionTabTitle(tab, hostAgent).split('|')[0].trim() : ''
  const providerSessionId = tab?.type === 'terminal' ? tab.agentStatus?.providerSession?.id : null
  const [match, setMatch] = useState<OrcaTabTranscriptMatch | null>(null)

  useEffect(() => {
    let cancelled = false
    setMatch(null)
    if (
      !client ||
      !connected ||
      !terminalHandle ||
      providerSessionId ||
      !agent ||
      !isNativeChatSupportedAgent(agent) ||
      title.length < 5
    ) {
      return
    }
    void findOrcaTabTranscript({ client, worktreeId, tabId, title, agent })
      .then((found) => {
        if (!cancelled) setMatch(found)
      })
      .catch(() => {
        if (!cancelled) setMatch(null)
      })
    return () => {
      cancelled = true
    }
  }, [agent, client, connected, providerSessionId, tabId, terminalHandle, title, worktreeId])

  return match?.tabId === tabId ? match : null
}
