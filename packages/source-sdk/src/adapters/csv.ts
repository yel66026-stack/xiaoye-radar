import { readFile } from 'node:fs/promises'
import { parse } from 'csv-parse/sync'
import type { NormalizedContent } from '@xiaoye-radar/core'
import { z } from 'zod'
import { FileAdapterBase, fileAdapterConfigSchema } from '../file-adapter-base'
import { normalizeRecord, type UnknownRecord } from '../helpers'
import type { AdapterValidation } from '../types'

export interface CsvAdapterConfig {
  path: string
  sourceName?: string
  mapping?: Partial<Record<'id' | 'title' | 'content' | 'author' | 'publishedAt' | 'url', string>>
}

const mappingSchema = z
  .object({
    id: z.string().trim().min(1).max(120).optional(),
    title: z.string().trim().min(1).max(120).optional(),
    content: z.string().trim().min(1).max(120).optional(),
    author: z.string().trim().min(1).max(120).optional(),
    publishedAt: z.string().trim().min(1).max(120).optional(),
    url: z.string().trim().min(1).max(120).optional(),
  })
  .strict()

const csvAdapterConfigSchema = fileAdapterConfigSchema.extend({ mapping: mappingSchema.optional() })

export class CsvSourceAdapter extends FileAdapterBase<CsvAdapterConfig> {
  readonly kind = 'csv'

  override validateConfig(config: unknown): AdapterValidation {
    const result = csvAdapterConfigSchema.safeParse(config)
    return result.success
      ? { valid: true, errors: [] }
      : { valid: false, errors: result.error.issues.map((issue) => issue.message) }
  }

  async fetch(): Promise<NormalizedContent[]> {
    const config = this.requireConfig()
    const text = await readFile(config.path, 'utf8')
    const rows: UnknownRecord[] = parse(text, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      skip_records_with_empty_values: true,
      trim: true,
    })
    return rows.map((row, index) => this.normalize(row, index))
  }

  normalize(raw: UnknownRecord, index: number): NormalizedContent {
    const config = this.requireConfig()
    return normalizeRecord(raw, index, this.sourceName(), config.mapping)
  }
}
