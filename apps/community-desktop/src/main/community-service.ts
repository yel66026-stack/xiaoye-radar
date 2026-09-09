import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  RuleEngine,
  parseRuleDocument,
  type MonitorStats,
  type ReviewStatus,
  type ScanRun,
} from '@xiaoye-radar/core'
import { reviewCandidate } from '@xiaoye-radar/review-engine'
import { adapterForPath } from '@xiaoye-radar/source-sdk'
import {
  monitoringJobSchema,
  type JsonFileStorage,
  type WorkspaceState,
} from '@xiaoye-radar/storage'

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
}

const SAFE_MONITORING_ERROR =
  'Monitoring could not be completed. Check the imported source and rule, then try again.'

export class CommunityService {
  readonly #storage: JsonFileStorage
  readonly #examplesRoot: string
  readonly #engine = new RuleEngine()

  constructor(storage: JsonFileStorage, examplesRoot: string) {
    this.#storage = storage
    this.#examplesRoot = examplesRoot
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
      if (!health.healthy) throw new Error(health.message)
      const items = await adapter.fetch()
      if (items.length === 0) throw new Error('The source did not produce any content items')
      await this.#storage.upsertSource(
        {
          id: options.id,
          name: options.sourceName ?? basename(path).replace(/\.[^.]+$/u, ''),
          adapterKind: adapterKind(adapter.kind),
          fileName: basename(path),
        },
        items,
      )
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

  async run(sourceRecordId: string, ruleId: string): Promise<void> {
    const state = await this.#storage.read()
    const source = state.sources.find(({ id }) => id === sourceRecordId)
    const rule = state.rules.find(({ id }) => id === ruleId)
    if (!source) throw new Error('Source not found')
    if (!rule) throw new Error('Rule not found')

    const runId = randomUUID()
    const startedAt = new Date().toISOString()
    let failureStats: MonitorStats = { ...EMPTY_MONITOR_STATS }

    try {
      await this.ensureJob(sourceRecordId, ruleId)
      const items = await this.#storage.loadSourceItems(sourceRecordId)
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
      await this.#storage.recordRun(run, result.candidates)
    } catch {
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
        error: SAFE_MONITORING_ERROR,
      }
      try {
        await this.#storage.recordRun(failedRun, [])
      } catch {
        throw new Error(
          'Monitoring failed and its history could not be saved. Restart the app and try again.',
        )
      }
      throw new Error(SAFE_MONITORING_ERROR)
    }
  }

  async review(candidateId: string, status: ReviewStatus, note: string): Promise<void> {
    const state = await this.#storage.read()
    const candidate = state.candidates.find(({ id }) => id === candidateId)
    if (!candidate) throw new Error('Candidate not found')
    await this.#storage.updateCandidate(reviewCandidate(candidate, status, note))
  }
}
