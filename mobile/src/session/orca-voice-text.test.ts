import { describe, expect, it } from 'vitest'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import { speechTextForMessage } from './orca-voice-text'

function message(text: string, role: NativeChatMessage['role'] = 'assistant'): NativeChatMessage {
  return {
    id: 'sample',
    role,
    blocks: [{ type: 'text', text }],
    timestamp: 1,
    source: 'transcript'
  }
}

describe('speechTextForMessage', () => {
  it('skips user messages and tool blocks', () => {
    expect(speechTextForMessage(message('秘密', 'user'), false)).toBe('')
    expect(speechTextForMessage({ ...message(''), blocks: [] }, false)).toBe('')
  })

  it('announces omitted code, paths and links without reading their contents', () => {
    const spoken = speechTextForMessage(
      message(
        '確認しました。\n```sh\nrm -rf /tmp/example\n```\n/path/to/file と https://example.com/a'
      ),
      false
    )
    expect(spoken).toContain('コードがあります')
    expect(spoken).toContain('ファイルパスがあります')
    expect(spoken).toContain('リンクがあります')
    expect(spoken).not.toContain('rm -rf')
    expect(spoken).not.toContain('example.com')
  })

  it('shortens long final answers to a one-minute extract', () => {
    const spoken = speechTextForMessage(message('説明します。'.repeat(100)), true)
    expect(spoken).toContain('最終回答の要約です')
    expect(spoken.length).toBeLessThan(265)
  })
})
