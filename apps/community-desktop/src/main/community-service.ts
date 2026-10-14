import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  RuleEngine,
  parseRuleDocument,
  type MonitorStats,
  type ReviewStatus,
  type ScanRun,
  type NormalizedContent,
} from '@xiaoye-radar/core'
import { reviewCandidate } from '@xiaoye-radar/review-engine'
import {
  adapterForPath,
  safeSourceImportMessage,
  SourceAdapterError,
} from '@xiaoye-radar/source-sdk'
import {
  monitoringJobSchema,
  type JsonFileStorage,
  type WorkspaceState,
} from '@xiaoye-radar/storage'
import {
  createMonitorSchema,
  updateJobSchema,
  type CreateMonitorRequest,
} from '../shared/monitoring-config'
import type { LiveContentCollector } from './xiaohongshu-browser'
import { SourceScanError } from './xiaohongshu-content'

function adapterKind(kind: string): 'csv' | 'json' | 'rss' | 'local-file' {
  if (kind === 'csv' || kind === 'json' || kind === 'rss' || kind === 'local-file') return kind
  throw new Error(`Unsupported public adapter kind: ${kind}`)
}

const EMPTY_MONITOR_STATS: Readonly<MonitorStats> = {
  total: 0,
  candidates: 0,
  duplicates: 0,
  excluded: 0,
  timeFiltered: 0,
  ruleFiltered: 0,
  regionFiltered: 0,
  unverified: 0,
}

const SAFE_MONITORING_ERROR =
  'Monitoring could not be completed. Check the imported source and rule, then try again.'

export class CommunityService {
  readonly #storage: JsonFileStorage
  readonly #examplesRoot: string
  readonly #engine = new RuleEngine()
  readonly #collector: LiveContentCollector | undefined
  readonly #running = new Set<string>()

  constructor(storage: JsonFileStorage, examplesRoot: string, collector?: LiveContentCollector) {
    this.#storage = storage
    this.#examplesRoot = examplesRoot
    this.#collector = collector
  }

  get dataPath(): string {
    return this.#storage.rootPath
  }

  async initialize(): Promise<void> {
    await this.#storage.initialize()
  }

  async state(): Promise<WorkspaceState> {
    return this.#storage.read()
  }

  async importFile(
    path: string,
    options: { id?: string; sourceName?: string } = {},
  ): Promise<void> {
    const adapter = adapterForPath(path)
    try {
      await adapter.initialize({ path, sourceName: options.sourceName })
      const health = await adapter.healthCheck()
      if (!health.healthy) throw new SourceAdapterError('unreadable', health.message)
      const items = await adapter.fetch()
      if (items.length === 0) {
        throw new SourceAdapterError(
          'invalid-content',
          'The selected source contains no content items. Add at least one record and retry.',
        )
      }
      await this.#storage.upsertSource(
        {
          id: options.id,
          name: options.sourceName ?? basename(path).replace(/\.[^.]+$/u, ''),
          adapterKind: adapterKind(adapter.kind),
          fileName: basename(path),
          health: 'healthy',
          healthMessage: `${adapter.kind.toUpperCase()} adapter check passed; ${String(items.length)} item${items.length === 1 ? '' : 's'} normalized.`,
          healthCheckedAt: new Date().toISOString(),
          refreshPath: path,
        },
        items,
      )
    } catch (error) {
      throw new Error(safeSourceImportMessage(error), { cause: error })
    } finally {
      await adapter.dispose()
    }
  }

  async saveRule(document: string): Promise<void> {
    const rule = parseRuleDocument(document)
    await this.#storage.saveRule(rule)
  }

  async importDemo(): Promise<void> {
    await this.#importBundledExample({
      directory: 'demo-monitoring',
      dataFile: 'demo-data.json',
      ruleFile: 'demo-rule.yml',
      sourceId: 'demo-monitoring',
      sourceName: 'Demo monitoring',
      ruleId: 'demo-monitoring-rule',
      jobName: 'Demo monitoring workflow',
    })
  }

  async importLegalInquiryExample(): Promise<void> {
    await this.#importBundledExample({
      directory: 'legal-inquiry-triage',
      dataFile: join('data', 'legal-inquiry-synthetic.json'),
      ruleFile: join('rules', 'legal-inquiry-basic.yaml'),
      sourceId: 'legal-inquiry-triage',
      sourceName: 'Legal Inquiry Triage',
      ruleId: 'legal-inquiry-basic',
      jobName: 'Legal inquiry triage workflow',
    })
  }

  async #importBundledExample(options: {
    directory: string
    dataFile: string
    ruleFile: string
    sourceId: string
    sourceName: string
    ruleId: string
    jobName: string
  }): Promise<void> {
    const dataPath = join(this.#examplesRoot, options.directory, options.dataFile)
    const rulePath = join(this.#examplesRoot, options.directory, options.ruleFile)
    const adapter = adapterForPath(dataPath)
    try {
      await adapter.initialize({ path: dataPath, sourceName: options.sourceName })
      const importedAt = Date.now()
      const items = (await adapter.fetch()).map((item) => {
        const relativeHours = item.metadata.relativeHours
        return typeof relativeHours === 'number'
          ? {
              ...item,
              publishedAt: new Date(importedAt - relativeHours * 60 * 60 * 1000).toISOString(),
            }
          : item
      })
      await this.#storage.upsertSource(
        {
          id: options.sourceId,
          name: options.sourceName,
          adapterKind: 'json',
          fileName: basename(dataPath),
        },
        items,
      )
    } finally {
      await adapter.dispose()
    }
    await this.saveRule(await readFile(rulePath, 'utf8'))
    await this.ensureJob(options.sourceId, options.ruleId, options.jobName)
    await this.run(options.sourceId, options.ruleId)
  }

  async ensureJob(sourceRecordId: string, ruleId: string, name?: string): Promise<void> {
    const state = await this.#storage.read()
    const existing = state.jobs.find(
      (job) => job.sourceRecordId === sourceRecordId && job.ruleId === ruleId,
    )
    if (existing) return
    const now = new Date().toISOString()
    await this.#storage.saveJob(
      monitoringJobSchema.parse({
        id: randomUUID(),
        name:
          name ?? `${state.sources.find(({ id }) => id === sourceRecordId)?.name ?? 'Source'} scan`,
        sourceRecordId,
        ruleId,
        enabled: true,
        createdAt: now,
        updatedAt: now,
        lastRunAt: null,
      }),
    )
  }

  async createMonitor(request: CreateMonitorRequest): Promise<void> {
    const input = createMonitorSchema.parse(request)
    const id = randomUUID()
    const sourceRecordId = input.source === 'xiaohongshu' ? `xhs-${id}` : input.sourceRecordId
    if (input.source === 'xiaohongshu') {
      await this.#storage.upsertSource(
        {
          id: sourceRecordId,
          name: `小红书 · ${input.name}`,
          adapterKind: 'xiaohongshu',
          fileName: '小红书网页搜索',
          healthMessage: '等待首次扫描；请先在小红书窗口登录。',
        },
        [],
      )
    } else if (
      !(await this.state()).sources.some(
        (source) => source.id === sourceRecordId && source.adapterKind !== 'xiaohongshu',
      )
    ) {
      throw new Error('请选择已经导入的本地数据源。')
    }
    const ruleId = `monitor-${id}`
    await this.saveRule(
      JSON.stringify({
        id: ruleId,
        name: input.name,
        include: [...new Set(input.keywords)],
        include_mode: input.includeMode,
        region: { province: input.province, cities: input.cities },
        time_window:
          input.timeMode === 'rolling'
            ? { days: input.days }
            : {
                start: `${input.startDate}T00:00:00+08:00`,
                end: `${input.endDate}T23:59:59.999+08:00`,
              },
        basic_score: 1,
        minimum_score: 1,
        deduplication: 'id',
      }),
    )
    const now = new Date().toISOString()
    await this.#storage.saveJob(
      monitoringJobSchema.parse({
        id,
        name: input.name,
        sourceRecordId,
        ruleId,
        intervalMinutes: input.intervalMinutes,
        maxNotes: input.maxNotes,
        createdAt: now,
        updatedAt: now,
        nextRunAt:
          input.intervalMinutes === null
            ? null
            : new Date(Date.now() + input.intervalMinutes * 60000).toISOString(),
      }),
    )
  }

  async updateJob(request: unknown): Promise<void> {
    const input = updateJobSchema.parse(request)
    const job = (await this.state()).jobs.find(({ id }) => id === input.jobId)
    if (!job) throw new Error('任务不存在。')
    await this.#storage.saveJob({
      ...job,
      enabled: input.enabled,
      intervalMinutes: input.intervalMinutes,
      updatedAt: new Date().toISOString(),
      lastError: input.enabled ? null : job.lastError,
      nextRunAt:
        input.enabled && input.intervalMinutes !== null
          ? new Date(Date.now() + input.intervalMinutes * 60000).toISOString()
          : null,
    })
  }

  async runJob(jobId: string): Promise<void> {
    const job = (await this.state()).jobs.find(({ id }) => id === jobId)
    if (!job) throw new Error('任务不存在。')
    await this.run(job.sourceRecordId, job.ruleId)
  }

  async run(sourceRecordId: string, ruleId: string): Promise<void> {
    const state = await this.#storage.read()
    const source = state.sources.find(({ id }) => id === sourceRecordId)
    const rule = state.rules.find(({ id }) => id === ruleId)
    if (!source) throw new Error('Source not found')
    if (!rule) throw new Error('Rule not found')
    if (this.#running.has(sourceRecordId)) throw new Error('该数据源正在扫描，请等待当前扫描完成。')
    this.#running.add(sourceRecordId)

    const runId = randomUUID()
    const startedAt = new Date().toISOString()
    let failureStats: MonitorStats = { ...EMPTY_MONITOR_STATS }

    try {
      await this.ensureJob(sourceRecordId, ruleId)
      let items: NormalizedContent[]
      if (source.adapterKind === 'xiaohongshu') {
        if (!this.#collector) throw new SourceScanError('layout', '小红书浏览器尚未初始化。')
        const job = state.jobs.find(
          (entry) => entry.sourceRecordId === sourceRecordId && entry.ruleId === ruleId,
        )
        items = await this.#collector.scan(rule, job?.maxNotes ?? 30)
        await this.#storage.upsertSource(
          {
            ...source,
            health: 'healthy',
            healthMessage: `已读取 ${items.length} 条可访问笔记；地区和日期将由规则再次筛选。`,
            healthCheckedAt: new Date().toISOString(),
          },
          items,
        )
      } else {
        if (source.refreshPath)
          await this.importFile(source.refreshPath, { id: source.id, sourceName: source.name })
        items = await this.#storage.loadSourceItems(sourceRecordId)
      }
      const result = this.#engine.process(items, rule, {
        existingFingerprints: await this.#storage.existingFingerprints(
          sourceRecordId,
          ruleId,
          rule.revision,
        ),
        runId,
        sourceRecordId,
      })
      failureStats = result.stats
      const finishedAt = new Date().toISOString()
      const run: ScanRun = {
        id: runId,
        sourceRecordId,
        sourceName: source.name,
        ruleId,
        ruleRevision: rule.revision,
        ruleName: rule.name,
        startedAt,
        finishedAt,
        status: 'success',
        stats: result.stats,
        error: null,
      }
      await this.#storage.recordRun(run, result.candidates, result.unverified)
    } catch (error) {
      const message = error instanceof SourceScanError ? error.message : SAFE_MONITORING_ERROR
      const failedRun: ScanRun = {
        id: runId,
        sourceRecordId,
        sourceName: source.name,
        ruleId,
        ruleRevision: rule.revision,
        ruleName: rule.name,
        startedAt,
        finishedAt: new Date().toISOString(),
        status: 'failed',
        stats: failureStats,
        error: message,
      }
      try {
        await this.#storage.recordRun(failedRun, [])
        if (
          error instanceof SourceScanError &&
          ['login', 'verification', 'layout'].includes(error.code)
        ) {
          const failedJobs = (await this.state()).jobs.filter(
            (job) => job.sourceRecordId === sourceRecordId && job.ruleId === ruleId,
          )
          for (const job of failedJobs)
            await this.#storage.saveJob({
              ...job,
              enabled: false,
              nextRunAt: null,
              lastError: message,
            })
        }
      } catch {
        throw new Error(
          'Monitoring failed and its history could not be saved. Restart the app and try again.',
        )
      }
      throw new Error(message, { cause: error })
    } finally {
      this.#running.delete(sourceRecordId)
    }
  }

  async review(candidateId: string, status: ReviewStatus, note: string): Promise<void> {
    const state = await this.#storage.read()
    const candidate = state.candidates.find(({ id }) => id === candidateId)
    if (!candidate) throw new Error('Candidate not found')
    await this.#storage.updateCandidate(reviewCandidate(candidate, status, note))
  }
}
