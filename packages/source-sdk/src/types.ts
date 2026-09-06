import type { NormalizedContent } from '@xiaoye-radar/core'

export interface AdapterValidation {
  valid: boolean
  errors: string[]
}

export interface AdapterHealth {
  healthy: boolean
  message: string
  checkedAt: string
}

export interface SourceAdapter<TConfig = unknown, TRaw = unknown> {
  readonly kind: string
  initialize(config: TConfig): Promise<void>
  validateConfig(config: unknown): AdapterValidation
  fetch(): Promise<NormalizedContent[]>
  normalize(raw: TRaw, index: number): NormalizedContent
  healthCheck(): Promise<AdapterHealth>
  dispose(): Promise<void>
}

export interface FileAdapterConfig {
  path: string
  sourceName?: string
}
