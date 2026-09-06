import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CsvSourceAdapter,
  JsonSourceAdapter,
  LocalFileSourceAdapter,
  RssSourceAdapter,
  adapterForPath,
} from '@xiaoye-radar/source-sdk'

const temporaryDirectories: string[] = []

async function fixture(name: string, content: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'xiaoye-source-test-'))
  temporaryDirectories.push(directory)
  const path = join(directory, name)
  await writeFile(path, content, 'utf8')
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
})
