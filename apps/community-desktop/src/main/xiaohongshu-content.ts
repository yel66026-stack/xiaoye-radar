import { normalizedContentSchema, type NormalizedContent } from '@xiaoye-radar/core'
import { safeMetadata } from '@xiaoye-radar/source-sdk'
import { z } from 'zod'

export class SourceScanError extends Error {
  constructor(
    readonly code: 'login' | 'verification' | 'layout' | 'timeout' | 'busy',
    message: string,
  ) {
    super(message)
  }
}

export function isXiaohongshuUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname === 'www.xiaohongshu.com' &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443')
    )
  } catch {
    return false
  }
}

export function canonicalNoteUrl(value: string): string | null {
  if (!isXiaohongshuUrl(value)) return null
  const match = /^\/(?:explore|search_result)\/([a-zA-Z0-9_-]+)\/?$/u.exec(new URL(value).pathname)
  return match ? `https://www.xiaohongshu.com/explore/${match[1]}` : null
}

export function normalizeXiaohongshuNote(input: unknown): NormalizedContent {
  const parsed = z
    .object({
      url: z.string().max(3000),
      title: z.string().max(10000),
      content: z.string().max(100000),
      author: z.string().max(500).nullable(),
      publishedAt: z.unknown(),
      location: z.unknown(),
    })
    .strict()
    .safeParse(input)
  if (!parsed.success)
    throw new SourceScanError('layout', '笔记字段格式已变化或超出读取上限，请打开小红书窗口检查。')
  const raw = parsed.data
  const url = canonicalNoteUrl(raw.url)
  if (!url || (!raw.title.trim() && !raw.content.trim()))
    throw new SourceScanError(
      'layout',
      '无法读取笔记正文，页面结构可能已变化。请打开小红书窗口检查，或导入已取得的 JSON/CSV。',
    )
  let publishedAt: string | null = null
  if (
    typeof raw.publishedAt === 'number' &&
    Number.isFinite(raw.publishedAt) &&
    raw.publishedAt > 0
  ) {
    const date = new Date(raw.publishedAt < 1e12 ? raw.publishedAt * 1000 : raw.publishedAt)
    if (Number.isFinite(date.getTime())) publishedAt = date.toISOString()
  } else if (typeof raw.publishedAt === 'string') {
    const value = raw.publishedAt.trim()
    // Yearless and relative labels remain unknown; the collector never invents a publication date.
    const fullDate = /^(\d{4})[-/](\d{2})[-/](\d{2})$/u.exec(value)
    if (fullDate) {
      const iso = `${fullDate[1]}-${fullDate[2]}-${fullDate[3]}T00:00:00+08:00`
      const parsed = Date.parse(iso)
      if (
        Number.isFinite(parsed) &&
        new Date(parsed + 8 * 3600000)
          .toISOString()
          .startsWith(`${fullDate[1]}-${fullDate[2]}-${fullDate[3]}`)
      )
        publishedAt = new Date(parsed).toISOString()
    } else if (z.string().datetime({ offset: true }).safeParse(value).success)
      publishedAt = new Date(value).toISOString()
  }
  return normalizedContentSchema.parse({
    id: url.split('/').at(-1),
    source: 'xiaohongshu',
    title: raw.title.trim(),
    content: raw.content.trim(),
    author: raw.author,
    publishedAt,
    url,
    metadata: safeMetadata(
      {
        location: raw.location,
        collectedAt: new Date().toISOString(),
        acquisition: 'user-browser-public-page',
      },
      [],
    ),
  })
}

// This self-contained function executes in the remote page. It reads public note fields only.
// It never reads cookies, account state, request signatures or private APIs.
export function readXiaohongshuPage() {
  const text = (selector: string): string =>
    document.querySelector(selector)?.textContent?.trim() ?? ''
  const visibleText = document.body?.innerText ?? ''
  const visible = (selector: string): boolean =>
    [...document.querySelectorAll(selector)].some(
      (element) =>
        !element.hasAttribute('hidden') &&
        window.getComputedStyle(element).display !== 'none' &&
        window.getComputedStyle(element).visibility !== 'hidden',
    )
  let blocked: 'login' | 'verification' | null = null
  if (
    visible('.captcha-container, .captcha-modal, #captcha') ||
    (!document.querySelector('#detail-desc, section.note-item') &&
      /安全验证|访问频次异常|访问异常|请完成验证|滑动验证|请求过于频繁/u.test(visibleText))
  )
    blocked = 'verification'
  else if (
    location.pathname.startsWith('/login') ||
    visible('.login-container, .login-mask, .login-modal')
  )
    blocked = 'login'
  const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
    .map((link) => link.href)
    .filter((value) =>
      /^https:\/\/www\.xiaohongshu\.com\/(explore|search_result)\/[a-zA-Z0-9_-]+(?:[?/#]|$)/u.test(
        value,
      ),
    )
  const record = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const state = record((window as unknown as { __INITIAL_STATE__?: unknown }).__INITIAL_STATE__)
  const details = record(record(state.note).noteDetailMap)
  const noteId = location.pathname.split('/').filter(Boolean).at(-1) ?? ''
  const detail = record(record(details[noteId]).note)
  const user = record(detail.user)
  const title = typeof detail.title === 'string' ? detail.title : text('#detail-title')
  const content = typeof detail.desc === 'string' ? detail.desc : text('#detail-desc')
  const dateLabel = text('.note-content .date').match(/\d{4}-\d{2}-\d{2}/u)?.[0] ?? null
  const placeText = text('.note-content .location, .note-content .poi, .note-content .address')
  const note =
    title || content
      ? {
          url: location.href,
          title,
          content,
          author:
            typeof user.nickname === 'string'
              ? user.nickname
              : text('.author-container .username') || null,
          publishedAt: detail.time ?? dateLabel,
          location: detail.location ?? detail.poi ?? (placeText || null),
        }
      : null
  return {
    blocked,
    links: [...new Set(links)].slice(0, 200),
    note,
    empty: /没有找到|暂无搜索结果|没有相关结果/u.test(visibleText),
  }
}
