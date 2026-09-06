import { describe, expect, it } from 'vitest'
import {
  RuleEngine,
  normalizedContentSchema,
  parseRuleDocument,
  type NormalizedContent,
} from '@xiaoye-radar/core'

const now = new Date('2026-09-06T12:00:00.000Z')

function item(overrides: Partial<NormalizedContent> = {}): NormalizedContent {
  return normalizedContentSchema.parse({
    id: 'item-1',
    source: 'fixture',
    title: 'Urgent product issue',
    content: 'Please help, the export is broken.',
    author: null,
    publishedAt: '2026-09-06T10:00:00.000Z',
    url: 'https://example.invalid/items/1',
    metadata: {},
    ...overrides,
  })
}

function rule(extra = '') {
  return parseRuleDocument(
    `
id: fixture-rule
name: Fixture rule
include: [issue, help]
exclude: [advertisement]
score:
  urgent: 30
  broken: 20
  issue: 15
  help: 10
basic_score: 5
minimum_score: 20
time_window:
  days: 3
deduplication: content
${extra}
`,
    now,
  )
}

describe('RuleEngine', () => {
  it('matches include keywords and calculates a bounded score', () => {
    const result = new RuleEngine().process([item()], rule(), {
      sourceRecordId: 'source-1',
      now,
    })
    expect(result.stats.candidates).toBe(1)
    expect(result.candidates[0]?.score).toBe(80)
    expect(result.candidates[0]?.matchedKeywords).toEqual(expect.arrayContaining(['issue', 'help']))
  })

  it('applies exclusion before scoring', () => {
    const result = new RuleEngine().process(
      [item({ content: 'Advertisement: please help with an issue.' })],
      rule(),
      { sourceRecordId: 'source-1', now },
    )
    expect(result.decisions[0]?.outcome).toBe('excluded')
    expect(result.stats.excluded).toBe(1)
  })

  it('filters content outside the time window', () => {
    const result = new RuleEngine().process(
      [item({ publishedAt: '2026-08-01T10:00:00.000Z' })],
      rule(),
      { sourceRecordId: 'source-1', now },
    )
    expect(result.decisions[0]?.outcome).toBe('filtered_time')
    expect(result.stats.timeFiltered).toBe(1)
  })

  it('deduplicates normalized content within a run', () => {
    const result = new RuleEngine().process([item(), item({ id: 'item-2' })], rule(), {
      sourceRecordId: 'source-1',
      now,
    })
    expect(result.stats.candidates).toBe(1)
    expect(result.stats.duplicates).toBe(1)
  })

  it('selects the same duplicate representative regardless of input order', () => {
    const first = item({ id: 'item-a' })
    const second = item({ id: 'item-b' })
    const forward = new RuleEngine().process([second, first], rule(), {
      sourceRecordId: 'source-1',
      now,
    })
    const reverse = new RuleEngine().process([first, second], rule(), {
      sourceRecordId: 'source-1',
      now,
    })

    expect(forward.candidates[0]?.item.id).toBe('item-a')
    expect(reverse.candidates[0]?.item.id).toBe('item-a')
    expect(forward.stats).toEqual(reverse.stats)
  })

  it('honors existing fingerprints across runs', () => {
    const first = new RuleEngine().process([item()], rule(), { sourceRecordId: 'source-1', now })
    const second = new RuleEngine().process([item()], rule(), {
      sourceRecordId: 'source-1',
      now,
      existingFingerprints: [first.candidates[0]!.fingerprint],
    })
    expect(second.decisions[0]?.outcome).toBe('duplicate')
  })

  it('supports source filters, priority and enabled state', () => {
    const enabled = rule('source_filter: [fixture]\npriority: high')
    const matched = new RuleEngine().process([item()], enabled, { sourceRecordId: 'source-1', now })
    expect(matched.candidates[0]?.priority).toBe('high')

    const disabled = { ...enabled, enabled: false }
    const filtered = new RuleEngine().process([item()], disabled, {
      sourceRecordId: 'source-1',
      now,
    })
    expect(filtered.decisions[0]?.outcome).toBe('filtered_disabled')
  })

  it('rejects unknown fields and malformed nested configuration', () => {
    expect(() => rule('unexpected_field: true')).toThrow(/unknown field/u)
    expect(() =>
      parseRuleDocument('name: Invalid window\ntime_window:\n  days: 3\n  hours: 4', now),
    ).toThrow(/unknown field/u)
  })

  it('rejects all regular-expression rules until hard-timeout isolation is available', () => {
    expect(() => rule('regex: ["refund\\\\s+request"]')).toThrow(
      /disabled in v0\.4\.0.*hard-timeout isolation/u,
    )
  })

  it('uses a stable semantic revision independent of timestamps', () => {
    const document = 'id: revision-rule\nname: Revision rule\ninclude: [help]\nbasic_score: 5'
    const first = parseRuleDocument(document, new Date('2026-09-06T12:00:00.000Z'))
    const second = parseRuleDocument(document, new Date('2026-09-07T12:00:00.000Z'))
    const changed = parseRuleDocument(
      `${document}\nminimum_score: 20`,
      new Date('2026-09-07T12:00:00.000Z'),
    )

    expect(first.revision).toMatch(/^[a-f0-9]{64}$/u)
    expect(second.revision).toBe(first.revision)
    expect(changed.revision).not.toBe(first.revision)
  })
})
