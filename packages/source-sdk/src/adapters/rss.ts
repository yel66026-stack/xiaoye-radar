import { XMLParser, XMLValidator } from 'fast-xml-parser'
import type { NormalizedContent } from '@xiaoye-radar/core'
import { FileAdapterBase } from '../file-adapter-base'
import {
  asArray,
  asRecord,
  firstValue,
  normalizeRecord,
  readUtf8SourceFile,
  SourceAdapterError,
  stringValue,
  throwInvalidSourceContent,
} from '../helpers'

export class RssSourceAdapter extends FileAdapterBase {
  readonly kind = 'rss'

  async fetch(): Promise<NormalizedContent[]> {
    const config = this.requireConfig()
    try {
      const xml = await readUtf8SourceFile(config.path)
      if (XMLValidator.validate(xml) !== true) {
        throw new SourceAdapterError(
          'invalid-content',
          'The RSS or Atom source is malformed. Check its XML syntax and retry.',
        )
      }
      const parsed = asRecord(
        new XMLParser({ ignoreAttributes: false, processEntities: false, trimValues: true }).parse(
          xml,
        ),
      )
      const rssItems = asRecord(asRecord(parsed.rss).channel).item
      const atomEntries = asRecord(parsed.feed).entry
      const items = asArray(rssItems ?? atomEntries)
      if (items.length === 0) {
        throw new SourceAdapterError(
          'invalid-content',
          'The RSS or Atom source contains no entries. Add at least one item or entry and retry.',
        )
      }
      return items.map((item, index) => this.normalize(item, index))
    } catch (error) {
      throwInvalidSourceContent(
        error,
        'The RSS or Atom source is malformed. Check its XML syntax and retry.',
      )
    }
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
