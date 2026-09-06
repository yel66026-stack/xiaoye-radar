import { readFile } from 'node:fs/promises'
import { XMLParser } from 'fast-xml-parser'
import type { NormalizedContent } from '@xiaoye-radar/core'
import { FileAdapterBase } from '../file-adapter-base'
import { asArray, asRecord, firstValue, normalizeRecord, stringValue } from '../helpers'

export class RssSourceAdapter extends FileAdapterBase {
  readonly kind = 'rss'

  async fetch(): Promise<NormalizedContent[]> {
    const config = this.requireConfig()
    const xml = await readFile(config.path, 'utf8')
    const parsed = asRecord(
      new XMLParser({ ignoreAttributes: false, processEntities: false, trimValues: true }).parse(
        xml,
      ),
    )
    const rssItems = asRecord(asRecord(parsed.rss).channel).item
    const atomEntries = asRecord(parsed.feed).entry
    const items = asArray(rssItems ?? atomEntries)
    if (items.length === 0) throw new Error('RSS or Atom source contains no entries')
    return items.map((item, index) => this.normalize(item, index))
  }

  normalize(rawValue: unknown, index: number): NormalizedContent {
    const raw = asRecord(rawValue)
    const linkValue = firstValue(raw, ['link'])
    const linkRecord = asRecord(linkValue)
    const normalized = {
      ...raw,
      link:
        stringValue(linkValue) ||
        stringValue(linkRecord['@_href']) ||
        stringValue(asRecord(asArray(linkValue)[0])['@_href']),
      content: firstValue(raw, ['content:encoded', 'content', 'description', 'summary']),
      publishedAt: firstValue(raw, ['pubDate', 'published', 'updated', 'dc:date']),
      author:
        firstValue(asRecord(firstValue(raw, ['author'])), ['name']) ?? firstValue(raw, ['author']),
    }
    return normalizeRecord(normalized, index, this.sourceName())
  }
}
