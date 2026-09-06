import { access } from 'node:fs/promises'
import { z } from 'zod'
import { defaultSourceName, validateReadableFile } from './helpers'
import type { AdapterHealth, AdapterValidation, FileAdapterConfig } from './types'

export const fileAdapterConfigSchema = z
  .object({
    path: z.string().min(1),
    sourceName: z.string().trim().min(1).max(120).optional(),
  })
  .strict()

export abstract class FileAdapterBase<TConfig extends FileAdapterConfig = FileAdapterConfig> {
  abstract readonly kind: string
  protected config: TConfig | null = null

  async initialize(config: TConfig): Promise<void> {
    const result = this.validateConfig(config)
    if (!result.valid) throw new Error(result.errors.join('; '))
    await validateReadableFile(config.path)
    this.config = config
  }

  validateConfig(config: unknown): AdapterValidation {
    const result = fileAdapterConfigSchema.safeParse(config)
    return result.success
      ? { valid: true, errors: [] }
      : { valid: false, errors: result.error.issues.map((issue) => issue.message) }
  }

  protected requireConfig(): TConfig {
    if (!this.config) throw new Error(`${this.kind} adapter is not initialized`)
    return this.config
  }

  protected sourceName(): string {
    const config = this.requireConfig()
    return config.sourceName ?? defaultSourceName(config.path)
  }

  async healthCheck(): Promise<AdapterHealth> {
    const checkedAt = new Date().toISOString()
    try {
      const config = this.requireConfig()
      await access(config.path)
      await validateReadableFile(config.path)
      return { healthy: true, message: 'Source file is readable', checkedAt }
    } catch (error) {
      return { healthy: false, message: (error as Error).message, checkedAt }
    }
  }

  dispose(): Promise<void> {
    this.config = null
    return Promise.resolve()
  }
}
