import {
  candidateSchema,
  normalizedContentSchema,
  ruleSetSchema,
  scanRunSchema,
} from '@xiaoye-radar/core'
import { z } from 'zod'

export const sourceRecordSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9-]+$/u),
    name: z.string().min(1).max(120),
    adapterKind: z.enum(['csv', 'json', 'rss', 'local-file']),
    itemCount: z.number().int().nonnegative(),
    importedAt: z.string().datetime({ offset: true }),
    health: z.enum(['healthy', 'error']).default('healthy'),
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
  }
}
