import { createHash } from 'node:crypto'
import type { NormalizedContent, RuleSet } from './types'

export function normalizeText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim()
}

export function fingerprintFor(item: NormalizedContent, mode: RuleSet['deduplication']): string {
  let identity: string

  if (mode === 'id') {
    identity = `${item.source}\n${item.id}`
  } else if (mode === 'url' && item.url) {
    identity = item.url
  } else {
    identity = [item.source, item.title, item.content].map(normalizeText).join('\n')
  }

  return createHash('sha256').update(identity, 'utf8').digest('hex')
}

export class ContentDeduplicator {
  readonly #seen: Set<string>

  constructor(existing: Iterable<string> = []) {
    this.#seen = new Set(existing)
  }

  checkAndAdd(fingerprint: string): boolean {
    if (this.#seen.has(fingerprint)) return true
    this.#seen.add(fingerprint)
    return false
  }

  snapshot(): Set<string> {
    return new Set(this.#seen)
  }
}
