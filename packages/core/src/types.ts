import { z } from 'zod'

export const LEGACY_RULE_REVISION = '0'.repeat(64)
export const ruleRevisionSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/u)
  .default(LEGACY_RULE_REVISION)

export const metadataSchema = z.record(z.string(), z.unknown())

export const normalizedContentSchema = z
  .object({
    id: z.string().min(1),
    source: z.string().min(1),
    title: z.string().default(''),
    content: z.string().default(''),
    author: z.string().nullable().default(null),
    publishedAt: z.string().datetime({ offset: true }).nullable().default(null),
    url: z.string().url().nullable().default(null),
    metadata: metadataSchema.default({}),
  })
  .strict()

export type NormalizedContent = z.infer<typeof normalizedContentSchema>

export const rulePrioritySchema = z.enum(['low', 'normal', 'high', 'critical'])
export type RulePriority = z.infer<typeof rulePrioritySchema>

const keywordListSchema = z.array(z.string().trim().min(1).max(160)).max(250)

export const ruleSetSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(120),
    description: z.string().max(500).default(''),
    enabled: z.boolean().default(true),
    priority: rulePrioritySchema.default('normal'),
    include: keywordListSchema.default([]),
    exclude: keywordListSchema.default([]),
    textContains: keywordListSchema.default([]),
    regex: z.array(z.string().min(1).max(120)).max(0).default([]),
    sourceFilters: keywordListSchema.default([]),
    timeWindowDays: z.number().positive().max(3650).nullable().default(null),
    minimumScore: z.number().int().min(0).max(100).default(1),
    basicScore: z.number().int().min(0).max(100).default(0),
    keywordScores: z.record(z.string().min(1), z.number().int().min(-100).max(100)).default({}),
    deduplication: z.enum(['id', 'url', 'content']).default('content'),
    revision: ruleRevisionSchema,
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict()

export type RuleSet = z.infer<typeof ruleSetSchema>

export const decisionOutcomeSchema = z.enum([
  'candidate',
  'duplicate',
  'excluded',
  'filtered_disabled',
  'filtered_source',
  'filtered_time',
  'filtered_include',
  'filtered_text',
  'filtered_regex',
  'filtered_score',
])

export type DecisionOutcome = z.infer<typeof decisionOutcomeSchema>

export const reviewStatusSchema = z.enum(['pending', 'approved', 'rejected', 'archived'])
export type ReviewStatus = z.infer<typeof reviewStatusSchema>

export const candidateSchema = z
  .object({
    id: z.string().min(1),
    runId: z.string().min(1),
    ruleId: z.string().min(1),
    ruleRevision: ruleRevisionSchema,
    sourceRecordId: z.string().min(1),
    item: normalizedContentSchema,
    fingerprint: z.string().length(64),
    score: z.number().int().min(0).max(100),
    priority: rulePrioritySchema,
    matchedKeywords: z.array(z.string()),
    reasons: z.array(z.string()),
    reviewStatus: reviewStatusSchema.default('pending'),
    reviewNote: z.string().max(2000).default(''),
    reviewedAt: z.string().datetime({ offset: true }).nullable().default(null),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict()

export type Candidate = z.infer<typeof candidateSchema>

export interface RuleDecision {
  item: NormalizedContent
  fingerprint: string
  outcome: DecisionOutcome
  score: number
  matchedKeywords: string[]
  reasons: string[]
}

export interface MonitorStats {
  total: number
  candidates: number
  duplicates: number
  excluded: number
  timeFiltered: number
  ruleFiltered: number
}

export interface MonitorResult {
  decisions: RuleDecision[]
  candidates: Candidate[]
  stats: MonitorStats
}

export const scanRunSchema = z
  .object({
    id: z.string().min(1),
    sourceRecordId: z.string().min(1),
    sourceName: z.string().min(1),
    ruleId: z.string().min(1),
    ruleRevision: ruleRevisionSchema,
    ruleName: z.string().min(1),
    startedAt: z.string().datetime({ offset: true }),
    finishedAt: z.string().datetime({ offset: true }),
    status: z.enum(['success', 'failed']),
    stats: z.object({
      total: z.number().int().nonnegative(),
      candidates: z.number().int().nonnegative(),
      duplicates: z.number().int().nonnegative(),
      excluded: z.number().int().nonnegative(),
      timeFiltered: z.number().int().nonnegative(),
      ruleFiltered: z.number().int().nonnegative(),
    }),
    error: z.string().nullable().default(null),
  })
  .strict()

export type ScanRun = z.infer<typeof scanRunSchema>
