import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import { nativeChatMessagePlainText } from './mobile-native-chat-message-plain-text'

const MAX_FINAL_CHARACTERS = 240

export function speechTextForMessage(message: NativeChatMessage, isFinal: boolean): string {
  if (message.role !== 'assistant') return ''
  let text = nativeChatMessagePlainText(message)
  text = text.replace(/```[\s\S]*?```/g, ' コードがあります。 ')
  text = text.replace(/https?:\/\/[^\s)\]>]+/g, ' リンクがあります。 ')
  text = text.replace(/`[^`\n]+`/g, ' コマンドがあります。 ')
  text = text.replace(/(?:\.?\.?\/)?(?:[\w.-]+\/)+[\w.-]+/g, ' ファイルパスがあります。 ')
  text = text.replace(/\[[^\]]+\]\([^)]*\)/g, ' リンクがあります。 ')
  text = text
    .replace(/^[\s#>*-]+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  if (isFinal && text.length > MAX_FINAL_CHARACTERS) {
    const sentences = text.match(/[^。！？.!?]+[。！？.!?]?/g)?.map((part) => part.trim()) ?? []
    const selected: string[] = []
    let length = 0
    for (const sentence of sentences) {
      if (length + sentence.length > 140) break
      selected.push(sentence)
      length += sentence.length
    }
    const conclusion = sentences.at(-1)
    if (
      conclusion &&
      !selected.includes(conclusion) &&
      length + conclusion.length <= MAX_FINAL_CHARACTERS
    ) {
      selected.push(conclusion)
    }
    text = selected.length > 0 ? selected.join(' ') : text.slice(0, MAX_FINAL_CHARACTERS)
    return `最終回答の要約です。${text}`
  }
  return text
}
