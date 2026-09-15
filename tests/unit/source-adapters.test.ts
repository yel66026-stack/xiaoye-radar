import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CsvSourceAdapter,
  JsonSourceAdapter,
  LocalFileSourceAdapter,
  MAX_SOURCE_BYTES,
  RssSourceAdapter,
  adapterForPath,
  validateReadableFile,
} from '@xiaoye-radar/source-sdk'

const temporaryDirectories: string[] = []

async function fixture(name: string, content: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'xiaoye-source-test-'))
  temporaryDirectories.push(directory)
  const path = join(directory, name)
  await writeFile(path, content, 'utf8')
  return path
}

async function binaryFixture(name: string, content: Uint8Array): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'xiaoye-source-test-'))
  temporaryDirectories.push(directory)
  const path = join(directory, name)
  await writeFile(path, content)
  return path
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  )
})

describe('public source adapters', () => {
  it('parses and normalizes CSV', async () => {
    const path = await fixture(
      'items.csv',
      'id,title,content,author,publishedAt,url\n1,Hello,Need help,Synthetic,2026-09-06T10:00:00Z,https://example.invalid/1\n',
    )
    const adapter = new CsvSourceAdapter()
    await adapter.initialize({ path, sourceName: 'csv-fixture' })
    const items = await adapter.fetch()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: '1', source: 'csv-fixture', title: 'Hello' })
  })

  it('supports explicit CSV field mapping', async () => {
    const path = await fixture('mapped.csv', 'record,headline,message\na1,Hello,Need help\n')
    const adapter = new CsvSourceAdapter()
    await adapter.initialize({
      path,
      mapping: { id: 'record', title: 'headline', content: 'message' },
    })
    expect((await adapter.fetch())[0]).toMatchObject({ id: 'a1', title: 'Hello' })
  })

  it('parses JSON arrays and removes sensitive metadata fields', async () => {
    const path = await fixture(
      'items.json',
      JSON.stringify([
        {
          id: '1',
          title: 'Hello',
          content: 'World',
          token: 'not-retained',
          url: ['https://user', 'password@example.invalid/item'].join(':'),
          custom: 4,
          profile: { label: 'safe', authentication: { session: 'not-retained' } },
        },
      ]),
    )
    const adapter = new JsonSourceAdapter()
    await adapter.initialize({ path })
    const items = await adapter.fetch()
    expect(items[0]).toMatchObject({
      url: null,
      metadata: { custom: 4, profile: { label: 'safe' } },
    })
  })

  it('supports a JSON items property and explicit field mapping', async () => {
    const path = await fixture(
      'wrapped.json',
      JSON.stringify({ records: [{ record: 'a1', headline: 'Hello', message: 'Need help' }] }),
    )
    const adapter = new JsonSourceAdapter()
    await adapter.initialize({
      path,
      itemsProperty: 'records',
      mapping: { id: 'record', title: 'headline', content: 'message' },
    })
    expect((await adapter.fetch())[0]).toMatchObject({ id: 'a1', title: 'Hello' })
  })

  it('parses RSS and Atom-style link attributes', async () => {
    const path = await fixture(
      'feed.xml',
      '<?xml version="1.0"?><feed><entry><id>a1</id><title>News</title><summary>Issue summary</summary><updated>2026-09-06T10:00:00Z</updated><link href="https://example.invalid/a1"/></entry></feed>',
    )
    const adapter = new RssSourceAdapter()
    await adapter.initialize({ path, sourceName: 'feed' })
    const items = await adapter.fetch()
    expect(items[0]).toMatchObject({ id: 'a1', title: 'News', url: 'https://example.invalid/a1' })
  })

  it('splits a local text file into reviewable blocks', async () => {
    const path = await fixture('notes.md', '# First\nBody one.\n\n# Second\nBody two.')
    const adapter = new LocalFileSourceAdapter()
    await adapter.initialize({ path })
    const items = await adapter.fetch()
    expect(items.map(({ title }) => title)).toEqual(['First', 'Second'])
  })

  it('validates configuration and rejects unsupported extensions', () => {
    const adapter = new JsonSourceAdapter()
    expect(adapter.validateConfig({})).toMatchObject({ valid: false })
    expect(() => adapterForPath('archive.exe')).toThrow(/Unsupported source type/u)
  })

  it('rejects empty and whitespace-only source files with an actionable error', async () => {
    const emptyPath = await fixture('empty.json', '')
    const whitespacePath = await fixture('empty.txt', '  \r\n  ')

    const json = new JsonSourceAdapter()
    await expect(json.initialize({ path: emptyPath })).rejects.toThrow(
      'The selected source file is empty. Add content and retry.',
    )

    const text = new LocalFileSourceAdapter()
    await text.initialize({ path: whitespacePath })
    await expect(text.fetch()).rejects.toThrow(
      'The selected source file is empty. Add content and retry.',
    )
  })

  it('rejects invalid UTF-8 without exposing source bytes', async () => {
    const path = await binaryFixture('invalid.txt', new Uint8Array([0xc3, 0x28]))
    const adapter = new LocalFileSourceAdapter()
    await adapter.initialize({ path })

    await expect(adapter.fetch()).rejects.toThrow(
      'The selected source is not valid UTF-8 text. Save it as UTF-8 and retry.',
    )
  })

  it('returns format-specific errors for malformed CSV, JSON, and RSS', async () => {
    const csvPath = await fixture('broken.csv', 'id,title\n1,"unterminated')
    const jsonPath = await fixture('broken.json', '{"items": [}')
    const rssPath = await fixture('broken.rss', '<rss><channel><item></channel></rss>')

    const csv = new CsvSourceAdapter()
    await csv.initialize({ path: csvPath })
    await expect(csv.fetch()).rejects.toThrow('The CSV source is malformed.')

    const json = new JsonSourceAdapter()
    await json.initialize({ path: jsonPath })
    await expect(json.fetch()).rejects.toThrow('The JSON source is malformed.')

    const rss = new RssSourceAdapter()
    await rss.initialize({ path: rssPath })
    await expect(rss.fetch()).rejects.toThrow('The RSS or Atom source is malformed.')
  })

  it('explains the accepted JSON structure when no item array exists', async () => {
    const path = await fixture('object.json', '{"record":{"title":"One"}}')
    const adapter = new JsonSourceAdapter()
    await adapter.initialize({ path })

    await expect(adapter.fetch()).rejects.toThrow(
      'The JSON source must be an array or contain an items array.',
    )
  })

  it('accepts the exact size boundary and rejects one byte above it', async () => {
    const accepted = await fixture('accepted.txt', 'x')
    const rejected = await fixture('rejected.txt', 'x')
    await truncate(accepted, MAX_SOURCE_BYTES)
    await truncate(rejected, MAX_SOURCE_BYTES + 1)

    await expect(validateReadableFile(accepted)).resolves.toBeUndefined()
    await expect(validateReadableFile(rejected)).rejects.toThrow(
      'The selected source is larger than the 10 MiB import limit.',
    )
  })

  it('does not expose a missing local path in adapter errors', async () => {
    const existing = await fixture('existing.json', '[]')
    const missing = join(existing, '..', 'PRIVATE_PATH_MARKER.json')
    const adapter = new JsonSourceAdapter()

    await expect(adapter.initialize({ path: missing })).rejects.toThrow(
      'The selected source file could not be found. Choose it again and retry.',
    )
    await expect(adapter.initialize({ path: missing })).rejects.not.toThrow(missing)
  })

  it('reports a path-free adapter health check after initialization', async () => {
    const path = await fixture('health.json', '[]')
    const adapter = new JsonSourceAdapter()
    await adapter.initialize({ path })

    const health = await adapter.healthCheck()
    expect(health).toMatchObject({
      healthy: true,
      message: 'File is readable and within the 10 MiB import limit.',
    })
    expect(health.message).not.toContain(path)
  })
})
