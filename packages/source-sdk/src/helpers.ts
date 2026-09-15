import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { normalizedContentSchema, type NormalizedContent } from '@xiaoye-radar/core'

export const MAX_SOURCE_BYTES = 10 * 1024 * 1024

export type SourceAdapterErrorCode =
  | 'empty'
  | 'invalid-content'
  | 'invalid-encoding'
  | 'not-file'
  | 'not-found'
  | 'oversized'
  | 'unreadable'
  | 'unsupported'

export class SourceAdapterError extends Error {
  readonly code: SourceAdapterErrorCode

  constructor(code: SourceAdapterErrorCode, message: string) {
    super(message)
    this.name = 'SourceAdapterError'
    this.code = code
  }
}

const UNKNOWN_IMPORT_ERROR =
  'The selected source could not be imported. Check that it is a supported, valid text file and try again.'

export function safeSourceImportMessage(error: unknown): string {
  return error instanceof SourceAdapterError ? error.message : UNKNOWN_IMPORT_ERROR
}

export function throwInvalidSourceContent(error: unknown, message: string): never {
  if (error instanceof SourceAdapterError) throw error
  throw new SourceAdapterError('invalid-content', message)
}

function sourceAccessError(error: unknown): SourceAdapterError {
  const code = (error as NodeJS.ErrnoException | null)?.code
  if (code === 'ENOENT') {
    return new SourceAdapterError(
      'not-found',
      'The selected source file could not be found. Choose it again and retry.',
    )
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return new SourceAdapterError(
      'unreadable',
      'The selected source file cannot be read. Check its permissions and retry.',
    )
  }
  return new SourceAdapterError(
    'unreadable',
    'The selected source file could not be read. Close any app locking it and retry.',
  )
}

export type UnknownRecord = Record<string, unknown>

export function asRecord(value: unknown): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as UnknownRecord
}

export function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

export function firstValue(record: UnknownRecord, candidates: string[]): unknown {
  const entries = new Map(
    Object.entries(record).map(([key, value]) => [key.toLocaleLowerCase(), value]),
  )
  for (const candidate of candidates) {
    const value = entries.get(candidate.toLocaleLowerCase())
    if (value !== undefined && value !== null) return value
  }
  return null
}

export function stringValue(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const record = asRecord(value)
  if (typeof record['#text'] === 'string') return record['#text'].trim()
  return ''
}

export function isoDate(value: unknown): string | null {
  const text = stringValue(value)
  if (!text) return null
  const timestamp = Date.parse(text)
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString()
}

export function webUrl(value: unknown): string | null {
  const text = stringValue(value)
  if (!text) return null
  try {
    const url = new URL(text)
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
      ? url.toString()
      : null
  } catch {
    return null
  }
}

const blockedMetadataKey =
  /password|passwd|cookie|token|authorization|authentication|auth[_-]?state|session|secret|credential|api[_-]?key|private[_-]?key/iu

function sanitizeMetadataValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > 6) return '[metadata depth limit]'
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[circular metadata]'
    seen.add(value)
    return value.slice(0, 1_000).map((entry) => sanitizeMetadataValue(entry, depth + 1, seen))
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular metadata]'
    seen.add(value)
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !blockedMetadataKey.test(key))
        .slice(0, 500)
        .map(([key, entry]) => [key, sanitizeMetadataValue(entry, depth + 1, seen)]),
    )
  }
  return typeof value === 'bigint' ? value.toString() : null
}

export function safeMetadata(record: UnknownRecord, consumed: string[]): UnknownRecord {
  const blocked = new Set(consumed.map((key) => key.toLocaleLowerCase()))
  const retained = Object.fromEntries(
    Object.entries(record).filter(
      ([key]) => !blocked.has(key.toLocaleLowerCase()) && !blockedMetadataKey.test(key),
    ),
  )
  return sanitizeMetadataValue(retained, 0, new WeakSet()) as UnknownRecord
}

export function stableId(source: string, rawId: unknown, fallback: string): string {
  const supplied = stringValue(rawId)
  if (supplied) return supplied.slice(0, 300)
  return createHash('sha256').update(`${source}\n${fallback}`, 'utf8').digest('hex').slice(0, 24)
}

export function normalizeRecord(
  rawValue: unknown,
  index: number,
  source: string,
  mapping: Partial<
    Record<'id' | 'title' | 'content' | 'author' | 'publishedAt' | 'url', string>
  > = {},
): NormalizedContent {
  const raw = asRecord(rawValue)
  const fields = {
    id: [mapping.id, 'id', 'guid', 'uuid', 'source_id'].filter(Boolean) as string[],
    title: [mapping.title, 'title', 'name', 'subject'].filter(Boolean) as string[],
    content: [mapping.content, 'content', 'body', 'text', 'description', 'summary'].filter(
      Boolean,
    ) as string[],
    author: [mapping.author, 'author', 'creator', 'byline'].filter(Boolean) as string[],
    publishedAt: [
      mapping.publishedAt,
      'publishedAt',
      'published_at',
      'pubDate',
      'date',
      'updated',
    ].filter(Boolean) as string[],
    url: [mapping.url, 'url', 'link', 'href'].filter(Boolean) as string[],
  }
  const title = stringValue(firstValue(raw, fields.title))
  const content = stringValue(firstValue(raw, fields.content))
  const author = stringValue(firstValue(raw, fields.author)) || null
  const publishedAt = isoDate(firstValue(raw, fields.publishedAt))
  const url = webUrl(firstValue(raw, fields.url))
  const consumed = Object.values(fields).flat()

  return normalizedContentSchema.parse({
    id: stableId(source, firstValue(raw, fields.id), `${index}\n${title}\n${content}`),
    source,
    title,
    content,
    author,
    publishedAt,
    url,
    metadata: safeMetadata(raw, consumed),
  })
}

export async function validateReadableFile(
  path: string,
  maximum = MAX_SOURCE_BYTES,
): Promise<void> {
  let info
  try {
    info = await stat(path)
  } catch (error) {
    throw sourceAccessError(error)
  }
  if (!info.isFile()) {
    throw new SourceAdapterError('not-file', 'The selected source must be a file, not a folder.')
  }
  if (info.size === 0) {
    throw new SourceAdapterError(
      'empty',
      'The selected source file is empty. Add content and retry.',
    )
  }
  if (info.size > maximum) {
    throw new SourceAdapterError(
      'oversized',
      `The selected source is larger than the ${String(maximum / 1024 / 1024)} MiB import limit.`,
    )
  }
}

export async function readUtf8SourceFile(path: string): Promise<string> {
  let bytes: Buffer
  try {
    bytes = await readFile(path)
  } catch (error) {
    throw sourceAccessError(error)
  }

  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new SourceAdapterError(
      'invalid-encoding',
      'The selected source is not valid UTF-8 text. Save it as UTF-8 and retry.',
    )
  }
  if (!text.trim()) {
    throw new SourceAdapterError(
      'empty',
      'The selected source file is empty. Add content and retry.',
    )
  }
  return text
}

export function defaultSourceName(path: string): string {
  return basename(path).replace(/\.[^.]+$/u, '') || 'local-source'
}
