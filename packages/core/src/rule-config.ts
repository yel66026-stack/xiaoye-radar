import { createHash } from 'node:crypto'
import YAML from 'yaml'
import { ruleRevisionFor } from './rule-revision'
import { ruleSetSchema, type RuleSet } from './types'

type UnknownRecord = Record<string, unknown>

const ruleDocumentKeys = new Set([
  'id',
  'name',
  'description',
  'enabled',
  'priority',
  'include',
  'exclude',
  'text_contains',
  'textContains',
  'regex',
  'source_filter',
  'sourceFilters',
  'time_window',
  'timeWindow',
  'timeWindowDays',
  'minimum_score',
  'minimumScore',
  'basic_score',
  'basicScore',
  'score',
  'keywordScores',
  'deduplication',
  'createdAt',
  'updatedAt',
])

function asRecord(value: unknown): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as UnknownRecord
}

function rejectUnknownKeys(
  record: UnknownRecord,
  allowed: ReadonlySet<string>,
  label: string,
): void {
  const unknown = Object.keys(record).filter((key) => !allowed.has(key))
  if (unknown.length > 0)
    throw new Error(`${label} contains unknown field(s): ${unknown.join(', ')}`)
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ]
}

function slug(value: string): string {
  const candidate = value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 64)
  return candidate || 'community-rule'
}

export function parseRuleDocument(document: string, now = new Date()): RuleSet {
  const parsed = YAML.parseDocument(document)
  if (parsed.errors.length > 0) {
    throw new Error(
      `Rule document is invalid: ${parsed.errors[0]?.message ?? 'unknown YAML error'}`,
    )
  }

  const raw = asRecord(parsed.toJS({ maxAliasCount: 20 }))
  const timeWindow = asRecord(raw.time_window ?? raw.timeWindow)
  rejectUnknownKeys(raw, ruleDocumentKeys, 'Rule document')
  rejectUnknownKeys(timeWindow, new Set(['days']), 'Rule time window')
  const score = asRecord(raw.score ?? raw.keywordScores)
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  const timestamp = now.toISOString()
  const digest = createHash('sha256').update(document, 'utf8').digest('hex').slice(0, 8)
  const regex = uniqueStrings(raw.regex)
  if (regex.length > 0) {
    throw new Error(
      'Regular-expression rules are disabled in v0.4.0 until hard-timeout isolation is available',
    )
  }

  const keywordScores = Object.fromEntries(
    Object.entries(score).filter(
      (entry): entry is [string, number] =>
        entry[0].trim().length > 0 && typeof entry[1] === 'number' && Number.isFinite(entry[1]),
    ),
  )

  const rule = {
    id:
      typeof raw.id === 'string' && raw.id.trim()
        ? raw.id.trim()
        : `${slug(name || 'community-rule')}-${digest}`,
    name,
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    priority: raw.priority ?? 'normal',
    include: uniqueStrings(raw.include),
    exclude: uniqueStrings(raw.exclude),
    textContains: uniqueStrings(raw.text_contains ?? raw.textContains),
    regex,
    sourceFilters: uniqueStrings(raw.source_filter ?? raw.sourceFilters),
    timeWindowDays:
      typeof timeWindow.days === 'number'
        ? timeWindow.days
        : typeof raw.timeWindowDays === 'number'
          ? raw.timeWindowDays
          : null,
    minimumScore:
      typeof raw.minimum_score === 'number'
        ? raw.minimum_score
        : typeof raw.minimumScore === 'number'
          ? raw.minimumScore
          : 1,
    basicScore:
      typeof raw.basic_score === 'number'
        ? raw.basic_score
        : typeof raw.basicScore === 'number'
          ? raw.basicScore
          : 0,
    keywordScores,
    deduplication: raw.deduplication ?? 'content',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : timestamp,
    updatedAt: timestamp,
  }

  const validated = ruleSetSchema.parse(rule)
  return ruleSetSchema.parse({ ...validated, revision: ruleRevisionFor(validated) })
}
