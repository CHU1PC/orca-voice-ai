import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { enqueueSpeech, stopSpeech } from '@orca/expo-two-way-audio'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import { speechTextForMessage } from './orca-voice-text'

export function useOrcaTabVoice(args: {
  scopeKey: string
  active: boolean
  ready: boolean
  working: boolean
  messages: NativeChatMessage[]
}): { enabled: boolean; toggle: () => void } {
  const { scopeKey, active, ready, working, messages } = args
  const [enabled, setEnabled] = useState(false)
  const [foreground, setForeground] = useState(AppState.currentState === 'active')
  const seen = useRef(new Set<string>())
  const armed = useRef(false)
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const storageKey = `orca:voice-tab:${encodeURIComponent(scopeKey)}`

  const clearPending = useCallback(() => {
    for (const timer of pending.current.values()) clearTimeout(timer)
    pending.current.clear()
  }, [])

  useEffect(() => {
    let live = true
    if (Platform.OS === 'ios') stopSpeech()
    clearPending()
    setEnabled(false)
    armed.current = false
    seen.current = new Set()
    if (scopeKey) {
      void AsyncStorage.getItem(storageKey).then((value) => {
        if (live) setEnabled(value === 'on')
      })
    }
    return () => {
      live = false
      clearPending()
      if (Platform.OS === 'ios') stopSpeech()
    }
  }, [storageKey, clearPending])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active')
      if (state !== 'active' && Platform.OS === 'ios') stopSpeech()
    })
    return () => subscription.remove()
  }, [])

  const toggle = useCallback(() => {
    const next = !enabled
    if (!next && Platform.OS === 'ios') stopSpeech()
    clearPending()
    armed.current = false
    seen.current = new Set(
      messages.filter((message) => message.state !== 'running').map((message) => message.id)
    )
    setEnabled(next)
    void AsyncStorage.setItem(storageKey, next ? 'on' : 'off')
  }, [clearPending, enabled, messages, storageKey])

  useEffect(() => {
    if (!ready || !active || !enabled || !foreground) {
      if (armed.current && Platform.OS === 'ios') stopSpeech()
      clearPending()
      armed.current = false
      return
    }
    if (!armed.current) {
      seen.current = new Set(
        messages.filter((message) => message.state !== 'running').map((message) => message.id)
      )
      armed.current = true
      return
    }
    const completed = messages.filter(
      (message) => message.role === 'assistant' && message.state !== 'running'
    )
    for (const message of completed) {
      if (seen.current.has(message.id)) continue
      const lastAssistant = completed[completed.length - 1]?.id === message.id
      if (working && lastAssistant) {
        if (!pending.current.has(message.id)) {
          pending.current.set(
            message.id,
            setTimeout(() => {
              pending.current.delete(message.id)
              if (seen.current.has(message.id) || !armed.current) return
              seen.current.add(message.id)
              const speech = speechTextForMessage(message, false)
              if (speech && Platform.OS === 'ios') enqueueSpeech(speech)
            }, 1200)
          )
        }
      } else {
        const timer = pending.current.get(message.id)
        if (timer) clearTimeout(timer)
        pending.current.delete(message.id)
        seen.current.add(message.id)
        const speech = speechTextForMessage(message, !working && lastAssistant)
        if (speech && Platform.OS === 'ios') enqueueSpeech(speech)
      }
    }
  }, [active, clearPending, enabled, foreground, messages, ready, working])

  return { enabled, toggle }
}
