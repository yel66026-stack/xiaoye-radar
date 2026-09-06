import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { normalizedContentSchema, type NormalizedContent } from '@xiaoye-radar/core'
import { JsonFileStorage } from '@xiaoye-radar/storage'
import { CommunityService } from '../../apps/community-desktop/src/main/community-service'

const temporaryDirectories: string[] = []

function item(id = 'item-1'): NormalizedContent {
  return normalizedContentSchema.parse({
    id,
    source: 'fixture',
    title: 'Actionable product feedback',
    content: 'Please help with this export issue.',
    author: null,
    publishedAt: null,
    url: 'https://example.invalid/feedback/1',
    metadata: {},
  })
}

function ruleDocument(id: string, basicScore = 10): string {
  return `id: ${id}\nname: ${id}\nbasic_score: ${basicScore}\nminimum_score: 1\ndeduplication: content\n`
}

async function serviceFixture(items: NormalizedContent[] = [item()]): Promise<{
  directory: string
  service: CommunityService
  storage: JsonFileStorage
}> {
  const directory = await mkdtemp(join(tmpdir(), 'xiaoye-community-service-test-'))
  temporaryDirectories.push(directory)
  const storage = new JsonFileStorage(directory)
  const service = new CommunityService(storage, resolve('examples'))
  await service.initialize()
  await storage.upsertSource(
    { id: 'source-1', name: 'Fixture source', adapterKind: 'json', fileName: 'fixture.json' },
    items,
  )
  return { directory, service, storage }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  )
})

describe('CommunityService monitoring history and deduplication', () => {
  it('deduplicates the same content for the same source and rule across runs', async () => {
    const { service } = await serviceFixture()
    await service.saveRule(ruleDocument('rule-a'))

    await service.run('source-1', 'rule-a')
    await service.run('source-1', 'rule-a')

    const state = await service.state()
    expect(state.candidates).toHaveLength(1)
    expect(state.runs[0]?.stats).toMatchObject({ candidates: 0, duplicates: 1 })
  })

  it('evaluates the same source content again under a different rule', async () => {
    const { service } = await serviceFixture()
    await service.saveRule(ruleDocument('rule-a'))
    await service.saveRule(ruleDocument('rule-b'))

    await service.run('source-1', 'rule-a')
    await service.run('source-1', 'rule-b')

    const state = await service.state()
    expect(state.candidates).toHaveLength(2)
    expect(state.candidates.map(({ ruleId }) => ruleId).sort()).toEqual(['rule-a', 'rule-b'])
    expect(state.runs[0]?.stats).toMatchObject({ candidates: 1, duplicates: 0 })
  })

  it('deduplicates repeated content within one run', async () => {
    const { service } = await serviceFixture([item('item-1'), item('item-2')])
    await service.saveRule(ruleDocument('rule-a'))

    await service.run('source-1', 'rule-a')

    const state = await service.state()
    expect(state.candidates).toHaveLength(1)
    expect(state.runs[0]?.stats).toMatchObject({ candidates: 1, duplicates: 1 })
  })

  it('does not expose another rule candidate as an existing fingerprint', async () => {
    const { service, storage } = await serviceFixture()
    await service.saveRule(ruleDocument('rule-a'))
    await service.saveRule(ruleDocument('rule-b'))
    await service.run('source-1', 'rule-a')
    const ruleB = (await service.state()).rules.find(({ id }) => id === 'rule-b')!

    expect(await storage.existingFingerprints('source-1', 'rule-b', ruleB.revision)).toEqual(
      new Set(),
    )

    await service.run('source-1', 'rule-b')
    expect((await service.state()).candidates).toHaveLength(2)
  })

  it('reevaluates existing content after an evaluation-relevant rule revision', async () => {
    const { service } = await serviceFixture()
    await service.saveRule(ruleDocument('rule-a', 10))
    await service.run('source-1', 'rule-a')

    await service.saveRule(ruleDocument('rule-a', 20))
    await service.run('source-1', 'rule-a')

    const state = await service.state()
    expect(state.candidates).toHaveLength(2)
    expect(new Set(state.candidates.map(({ ruleRevision }) => ruleRevision)).size).toBe(2)
    expect(state.runs[0]?.stats).toMatchObject({ candidates: 1, duplicates: 0 })
  })

  it('records a failed monitoring run and returns a sanitized error to the UI caller', async () => {
    const { directory, service } = await serviceFixture()
    await service.saveRule(ruleDocument('rule-a'))
    await writeFile(
      join(directory, 'sources', 'source-1.json'),
      '{"PRIVATE_PATH_MARKER":"PRIVATE_CONTENT_MARKER",',
      'utf8',
    )

    await expect(service.run('source-1', 'rule-a')).rejects.toThrow(
      'Monitoring could not be completed. Check the imported source and rule, then try again.',
    )

    const state = await service.state()
    expect(state.runs).toHaveLength(1)
    expect(state.runs[0]).toMatchObject({
      sourceRecordId: 'source-1',
      sourceName: 'Fixture source',
      ruleId: 'rule-a',
      ruleName: 'rule-a',
      status: 'failed',
      stats: {
        total: 0,
        candidates: 0,
        duplicates: 0,
        excluded: 0,
        timeFiltered: 0,
        ruleFiltered: 0,
      },
      error:
        'Monitoring could not be completed. Check the imported source and rule, then try again.',
    })
    expect(state.runs[0]?.error).not.toContain('PRIVATE_PATH_MARKER')
    expect(state.runs[0]?.error).not.toContain('PRIVATE_CONTENT_MARKER')
    expect(Date.parse(state.runs[0]!.finishedAt)).toBeGreaterThanOrEqual(
      Date.parse(state.runs[0]!.startedAt),
    )
  })
})
