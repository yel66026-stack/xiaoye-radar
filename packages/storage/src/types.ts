import {
  candidateSchema,
  normalizedContentSchema,
  ruleSetSchema,
  scanRunSchema,
  unverifiedRecordSchema,
} from '@xiaoye-radar/core'
import { z } from 'zod'

export const sourceRecordSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9-]+$/u),
    name: z.string().min(1).max(120),
    adapterKind: z.enum(['csv', 'json', 'rss', 'local-file', 'xiaohongshu']),
    refreshPath: z.string().max(2000).nullable().default(null),
    itemCount: z.number().int().nonnegative(),
    importedAt: z.string().datetime({ offset: true }),
    health: z.enum(['healthy', 'error']).default('healthy'),
    healthMessage: z.string().min(1).max(240).default('Source imported successfully.'),
    healthCheckedAt: z.string().datetime({ offset: true }).nullable().default(null),
    fileName: z.string().min(1).max(260),
  })
  .strict()

export type SourceRecord = z.infer<typeof sourceRecordSchema>

export const monitoringJobSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(120),
    sourceRecordId: z.string().min(1),
    ruleId: z.string().min(1),
    enabled: z.boolean().default(true),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    lastRunAt: z.string().datetime({ offset: true }).nullable().default(null),
    intervalMinutes: z.number().int().min(15).max(10080).nullable().default(null),
    nextRunAt: z.string().datetime({ offset: true }).nullable().default(null),
    lastError: z.string().max(500).nullable().default(null),
    maxNotes: z.number().int().min(1).max(100).default(30),
  })
  .strict()

export type MonitoringJob = z.infer<typeof monitoringJobSchema>

export const workspaceStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    sources: z.array(sourceRecordSchema),
    rules: z.array(ruleSetSchema),
    jobs: z.array(monitoringJobSchema),
    candidates: z.array(candidateSchema),
    runs: z.array(scanRunSchema),
    unverified: z.array(unverifiedRecordSchema).default([]),
  })
  .strict()

export type WorkspaceState = z.infer<typeof workspaceStateSchema>

export const sourceItemsSchema = z.array(normalizedContentSchema)

export function emptyWorkspace(): WorkspaceState {
  return {
    schemaVersion: 1,
    sources: [],
    rules: [],
    jobs: [],
    candidates: [],
    runs: [],
    unverified: [],
  }
}
