import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizedContentSchema } from '@xiaoye-radar/core'
import { JsonFileStorage, workspaceStateSchema } from '@xiaoye-radar/storage'
import { CommunityService } from '../../apps/community-desktop/src/main/community-service'
import { ScheduleRunner } from '../../apps/community-desktop/src/main/schedule-runner'
import { SourceScanError } from '../../apps/community-desktop/src/main/xiaohongshu-content'
import type { LiveContentCollector } from '../../apps/community-desktop/src/main/xiaohongshu-browser'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  )
})
const note = (id = 'synthetic-1', location: string | null = '杭州市') =>
  normalizedContentSchema.parse({
    id,
    source: 'xiaohongshu',
    title: '虚构民宿体验',
    content: '民宿露营',
    publishedAt: new Date().toISOString(),
    metadata: { location },
  })
const request = {
  name: '浙江民宿',
  source: 'xiaohongshu' as const,
  keywords: ['民宿'],
  timeMode: 'rolling' as const,
  days: 7,
  startDate: null,
  endDate: null,
  intervalMinutes: 60,
}
async function fixture(collector?: LiveContentCollector) {
  const directory = await mkdtemp(join(tmpdir(), 'xiaoye-schedule-test-'))
  directories.push(directory)
  const storage = new JsonFileStorage(directory)
  const service = new CommunityService(storage, resolve('examples'), collector)
  await service.initialize()
  return { directory, storage, service }
}
async function makeDue(storage: JsonFileStorage) {
  const job = (await storage.read()).jobs[0]!
  await storage.saveJob({ ...job, nextRunAt: new Date(Date.now() - 1000).toISOString() })
  return job
}

describe('persistent scheduled monitoring', () => {
  it('restores an overdue job after restart, catches up once and records its next run', async () => {
    const scan = vi.fn().mockResolvedValue([note()])
    const { directory, storage, service } = await fixture({ scan })
    await service.createMonitor(request)
    await makeDue(storage)
    const reopened = new CommunityService(new JsonFileStorage(directory), resolve('examples'), {
      scan,
    })
    await reopened.initialize()
    const runner = new ScheduleRunner(reopened)
    await runner.tick()
    await runner.tick()
    expect(scan).toHaveBeenCalledTimes(1)
    const state = await reopened.state()
    expect(state.candidates).toHaveLength(1)
    expect(state.runs).toHaveLength(1)
    expect(Date.parse(state.jobs[0]!.nextRunAt!)).toBeGreaterThan(Date.now())
  })
  it('refreshes the original file rather than repeatedly scanning a frozen import', async () => {
    const { directory, service } = await fixture()
    const path = join(directory, 'notes.json')
    await writeFile(path, JSON.stringify([note()]))
    await service.importFile(path)
    const source = (await service.state()).sources[0]!
    await service.createMonitor({ ...request, source: 'existing', sourceRecordId: source.id })
    const job = (await service.state()).jobs[0]!
    await service.runJob(job.id)
    await writeFile(path, JSON.stringify([note(), note('synthetic-2')]))
    await service.runJob(job.id)
    const state = await service.state()
    expect(state.candidates).toHaveLength(2)
    expect(state.runs[0]?.stats).toMatchObject({ total: 2, candidates: 1, duplicates: 1 })
  })
  it('records login failure and pauses until explicitly re-enabled', async () => {
    const scan = vi.fn().mockRejectedValue(new SourceScanError('login', '请登录后启用任务。'))
    const { storage, service } = await fixture({ scan })
    await service.createMonitor(request)
    const job = await makeDue(storage)
    const runner = new ScheduleRunner(service)
    await runner.tick()
    await runner.tick()
    expect(scan).toHaveBeenCalledTimes(1)
    const state = await service.state()
    expect(state.jobs[0]).toMatchObject({
      enabled: false,
      nextRunAt: null,
      lastError: '请登录后启用任务。',
    })
    expect(state.runs[0]).toMatchObject({ status: 'failed', error: '请登录后启用任务。' })
    await service.updateJob({ jobId: job.id, enabled: true, intervalMinutes: 60 })
    expect((await service.state()).jobs[0]?.nextRunAt).not.toBeNull()
  })
  it('does not overlap scheduler ticks and preserves a pause made during a scan', async () => {
    let release!: (items: ReturnType<typeof note>[]) => void
    let entered!: () => void
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const scan = vi.fn(() => {
      entered()
      return new Promise<ReturnType<typeof note>[]>((resolve) => {
        release = resolve
      })
    })
    const { storage, service } = await fixture({ scan })
    await service.createMonitor(request)
    const job = await makeDue(storage)
    const runner = new ScheduleRunner(service)
    const pending = runner.tick()
    await started
    await runner.tick()
    await service.updateJob({ jobId: job.id, enabled: false, intervalMinutes: 60 })
    release([note()])
    await pending
    expect(scan).toHaveBeenCalledTimes(1)
    expect((await service.state()).jobs[0]).toMatchObject({ enabled: false, nextRunAt: null })
  })
  it('stores uncertain evidence separately, removes it when resolved and deduplicates future scans', async () => {
    const scan = vi
      .fn()
      .mockResolvedValueOnce([note('same', null)])
      .mockResolvedValueOnce([note('same')])
      .mockResolvedValueOnce([note('same', null)])
    const { service } = await fixture({ scan })
    await service.createMonitor(request)
    const job = (await service.state()).jobs[0]!
    await service.runJob(job.id)
    expect((await service.state()).unverified).toHaveLength(1)
    expect((await service.state()).candidates).toHaveLength(0)
    await service.runJob(job.id)
    expect((await service.state()).unverified).toHaveLength(0)
    expect((await service.state()).candidates).toHaveLength(1)
    await service.runJob(job.id)
    expect((await service.state()).unverified).toHaveLength(0)
    expect((await service.state()).candidates).toHaveLength(1)
  })
  it('records a changed source-file failure without claiming the old cached source is fresh', async () => {
    const { directory, service } = await fixture()
    const path = join(directory, 'notes.json')
    await writeFile(path, JSON.stringify([note()]))
    await service.importFile(path)
    await service.createMonitor({
      ...request,
      source: 'existing',
      sourceRecordId: (await service.state()).sources[0]!.id,
    })
    await writeFile(path, '{bad')
    await expect(service.runJob((await service.state()).jobs[0]!.id)).rejects.toThrow(/Monitoring/u)
    expect((await service.state()).runs[0]?.status).toBe('failed')
    expect((await service.state()).candidates).toHaveLength(0)
  })
  it('loads legacy version-1 workspaces with manual-only schedules and no uncertain records', () => {
    const timestamp = new Date().toISOString()
    const state = workspaceStateSchema.parse({
      schemaVersion: 1,
      sources: [],
      rules: [],
      candidates: [],
      runs: [],
      jobs: [
        {
          id: 'old',
          name: 'old',
          sourceRecordId: 'source',
          ruleId: 'rule',
          enabled: true,
          createdAt: timestamp,
          updatedAt: timestamp,
          lastRunAt: null,
        },
      ],
    })
    expect(state.unverified).toEqual([])
    expect(state.jobs[0]).toMatchObject({ intervalMinutes: null, nextRunAt: null })
  })
})
