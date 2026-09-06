import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { Candidate, NormalizedContent, RuleSet, ScanRun } from '@xiaoye-radar/core'
import {
  emptyWorkspace,
  monitoringJobSchema,
  sourceItemsSchema,
  sourceRecordSchema,
  workspaceStateSchema,
  type MonitoringJob,
  type SourceRecord,
  type WorkspaceState,
} from './types'

export class JsonFileStorage {
  readonly #root: string
  readonly #workspacePath: string
  readonly #sourcesPath: string
  #tail: Promise<void> = Promise.resolve()

  constructor(root: string) {
    this.#root = root
    this.#workspacePath = join(root, 'workspace.json')
    this.#sourcesPath = join(root, 'sources')
  }

  get rootPath(): string {
    return this.#root
  }

  async initialize(): Promise<void> {
    await mkdir(this.#sourcesPath, { recursive: true })
    try {
      await this.read()
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      await this.#writeWorkspace(emptyWorkspace())
    }
  }

  async read(): Promise<WorkspaceState> {
    const text = await readFile(this.#workspacePath, 'utf8')
    return workspaceStateSchema.parse(JSON.parse(text))
  }

  async upsertSource(
    input: {
      id?: string
      name: string
      adapterKind: SourceRecord['adapterKind']
      fileName: string
    },
    items: NormalizedContent[],
  ): Promise<SourceRecord> {
    return this.#serialized(async () => {
      const state = await this.read()
      const existing = input.id
        ? state.sources.find(({ id }) => id === input.id)
        : state.sources.find(
            ({ name, adapterKind }) => name === input.name && adapterKind === input.adapterKind,
          )
      const id = input.id ?? existing?.id ?? randomUUID()
      const record = sourceRecordSchema.parse({
        id,
        name: input.name,
        adapterKind: input.adapterKind,
        itemCount: items.length,
        importedAt: new Date().toISOString(),
        health: 'healthy',
        fileName: basename(input.fileName),
      })
      await this.#writeJson(join(this.#sourcesPath, `${id}.json`), sourceItemsSchema.parse(items))
      state.sources = [...state.sources.filter((source) => source.id !== id), record]
      await this.#writeWorkspace(state)
      return record
    })
  }

  async loadSourceItems(sourceRecordId: string): Promise<NormalizedContent[]> {
    if (!/^[a-zA-Z0-9-]+$/u.test(sourceRecordId)) throw new Error('Invalid source record ID')
    const text = await readFile(join(this.#sourcesPath, `${sourceRecordId}.json`), 'utf8')
    return sourceItemsSchema.parse(JSON.parse(text))
  }

  async saveRule(rule: RuleSet): Promise<RuleSet> {
    return this.#serialized(async () => {
      const state = await this.read()
      state.rules = [...state.rules.filter(({ id }) => id !== rule.id), rule]
      await this.#writeWorkspace(state)
      return rule
    })
  }

  async saveJob(job: MonitoringJob): Promise<MonitoringJob> {
    return this.#serialized(async () => {
      const state = await this.read()
      const validated = monitoringJobSchema.parse(job)
      state.jobs = [...state.jobs.filter(({ id }) => id !== job.id), validated]
      await this.#writeWorkspace(state)
      return validated
    })
  }

  async recordRun(
    run: ScanRun,
    candidates: Candidate[],
  ): Promise<{ inserted: number; duplicates: number }> {
    return this.#serialized(async () => {
      const state = await this.read()
      if (
        candidates.some(
          (candidate) =>
            candidate.sourceRecordId !== run.sourceRecordId ||
            candidate.ruleId !== run.ruleId ||
            candidate.ruleRevision !== run.ruleRevision,
        )
      ) {
        throw new Error('Candidate scope does not match the scan run')
      }
      const known = new Set(
        state.candidates
          .filter(
            (candidate) =>
              candidate.sourceRecordId === run.sourceRecordId &&
              candidate.ruleId === run.ruleId &&
              candidate.ruleRevision === run.ruleRevision,
          )
          .map(({ fingerprint }) => fingerprint),
      )
      const fresh = candidates.filter(({ fingerprint }) => {
        if (known.has(fingerprint)) return false
        known.add(fingerprint)
        return true
      })
      const duplicates = candidates.length - fresh.length
      state.candidates = [...fresh, ...state.candidates].slice(0, 10_000)
      state.runs = [run, ...state.runs].slice(0, 2_000)
      state.jobs = state.jobs.map((job) =>
        job.sourceRecordId === run.sourceRecordId && job.ruleId === run.ruleId
          ? { ...job, lastRunAt: run.finishedAt, updatedAt: run.finishedAt }
          : job,
      )
      await this.#writeWorkspace(state)
      return { inserted: fresh.length, duplicates }
    })
  }

  async updateCandidate(candidate: Candidate): Promise<Candidate> {
    return this.#serialized(async () => {
      const state = await this.read()
      const index = state.candidates.findIndex(({ id }) => id === candidate.id)
      if (index < 0) throw new Error('Candidate not found')
      state.candidates[index] = candidate
      await this.#writeWorkspace(state)
      return candidate
    })
  }

  async existingFingerprints(
    sourceRecordId: string,
    ruleId: string,
    ruleRevision: string,
  ): Promise<Set<string>> {
    const state = await this.read()
    return new Set(
      state.candidates
        .filter(
          (candidate) =>
            candidate.sourceRecordId === sourceRecordId &&
            candidate.ruleId === ruleId &&
            candidate.ruleRevision === ruleRevision,
        )
        .map(({ fingerprint }) => fingerprint),
    )
  }

  async #serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#tail.then(operation)
    this.#tail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  async #writeWorkspace(state: WorkspaceState): Promise<void> {
    await this.#writeJson(this.#workspacePath, workspaceStateSchema.parse(state))
  }

  async #writeJson(path: string, value: unknown): Promise<void> {
    const temporary = `${path}.${randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    })
    await rename(temporary, path)
  }
}
