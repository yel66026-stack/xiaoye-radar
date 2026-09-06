import { describe, expect, it } from 'vitest'
import { candidateSchema } from '@xiaoye-radar/core'
import { candidatesToCsv, candidatesToJson } from '@xiaoye-radar/export'
import { reviewCandidate } from '@xiaoye-radar/review-engine'
import {
  isAllowedExternalUrl,
  isAllowedRendererUrl,
} from '../../apps/community-desktop/src/main/url-policy'

const candidate = candidateSchema.parse({
  id: 'candidate-1',
  runId: 'run-1',
  ruleId: 'rule-1',
  sourceRecordId: 'source-1',
  item: {
    id: 'item-1',
    source: 'fixture',
    title: '=SUM(A1:A2)',
    content: 'Issue content',
    author: null,
    publishedAt: '2026-09-06T10:00:00.000Z',
    url: 'https://example.invalid/1',
    metadata: {},
  },
  fingerprint: 'a'.repeat(64),
  score: 50,
  priority: 'normal',
  matchedKeywords: ['issue'],
  reasons: ['Matched'],
  reviewStatus: 'pending',
  reviewNote: '',
  reviewedAt: null,
  createdAt: '2026-09-06T12:00:00.000Z',
})

describe('review, export and URL security', () => {
  it('applies valid human-review transitions', () => {
    const reviewed = reviewCandidate(
      candidate,
      'approved',
      'Confirmed',
      new Date('2026-09-06T13:00:00Z'),
    )
    expect(reviewed).toMatchObject({ reviewStatus: 'approved', reviewNote: 'Confirmed' })
    expect(() => reviewCandidate(reviewed, 'rejected')).toThrow(/Cannot move/u)
  })

  it('exports JSON and neutralizes spreadsheet formula cells in CSV', () => {
    expect(candidatesToJson([candidate])).toContain('candidate-1')
    expect(candidatesToCsv([candidate])).toContain("'=SUM(A1:A2)")
  })

  it('allows only local renderer navigation and credential-free web URLs', () => {
    const credentialUrl = ['https://user', 'password@example.invalid/item'].join(':')
    expect(isAllowedRendererUrl('file:///C:/app/out/renderer/index.html')).toBe(true)
    expect(isAllowedRendererUrl('https://evil.invalid/out/renderer/index.html')).toBe(false)
    expect(isAllowedExternalUrl('https://example.invalid/item')).toBe(true)
    expect(isAllowedExternalUrl(credentialUrl)).toBe(false)
    expect(isAllowedExternalUrl('file:///C:/secret.txt')).toBe(false)
  })
})
