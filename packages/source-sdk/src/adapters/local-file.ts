import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { normalizedContentSchema, type NormalizedContent } from '@xiaoye-radar/core'
import { FileAdapterBase } from '../file-adapter-base'

export class LocalFileSourceAdapter extends FileAdapterBase {
  readonly kind = 'local-file'

  async fetch(): Promise<NormalizedContent[]> {
    const config = this.requireConfig()
    const text = await readFile(config.path, 'utf8')
    const blocks = text
      .split(/\r?\n\s*\r?\n/gu)
      .map((block) => block.trim())
      .filter(Boolean)
    if (blocks.length === 0) throw new Error('Local text source is empty')
    return blocks.map((block, index) => this.normalize(block, index))
  }

  normalize(raw: string, index: number): NormalizedContent {
    const config = this.requireConfig()
    const [firstLine = '', ...rest] = raw.split(/\r?\n/gu)
    const title = firstLine
      .replace(/^#{1,6}\s*/u, '')
      .trim()
      .slice(0, 240)
    const content = rest.join('\n').trim() || firstLine.trim()
    const id = createHash('sha256')
      .update(`${config.path}\n${index}\n${raw}`, 'utf8')
      .digest('hex')
      .slice(0, 24)
    return normalizedContentSchema.parse({
      id,
      source: this.sourceName(),
      title,
      content,
      author: null,
      publishedAt: null,
      url: null,
      metadata: { fileName: basename(config.path), block: index + 1 },
    })
  }
}
