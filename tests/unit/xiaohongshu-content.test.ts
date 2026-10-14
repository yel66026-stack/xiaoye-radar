import { JSDOM } from 'jsdom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canonicalNoteUrl,
  isXiaohongshuUrl,
  normalizeXiaohongshuNote,
  readXiaohongshuPage,
} from '../../apps/community-desktop/src/main/xiaohongshu-content'

const url = 'https://www.xiaohongshu.com/explore/synthetic-note'
const raw = {
  url,
  title: '虚构民宿记录',
  content: '民宿露营体验',
  author: 'Synthetic author',
  publishedAt: 1791518400000,
  location: { province: '浙江', city: '杭州' },
}
afterEach(() => vi.unstubAllGlobals())

describe('Xiaohongshu public note extraction', () => {
  it('reports malformed or oversized fields as a layout failure that pauses the task', () => {
    for (const input of [null, { ...raw, content: 'x'.repeat(100001) }]) {
      try {
        normalizeXiaohongshuNote(input)
        expect.fail('Expected validation failure')
      } catch (error) {
        expect(error).toMatchObject({ code: 'layout' })
      }
    }
  })
  it('normalizes epoch dates and drops all transient URL query parameters', () => {
    const note = normalizeXiaohongshuNote({
      ...raw,
      url: `${url}?source=web&xsec_token=synthetic`,
      location: { city: '杭州', secret: 'must-not-retain' },
    })
    expect(note.url).toBe(url)
    expect(note.publishedAt).toBe(new Date(raw.publishedAt).toISOString())
    expect(note.metadata.location).toEqual({ city: '杭州' })
  })
  it('does not invent years for relative or yearless date labels', () => {
    for (const publishedAt of ['昨天', '10-10', '3小时前', '2026-02-30'])
      expect(normalizeXiaohongshuNote({ ...raw, publishedAt }).publishedAt).toBeNull()
    expect(normalizeXiaohongshuNote({ ...raw, publishedAt: '2026-10-10' }).publishedAt).toBe(
      '2026-10-09T16:00:00.000Z',
    )
  })
  it('rejects foreign domains, embedded credentials and empty note bodies', () => {
    for (const target of [
      'https://www.xiaohongshu.com.evil.invalid/explore/x',
      'http://www.xiaohongshu.com/explore/x',
      'https://evil.invalid/explore/x',
      'https://www.xiaohongshu.com:8443/explore/x',
    ])
      expect(isXiaohongshuUrl(target)).toBe(false)
    expect(
      canonicalNoteUrl('https://www.xiaohongshu.com/search_result/synthetic-note?source=web'),
    ).toBe(url)
    expect(canonicalNoteUrl('https://www.xiaohongshu.com/login')).toBeNull()
    expect(() => normalizeXiaohongshuNote({ ...raw, title: '', content: '' })).toThrow(/正文/u)
  })
  it('reads structured public note data and never uses IP location as the note location', () => {
    const dom = new JSDOM('<div id="detail-desc">安全验证相关民宿体验</div>', { url })
    Object.assign(dom.window, {
      __INITIAL_STATE__: {
        note: {
          noteDetailMap: {
            'synthetic-note': {
              note: {
                title: raw.title,
                desc: raw.content,
                time: raw.publishedAt,
                ipLocation: '浙江',
                user: { nickname: raw.author, session: 'do-not-read' },
              },
            },
          },
        },
      },
    })
    vi.stubGlobal('window', dom.window)
    vi.stubGlobal('document', dom.window.document)
    vi.stubGlobal('location', dom.window.location)
    const page = readXiaohongshuPage()
    expect(page.blocked).toBeNull()
    expect(page.note).toMatchObject({
      title: raw.title,
      content: raw.content,
      publishedAt: raw.publishedAt,
      location: null,
    })
    expect(JSON.stringify(page)).not.toContain('do-not-read')
  })
  it('detects login, verification, hidden modals and visible note links', () => {
    const dom = new JSDOM(
      '<div class="login-modal" style="display:none">login</div><a href="/explore/synthetic-note?source=web">note</a><a href="https://evil.invalid/explore/x">foreign</a>',
      { url: 'https://www.xiaohongshu.com/search_result?keyword=test' },
    )
    vi.stubGlobal('window', dom.window)
    vi.stubGlobal('document', dom.window.document)
    vi.stubGlobal('location', dom.window.location)
    expect(readXiaohongshuPage().blocked).toBeNull()
    expect(readXiaohongshuPage().links).toEqual([`${url}?source=web`])
    dom.window.document.querySelector<HTMLElement>('.login-modal')!.style.display = 'block'
    expect(readXiaohongshuPage().blocked).toBe('login')
    dom.window.document.body.innerHTML = '<div id="captcha">verify</div>'
    expect(readXiaohongshuPage().blocked).toBe('verification')
  })
})
