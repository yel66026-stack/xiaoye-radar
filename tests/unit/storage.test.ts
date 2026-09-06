import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  RuleEngine,
  normalizedContentSchema,
  parseRuleDocument,
  type ScanRun,
} from '@xiaoye-radar/core'
import { JsonFileStorage } from '@xiaoye-radar/storage'

const temporaryDirectories: string[] = []

async function storageFixture(): Promise<JsonFileStorage> {
  const directory = await mkdtemp(join(tmpdir(), 'xiaoye-storage-test-'))
  temporaryDirectories.push(directory)
  const storage = new JsonFileStorage(directory)
  await storage.initialize()
  return storage
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  )
})

describe('JsonFileStorage', () => {
  it('saves and loads normalized source content', async () => {
    const storage = await storageFixture()
    const item = normalizedContentSchema.parse({
      id: 'one',
      source: 'fixture',
      title: 'Issue',
      content: 'Help',
      author: null,
      publishedAt: null,
      url: null,
      metadata: {},
    })
    const source = await storage.upsertSource(
      { name: 'Fixture', adapterKind: 'json', fileName: 'fixture.json' },
      [item],
    )
    expect(await storage.loadSourceItems(source.id)).toEqual([item])
  })

  it('guards against duplicate candidates when recording a run', async () => {
    const storage = await storageFixture()
    const now = new Date('2026-09-06T12:00:00.000Z')
    const rule = parseRuleDocument('id: r1\nname: Rule\ninclude: [issue]\nbasic_score: 20', now)
    const item = normalizedContentSchema.parse({
      id: 'one',
      source: 'fixture',
      title: 'Issue',
      content: '',
      author: null,
      publishedAt: null,
      url: null,
      metadata: {},
    })
    const result = new RuleEngine().process([item], rule, {
      sourceRecordId: 'source-1',
      now,
      runId: 'run-1',
    })
    const run: ScanRun = {
      id: 'run-1',
      sourceRecordId: 'source-1',
      sourceName: 'Fixture',
      ruleId: rule.id,
      ruleRevision: rule.revision,
      ruleName: rule.name,
      startedAt: now.toISOString(),
      finishedAt: now.toISOString(),
      status: 'success',
      stats: result.stats,
      error: null,
    }
    expect(await storage.recordRun(run, result.candidates)).toEqual({ inserted: 1, duplicates: 0 })
    expect(await storage.recordRun({ ...run, id: 'run-2' }, result.candidates)).toEqual({
      inserted: 0,
      duplicates: 1,
    })
    expect((await storage.read()).candidates).toHaveLength(1)
  })
})
