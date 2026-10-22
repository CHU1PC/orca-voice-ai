import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import { findOrcaTabTranscript } from './use-orca-tab-transcript-fallback'

function hit(sessionId: string) {
  return {
    agent: 'codex',
    sessionId,
    title: '音声出力システムの要件を確認',
    cwd: '/Users/test/Driving-AI',
    branch: 'main',
    updatedAt: '2026-10-22T02:00:00Z',
    messageCount: 5,
    score: 10,
    source: { presence: 'present', filePath: `/sessions/${sessionId}.jsonl` },
    evidence: null
  }
}

function clientWithHits(hits: ReturnType<typeof hit>[]) {
  const sendRequest = vi.fn(async () => ({
    ok: true,
    result: {
      kind: 'results',
      hits,
      page: { cursor: null, hasMore: false },
      generation: 1,
      truncated: { candidates: false, snippets: 0, query: false, freshness: false },
      durationMs: 1
    }
  }))
  return { client: { sendRequest } as unknown as RpcClient, sendRequest }
}

describe('findOrcaTabTranscript', () => {
  it('uses one exact session match within the current workspace', async () => {
    const { client, sendRequest } = clientWithHits([hit('current')])
    const match = await findOrcaTabTranscript({
      client,
      worktreeId: 'workspace-current',
      tabId: 'tab-current',
      title: '音声出力システムの要件を確認',
      agent: 'codex'
    })
    expect(match).toEqual({
      tabId: 'tab-current',
      agent: 'codex',
      sessionId: 'current',
      transcriptPath: '/sessions/current.jsonl'
    })
    expect(sendRequest).toHaveBeenCalledWith(
      'aiVault.searchSessions',
      expect.objectContaining({
        within: { kind: 'workspace', worktreeId: 'workspace-current' },
        filters: { agents: ['codex'], sort: 'newest' }
      })
    )
  })

  it('refuses an ambiguous title instead of reading another session', async () => {
    const { client } = clientWithHits([hit('one'), hit('two')])
    expect(
      await findOrcaTabTranscript({
        client,
        worktreeId: 'workspace-current',
        tabId: 'tab-current',
        title: '音声出力システムの要件を確認',
        agent: 'codex'
      })
    ).toBeNull()
  })
})
