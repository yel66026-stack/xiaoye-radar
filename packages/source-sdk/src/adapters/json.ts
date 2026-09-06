import { readFile } from 'node:fs/promises'
import type { NormalizedContent } from '@xiaoye-radar/core'
import { z } from 'zod'
import { FileAdapterBase, fileAdapterConfigSchema } from '../file-adapter-base'
import { asRecord, normalizeRecord } from '../helpers'
import type { AdapterValidation } from '../types'

export interface JsonAdapterConfig {
  path: string
  sourceName?: string
  itemsProperty?: string
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

const jsonAdapterConfigSchema = fileAdapterConfigSchema.extend({
  itemsProperty: z.string().trim().min(1).max(120).optional(),
  mapping: mappingSchema.optional(),
})

export class JsonSourceAdapter extends FileAdapterBase<JsonAdapterConfig> {
  readonly kind = 'json'

  override validateConfig(config: unknown): AdapterValidation {
    const result = jsonAdapterConfigSchema.safeParse(config)
    return result.success
      ? { valid: true, errors: [] }
      : { valid: false, errors: result.error.issues.map((issue) => issue.message) }
  }

  async fetch(): Promise<NormalizedContent[]> {
    const config = this.requireConfig()
    const parsed: unknown = JSON.parse(await readFile(config.path, 'utf8'))
    const value = config.itemsProperty ? asRecord(parsed)[config.itemsProperty] : parsed
    const items = Array.isArray(value) ? value : asRecord(value).items
    if (!Array.isArray(items))
      throw new Error('JSON source must be an array or contain an items array')
    return items.map((item, index) => this.normalize(item, index))
  }

  normalize(raw: unknown, index: number): NormalizedContent {
    const config = this.requireConfig()
    return normalizeRecord(raw, index, this.sourceName(), config.mapping)
  }
}
