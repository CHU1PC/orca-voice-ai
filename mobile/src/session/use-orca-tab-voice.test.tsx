import { createElement, useEffect } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import { useOrcaTabVoice } from './use-orca-tab-voice'

const { storage, enqueueSpeech, stopSpeech } = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  enqueueSpeech: vi.fn(),
  stopSpeech: vi.fn()
}))

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: () => ({ remove: () => {} })
  },
  Platform: { OS: 'ios' }
}))
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      storage.set(key, value)
    }
  }
}))
vi.mock('@orca/expo-two-way-audio', () => ({ enqueueSpeech, stopSpeech }))

function message(
  id: string,
  text: string,
  state: NativeChatMessage['state'] = 'completed'
): NativeChatMessage {
  return {
    id,
    role: 'assistant',
    blocks: [{ type: 'text', text }],
    timestamp: 1,
    source: 'transcript',
    state
  }
}

type Hook = ReturnType<typeof useOrcaTabVoice>
let current: Hook | null = null

function Harness(props: { scopeKey: string; working: boolean; messages: NativeChatMessage[] }) {
  const voice = useOrcaTabVoice({ ...props, active: true, ready: true })
  useEffect(() => {
    current = voice
  }, [voice])
  return null
}

describe('useOrcaTabVoice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    storage.clear()
    enqueueSpeech.mockClear()
    stopSpeech.mockClear()
    current = null
  })
  afterEach(() => vi.useRealTimers())

  it('reads only new completed agent messages, and keeps each tab setting separate', async () => {
    let renderer!: ReactTestRenderer
    const old = message('old', '過去の回答')
    await act(async () => {
      renderer = create(
        createElement(Harness, { scopeKey: 'tab-a', working: false, messages: [old] })
      )
    })
    await act(async () => {
      current!.toggle()
    })
    expect(storage.get('orca:voice-tab:tab-a')).toBe('on')
    expect(enqueueSpeech).not.toHaveBeenCalled()

    const progress = message('progress', '進捗です。')
    await act(async () => {
      renderer.update(
        createElement(Harness, { scopeKey: 'tab-a', working: true, messages: [old, progress] })
      )
    })
    await act(async () => {
      vi.advanceTimersByTime(1200)
    })
    expect(enqueueSpeech).toHaveBeenCalledWith('進捗です。')

    const final = message('final', '結論です。'.repeat(80))
    await act(async () => {
      renderer.update(
        createElement(Harness, {
          scopeKey: 'tab-a',
          working: false,
          messages: [old, progress, final]
        })
      )
    })
    expect(enqueueSpeech.mock.lastCall?.[0]).toContain('最終回答の要約です。')

    await act(async () => {
      renderer.update(
        createElement(Harness, {
          scopeKey: 'tab-b',
          working: false,
          messages: [old, progress, final]
        })
      )
    })
    expect(current!.enabled).toBe(false)
    expect(storage.get('orca:voice-tab:tab-a')).toBe('on')
    await act(async () => {
      renderer.unmount()
    })
  })
})
