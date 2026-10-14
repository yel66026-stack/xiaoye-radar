import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseRuleDocument, RuleEngine } from '@xiaoye-radar/core'
import { JsonSourceAdapter } from '@xiaoye-radar/source-sdk'

describe('synthetic Zhejiang monitoring example', () => {
  it('matches two, isolates missing location and accounts for each filtered record', async () => {
    const adapter = new JsonSourceAdapter()
    try {
      await adapter.initialize({ path: resolve('examples/zhejiang-monitoring/demo-data.json') })
      const now = new Date('2026-10-14T04:00:00Z')
      const rule = parseRuleDocument(
        await readFile(resolve('examples/zhejiang-monitoring/rule.yml'), 'utf8'),
        now,
      )
      const result = new RuleEngine().process(await adapter.fetch(), rule, {
        sourceRecordId: 'zhejiang-demo',
        now,
      })
      expect(result.stats).toEqual({
        total: 6,
        candidates: 2,
        duplicates: 0,
        excluded: 0,
        timeFiltered: 1,
        ruleFiltered: 1,
        regionFiltered: 1,
        unverified: 1,
      })
      expect(result.candidates.map((candidate) => candidate.item.id).sort()).toEqual([
        'synthetic-hangzhou',
        'synthetic-ningbo',
      ])
      expect(result.unverified[0]?.item.id).toBe('synthetic-unknown')
    } finally {
      await adapter.dispose()
    }
  })
})
