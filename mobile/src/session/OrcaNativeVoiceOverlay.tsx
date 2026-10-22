import { useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import { Volume2, VolumeX } from 'lucide-react-native'
import { encodeNativeChatTranscriptIdentity } from '../../../src/shared/native-chat-transcript-retention'
import { isNativeChatSupportedAgent } from '../../../src/shared/native-chat-agent-support'
import { useHostClient } from '../transport/host-client-hooks'
import { colors } from '../theme/mobile-theme'
import type { SessionTabsResult, MobileSessionTab } from './mobile-session-route-types'
import { sessionTabsListRead, sessionTerminalListRead } from './mobile-session-read-operations'
import { resolveMobileNativeChat } from './mobile-native-chat-eligibility'
import { resolveMobileTerminalTabAgentId } from './mobile-terminal-tab-agent'
import { useMobileNativeChatSession } from './use-mobile-native-chat-session'
import { useOrcaTabTranscriptFallback } from './use-orca-tab-transcript-fallback'
import { useOrcaTabVoice } from './use-orca-tab-voice'

type ActiveTab = {
  tab: MobileSessionTab
  hostAgentIdentity: string | null
}

function readSessionTabs(value: unknown): SessionTabsResult | null {
  if (!value || typeof value !== 'object' || !('tabs' in value) || !Array.isArray(value.tabs)) {
    return null
  }
  if (
    !('activeTabId' in value) ||
    (value.activeTabId !== null && typeof value.activeTabId !== 'string')
  ) {
    return null
  }
  // The host owns the tab rows. The active id and array have been checked before selecting one.
  return value as SessionTabsResult
}

export function OrcaNativeVoiceOverlay({
  hostId,
  worktreeId,
  activeTabFrame
}: {
  hostId: string
  worktreeId: string
  activeTabFrame: { x: number; y: number; width: number; height: number } | null
}) {
  const { client, state } = useHostClient(hostId)
  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null)

  useEffect(() => {
    if (!client || state !== 'connected') {
      setActiveTab(null)
      return
    }
    let cancelled = false
    let busy = false
    const refresh = async () => {
      if (busy || cancelled) return
      busy = true
      try {
        const [tabReply, terminalReply] = await Promise.all([
          sessionTabsListRead.request(client, { worktree: `id:${worktreeId}` }),
          sessionTerminalListRead.request(client, {
            worktree: `id:${worktreeId}`,
            includeVisualLayouts: false
          })
        ])
        if (cancelled) return
        const snapshot = readSessionTabs(sessionTabsListRead.interpret(tabReply))
        const terminals = sessionTerminalListRead.interpret(terminalReply)
        if (!snapshot) return
        const tab =
          snapshot.tabs.find((item) => item.id === snapshot.activeTabId) ??
          snapshot.tabs.find((item) => item.isActive)
        if (!tab || tab.type !== 'terminal') {
          setActiveTab(null)
          return
        }
        const rows = terminals.accepted ? terminals.value.terminals : []
        const row = rows.find((item) => item.handle === tab.terminal)
        const identity = row && 'agentIdentity' in row ? row.agentIdentity : null
        setActiveTab({
          tab,
          hostAgentIdentity: typeof identity === 'string' ? identity : null
        })
      } catch {
        if (!cancelled) setActiveTab(null)
      } finally {
        busy = false
      }
    }
    void refresh()
    const timer = setInterval(() => void refresh(), 1500)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [client, state, worktreeId])

  const tab = activeTab?.tab ?? null
  const topLevelTabId = tab?.id.split('::')[0] ?? ''
  const terminal = tab?.type === 'terminal' ? tab : null
  const agent = terminal
    ? resolveMobileTerminalTabAgentId(terminal, activeTab?.hostAgentIdentity)
    : null
  const fallback = useOrcaTabTranscriptFallback({
    client,
    connected: state === 'connected',
    worktreeId,
    tab,
    terminals:
      terminal?.terminal && activeTab?.hostAgentIdentity
        ? [{ handle: terminal.terminal, agentIdentity: activeTab.hostAgentIdentity }]
        : []
  })
  const reported = resolveMobileNativeChat(terminal)
  const resolved = reported?.sessionId ? reported : fallback
  const session = useMobileNativeChatSession({
    client: state === 'connected' ? client : null,
    sourceIdentity: useMemo(
      () => encodeNativeChatTranscriptIdentity([hostId, worktreeId]),
      [hostId, worktreeId]
    ),
    agent: resolved?.agent ?? null,
    sessionId: resolved?.sessionId ?? null,
    transcriptPath: resolved?.transcriptPath ?? null
  })
  const voice = useOrcaTabVoice({
    scopeKey: `${hostId}\0${worktreeId}\0${topLevelTabId}`,
    active: Boolean(tab && resolved?.sessionId),
    ready: session.status === 'ready',
    working:
      terminal?.agentStatus?.state === 'working' ||
      session.messages.some((m) => m.state === 'running'),
    messages: session.messages
  })

  if (
    Platform.OS !== 'ios' ||
    !terminal ||
    !agent ||
    !isNativeChatSupportedAgent(agent) ||
    !resolved?.sessionId ||
    !activeTabFrame ||
    ![activeTabFrame.x, activeTabFrame.y, activeTabFrame.width, activeTabFrame.height].every(
      Number.isFinite
    ) ||
    activeTabFrame.width < 36 ||
    activeTabFrame.height < 36
  ) {
    return null
  }
  const Icon = voice.enabled ? Volume2 : VolumeX
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        style={[
          styles.button,
          {
            left: activeTabFrame.x + activeTabFrame.width - 38,
            top: activeTabFrame.y + (activeTabFrame.height - 36) / 2
          }
        ]}
        onPress={voice.toggle}
        accessibilityRole="button"
        accessibilityLabel={voice.enabled ? 'このタブの音声をオフ' : 'このタブの音声をオン'}
      >
        <Icon size={20} color={colors.textPrimary} strokeWidth={2} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: colors.bgRaised
  }
})
