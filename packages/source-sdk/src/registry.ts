import { extname } from 'node:path'
import { CsvSourceAdapter } from './adapters/csv'
import { JsonSourceAdapter } from './adapters/json'
import { LocalFileSourceAdapter } from './adapters/local-file'
import { RssSourceAdapter } from './adapters/rss'
import { SourceAdapterError } from './helpers'
import type { SourceAdapter } from './types'

export function adapterForPath(path: string): SourceAdapter {
  switch (extname(path).toLocaleLowerCase()) {
    case '.csv':
      return new CsvSourceAdapter()
    case '.json':
      return new JsonSourceAdapter()
    case '.rss':
    case '.xml':
    case '.atom':
      return new RssSourceAdapter()
    case '.md':
    case '.txt':
      return new LocalFileSourceAdapter()
    default:
      throw new SourceAdapterError(
        'unsupported',
        'Unsupported source type. Choose a CSV, JSON, RSS/Atom, Markdown, or text file.',
      )
  }
}

export class SourceAdapterRegistry {
  readonly #factories = new Map<string, () => SourceAdapter>()

  register(kind: string, factory: () => SourceAdapter): void {
    if (!kind.trim()) throw new Error('Adapter kind is required')
    if (this.#factories.has(kind)) throw new Error(`Adapter kind is already registered: ${kind}`)
    this.#factories.set(kind, factory)
  }

  create(kind: string): SourceAdapter {
    const factory = this.#factories.get(kind)
    if (!factory) throw new Error(`Unknown adapter kind: ${kind}`)
    return factory()
  }

  kinds(): string[] {
    return [...this.#factories.keys()].sort()
  }
}
