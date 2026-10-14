import { describe, expect, it } from 'vitest'
import {
  checkRegion,
  normalizedContentSchema,
  parseRuleDocument,
  RuleEngine,
  ZHEJIANG_CITIES,
} from '@xiaoye-radar/core'
import { createMonitorSchema } from '../../apps/community-desktop/src/shared/monitoring-config'
import { normalizeRecord } from '@xiaoye-radar/source-sdk'

const now = new Date('2026-10-14T04:00:00Z')
const rule = parseRuleDocument(
  `id: zhejiang\nname: 浙江民宿\ninclude: [民宿]\nregion: { province: 浙江 }\ntime_window: { start: '2026-10-01T00:00:00+08:00', end: '2026-10-13T23:59:59.999+08:00' }\ndeduplication: id`,
  now,
)
const item = (
  id: string,
  metadata: Record<string, unknown> = { location: '浙江省杭州市西湖区' },
  publishedAt: string | null = '2026-10-10T12:00:00+08:00',
  content = '民宿体验',
) =>
  normalizedContentSchema.parse({
    id,
    source: 'xiaohongshu',
    title: content,
    content,
    metadata,
    publishedAt,
  })
const process = (items: ReturnType<typeof item>[], active = rule) =>
  new RuleEngine().process(items, active, { sourceRecordId: 'xhs-test', now })

describe('region + time + keywords', () => {
  it('requires all three constraints and persists only genuine matches', () => {
    const result = process([
      item('valid'),
      item('wrong-region', { location: '上海市浦东新区' }),
      item('old', undefined, '2026-09-30T12:00:00+08:00'),
      item('irrelevant', undefined, undefined, '其他内容'),
    ])
    expect(result.candidates.map((entry) => entry.item.id)).toEqual(['valid'])
    expect(result.stats).toEqual({
      total: 4,
      candidates: 1,
      duplicates: 0,
      excluded: 0,
      timeFiltered: 1,
      regionFiltered: 1,
      ruleFiltered: 1,
      unverified: 0,
    })
  })
  it.each(ZHEJIANG_CITIES)('recognizes the explicit Zhejiang city %s', (city) => {
    expect(checkRegion(item(city, { city: `${city}市` }), rule.regionFilter)).toBe('match')
  })
  it('does not infer note location from body text, IP or the author', () => {
    const result = process([
      item(
        'unknown',
        { ip_location: '浙江', author_location: '杭州' },
        undefined,
        '浙江杭州民宿体验',
      ),
    ])
    expect(result.candidates).toHaveLength(0)
    expect(result.unverified[0]?.reasons).toEqual(['Note location is missing'])
  })
  it('does not mistake Shanghai Hangzhou Road for Hangzhou', () => {
    expect(checkRegion(item('road', { location: '上海市杭州路' }), rule.regionFilter)).toBe(
      'outside',
    )
  })
  it('prefers administrative fields over a place name with a different province in its name', () => {
    expect(
      checkRegion(
        item('venue', { location: { province: '浙江', city: '杭州', name: '上海风味餐厅' } }),
        rule.regionFilter,
      ),
    ).toBe('match')
    expect(
      checkRegion(item('venue-only', { poi: { name: '金华火腿专卖店' } }), rule.regionFilter),
    ).toBe('missing')
  })
  it('requires city evidence when a specific city is selected', () => {
    const filter = { province: '浙江', cities: ['杭州'] }
    expect(checkRegion(item('province-only', { province: '浙江' }), filter)).toBe('missing')
    expect(checkRegion(item('ningbo', { province: '浙江', city: '宁波' }), filter)).toBe('outside')
    expect(
      checkRegion(item('hangzhou', { location: { city: '杭州市', name: '西湖' } }), filter),
    ).toBe('match')
  })
  it('keeps ambiguous venues and missing timestamps out of candidates', () => {
    const result = process([
      item('unknown', { poi: { name: '大草坪' } }, null),
      item('not-a-match', {}, null, '天气很好'),
    ])
    expect(result.candidates).toHaveLength(0)
    expect(result.unverified).toHaveLength(1)
    expect(result.unverified[0]?.reasons).toEqual([
      'Published time is missing',
      'Note location is missing',
    ])
  })
  it('includes both date boundaries in Beijing time and excludes the next millisecond', () => {
    const result = process([
      item('start', undefined, '2026-09-30T16:00:00Z'),
      item('end', undefined, '2026-10-13T15:59:59.999Z'),
      item('after', undefined, '2026-10-13T16:00:00Z'),
    ])
    expect(result.candidates.map((entry) => entry.item.id).sort()).toEqual(['end', 'start'])
    expect(result.stats.timeFiltered).toBe(1)
  })
  it('supports AND keywords and rolling windows at scan time', () => {
    const active = parseRuleDocument(
      'id: all\nname: all\ninclude: [民宿, 露营]\ninclude_mode: all\ntime_window: { days: 2 }',
      now,
    )
    const result = process(
      [
        item('both', undefined, '2026-10-13T04:00:00Z', '民宿露营'),
        item('one', undefined, '2026-10-13T04:00:00Z'),
        item('old', undefined, '2026-10-11T04:00:00Z', '民宿露营'),
      ],
      active,
    )
    expect(result.candidates.map((entry) => entry.item.id)).toEqual(['both'])
  })
  it('allows a valid copy after an earlier duplicate fails constraints', () => {
    const result = process([
      item('same', { location: '上海市' }),
      item('same', { location: '杭州市' }),
    ])
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]?.item.metadata.location).toBe('杭州市')
  })
  it('changes revision when region, date or keyword mode changes', () => {
    for (const extra of [
      'region: {province: 浙江}',
      'time_window: {start: "2026-10-01T00:00:00+08:00"}',
      'include_mode: all',
    ]) {
      const document = 'id: same\nname: same\ninclude: [民宿]'
      expect(parseRuleDocument(`${document}\n${extra}`, now).revision).not.toBe(
        parseRuleDocument(document, now).revision,
      )
    }
  })
  it('rejects reversed ranges and invalid calendar dates in the form', () => {
    expect(() =>
      parseRuleDocument(
        'name: bad\ntime_window: { start: "2026-10-14T00:00:00Z", end: "2026-10-01T00:00:00Z" }',
        now,
      ),
    ).toThrow()
    const form = {
      name: 'test',
      source: 'xiaohongshu',
      keywords: ['民宿'],
      timeMode: 'range',
      days: 7,
      startDate: '2026-02-30',
      endDate: '2026-10-14',
      intervalMinutes: 60,
    }
    expect(createMonitorSchema.safeParse(form).success).toBe(false)
    expect(createMonitorSchema.safeParse({ ...form, startDate: '2026-10-15' }).success).toBe(false)
    expect(
      createMonitorSchema.safeParse({ ...form, startDate: '2026-10-01', intervalMinutes: 1 })
        .success,
    ).toBe(false)
  })
  it('imports Chinese column names and nested location metadata', () => {
    const imported = normalizeRecord(
      {
        标题: '民宿体验',
        正文: '露营',
        发布时间: '2026-10-10T12:00:00+08:00',
        地点: '浙江省宁波市',
      },
      0,
      'fixture',
    )
    expect(checkRegion(imported, rule.regionFilter)).toBe('match')
    const nested = normalizeRecord(
      {
        title: '民宿',
        metadata: { location: { province: '浙江', city: '杭州' }, cookie: 'sensitive' },
      },
      0,
      'fixture',
    )
    expect(checkRegion(nested, rule.regionFilter)).toBe('match')
    expect(JSON.stringify(nested.metadata)).not.toContain('sensitive')
  })
})
