import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { RuleEngine, parseRuleDocument, type NormalizedContent } from '@xiaoye-radar/core'
import { adapterForPath } from '@xiaoye-radar/source-sdk'
import { JsonFileStorage } from '@xiaoye-radar/storage'
import { CommunityService } from '../../apps/community-desktop/src/main/community-service'

const exampleRoot = resolve('examples', 'legal-inquiry-triage')
const dataPath = join(exampleRoot, 'data', 'legal-inquiry-synthetic.json')
const rulePath = join(exampleRoot, 'rules', 'legal-inquiry-basic.yaml')
const fixedNow = new Date('2026-09-09T12:00:00.000Z')
const temporaryDirectories: string[] = []

async function exampleFixture(): Promise<{
  items: NormalizedContent[]
  ruleDocument: string
}> {
  const adapter = adapterForPath(dataPath)
  await adapter.initialize({ path: dataPath, sourceName: 'Legal Inquiry Triage' })
  try {
    const items = (await adapter.fetch()).map((item) => {
      const relativeHours = item.metadata.relativeHours
      if (typeof relativeHours !== 'number') throw new Error('Missing synthetic relativeHours')
      return {
        ...item,
        publishedAt: new Date(fixedNow.getTime() - relativeHours * 60 * 60 * 1000).toISOString(),
      }
    })
    return { items, ruleDocument: await readFile(rulePath, 'utf8') }
  } finally {
    await adapter.dispose()
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  )
})

describe('Legal Inquiry Triage example', () => {
  it('classifies all seven synthetic fixture groups with deterministic rules', async () => {
    const { items, ruleDocument } = await exampleFixture()
    const rule = parseRuleDocument(ruleDocument, fixedNow)
    const result = new RuleEngine().process(items, rule, {
      sourceRecordId: 'legal-inquiry-triage',
      now: fixedNow,
    })
    const outcomes = new Map(
      result.decisions.map(({ item, outcome }) => [item.id, outcome] as const),
    )

    expect(items).toHaveLength(100)
    expect(rule.regex).toEqual([])
    expect(result.stats).toEqual({
      total: 100,
      candidates: 51,
      duplicates: 5,
      excluded: 18,
      timeFiltered: 10,
      ruleFiltered: 16,
    })
    expect(outcomes.get('synthetic-actionable-01')).toBe('candidate')
    expect(outcomes.get('synthetic-education-01')).toBe('excluded')
    expect(outcomes.get('synthetic-marketing-01')).toBe('excluded')
    expect(outcomes.get('synthetic-expired-01')).toBe('filtered_time')
    expect(outcomes.get('synthetic-duplicate-01-a')).toBe('candidate')
    expect(outcomes.get('synthetic-duplicate-01-b')).toBe('duplicate')
    for (const decision of result.decisions) {
      expect(decision.outcome, decision.item.id).toBe(decision.item.metadata.expectedOutcome)
    }
  })

  it('deduplicates one rule revision and reevaluates a changed revision', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'xiaoye-legal-example-test-'))
    temporaryDirectories.push(directory)
    const service = new CommunityService(new JsonFileStorage(directory), resolve('examples'))
    await service.initialize()
    await service.importLegalInquiryExample()

    const firstState = await service.state()
    const firstRevision = firstState.rules[0]!.revision
    expect(firstState.runs[0]?.stats).toEqual({
      total: 100,
      candidates: 51,
      duplicates: 5,
      excluded: 18,
      timeFiltered: 10,
      ruleFiltered: 16,
    })
    expect(firstState.candidates).toHaveLength(51)

    await service.run('legal-inquiry-triage', 'legal-inquiry-basic')
    const repeatedState = await service.state()
    expect(repeatedState.runs[0]?.ruleRevision).toBe(firstRevision)
    expect(repeatedState.runs[0]?.stats).toEqual({
      total: 100,
      candidates: 0,
      duplicates: 56,
      excluded: 18,
      timeFiltered: 10,
      ruleFiltered: 16,
    })
    expect(repeatedState.candidates).toHaveLength(51)

    const changedDocument = (await readFile(rulePath, 'utf8')).replace(
      'basic_score: 0',
      'basic_score: 1',
    )
    await service.saveRule(changedDocument)
    await service.run('legal-inquiry-triage', 'legal-inquiry-basic')
    const changedState = await service.state()
    expect(changedState.runs[0]?.ruleRevision).not.toBe(firstRevision)
    expect(changedState.runs[0]?.stats).toEqual({
      total: 100,
      candidates: 51,
      duplicates: 5,
      excluded: 18,
      timeFiltered: 10,
      ruleFiltered: 16,
    })
    expect(changedState.candidates).toHaveLength(102)
    expect(new Set(changedState.candidates.map(({ ruleRevision }) => ruleRevision)).size).toBe(2)
  })

  it('contains only explicitly fictional records without personal contact data', async () => {
    const records = JSON.parse(await readFile(dataPath, 'utf8')) as Array<Record<string, unknown>>
    const serialized = JSON.stringify(records)

    expect(records).toHaveLength(100)
    expect(records.every(({ id }) => typeof id === 'string' && id.startsWith('synthetic-'))).toBe(
      true,
    )
    expect(records.every(({ synthetic }) => synthetic === true)).toBe(true)
    expect(records.every(({ fictional }) => fictional === true)).toBe(true)
    expect(
      records.every(
        ({ author }) => typeof author === 'string' && /^Synthetic participant \d{3}$/u.test(author),
      ),
    ).toBe(true)
    expect(
      records.every(
        ({ url }) => typeof url === 'string' && new URL(url).hostname === 'example.invalid',
      ),
    ).toBe(true)
    expect(serialized).not.toMatch(/\b1[3-9]\d{9}\b/u)
    expect(serialized).not.toMatch(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu)
    expect(serialized).not.toMatch(
      /(?:微信|weixin|wechat|小红书|xiaohongshu|手机号|电话|联系方式)/iu,
    )
    expect(new Set(records.map(({ category }) => category))).toEqual(
      new Set([
        'actionable',
        'legal-education',
        'lawyer-marketing',
        'irrelevant',
        'expired',
        'boundary',
        'duplicate',
      ]),
    )
  })
})
