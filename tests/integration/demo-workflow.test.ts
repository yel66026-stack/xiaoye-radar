import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { JsonFileStorage } from '@xiaoye-radar/storage'
import { CommunityService } from '../../apps/community-desktop/src/main/community-service'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  )
})

describe('demo integration workflow', () => {
  it('runs source -> rules -> deduplication -> candidates -> storage', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'xiaoye-demo-test-'))
    temporaryDirectories.push(directory)
    const service = new CommunityService(new JsonFileStorage(directory), resolve('examples'))
    await service.initialize()
    await service.importDemo()
    const state = await service.state()

    expect(state.sources).toHaveLength(1)
    expect(state.sources[0]?.itemCount).toBe(80)
    expect(state.rules).toHaveLength(1)
    expect(state.jobs).toHaveLength(1)
    expect(state.runs).toHaveLength(1)
    expect(state.runs[0]?.stats).toEqual({
      total: 80,
      candidates: 45,
      duplicates: 5,
      excluded: 10,
      timeFiltered: 10,
      ruleFiltered: 10,
    })
    expect(state.candidates).toHaveLength(45)
    expect(state.candidates.every(({ reviewStatus }) => reviewStatus === 'pending')).toBe(true)
  })
})
