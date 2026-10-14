import { BrowserWindow, session } from 'electron'
import type { NormalizedContent, RuleSet } from '@xiaoye-radar/core'
import {
  canonicalNoteUrl,
  isXiaohongshuUrl,
  normalizeXiaohongshuNote,
  readXiaohongshuPage,
  SourceScanError,
} from './xiaohongshu-content'

export interface LiveContentCollector {
  scan(rule: RuleSet, maxNotes: number): Promise<NormalizedContent[]>
}

export class XiaohongshuBrowser implements LiveContentCollector {
  #window: BrowserWindow | null = null
  #busy = false

  #getWindow(): BrowserWindow {
    if (this.#window && !this.#window.isDestroyed()) return this.#window
    const browsingSession = session.fromPartition('persist:xiaoye-xiaohongshu-v1')
    browsingSession.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false),
    )
    browsingSession.setPermissionCheckHandler(() => false)
    browsingSession.on('will-download', (event) => event.preventDefault())
    const window = new BrowserWindow({
      title: '小红书 · 小夜雷达',
      width: 1100,
      height: 850,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        session: browsingSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        backgroundThrottling: false,
      },
    })
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event, url) => {
      if (!isXiaohongshuUrl(url)) event.preventDefault()
    })
    window.webContents.on('will-redirect', (event, url) => {
      if (!isXiaohongshuUrl(url)) event.preventDefault()
    })
    window.on('closed', () => {
      this.#window = null
    })
    this.#window = window
    return window
  }

  async open(): Promise<void> {
    const window = this.#getWindow()
    window.show()
    window.focus()
    if (!this.#busy && !isXiaohongshuUrl(window.webContents.getURL()))
      await this.#load('https://www.xiaohongshu.com/explore')
  }

  async #bounded<T>(operation: Promise<T>, milliseconds = 30000): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new SourceScanError('timeout', '小红书页面加载超时，请检查网络后重试。')),
            milliseconds,
          )
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  async #load(url: string): Promise<void> {
    if (!isXiaohongshuUrl(url)) throw new SourceScanError('layout', '小红书页面地址无效。')
    const window = this.#getWindow()
    try {
      await this.#bounded(window.loadURL(url))
    } catch (error) {
      if (!window.isDestroyed()) window.webContents.stop()
      if (error instanceof SourceScanError) throw error
      throw new SourceScanError('timeout', '无法加载小红书页面，请检查网络后重试。')
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 1800))
  }

  async #read(): Promise<ReturnType<typeof readXiaohongshuPage>> {
    const window = this.#getWindow()
    if (!isXiaohongshuUrl(window.webContents.getURL()))
      throw new SourceScanError('layout', '小红书窗口已离开允许的页面。')
    const result: unknown = await this.#bounded(
      window.webContents.executeJavaScript(`(${readXiaohongshuPage.toString()})()`),
      10000,
    )
    // The page is untrusted. Every returned field is checked before it can reach storage.
    const { z } = await import('zod')
    const validation = z
      .object({
        blocked: z.enum(['login', 'verification']).nullable(),
        links: z.array(z.string().max(3000)).max(200),
        note: z.unknown().nullable(),
        empty: z.boolean(),
      })
      .strict()
      .safeParse(result)
    if (!validation.success)
      throw new SourceScanError('layout', '小红书页面返回了无法识别的数据，任务已暂停。')
    const parsed = validation.data
    if (parsed.blocked) {
      throw new SourceScanError(
        parsed.blocked,
        parsed.blocked === 'login'
          ? '小红书需要登录。请打开小红书窗口完成登录，再启用任务。'
          : '小红书要求验证或限制了访问。任务已暂停，请在小红书窗口处理后手动启用。',
      )
    }
    return parsed as ReturnType<typeof readXiaohongshuPage>
  }

  async scan(rule: RuleSet, maxNotes: number): Promise<NormalizedContent[]> {
    if (this.#busy) throw new SourceScanError('busy', '小红书正在扫描，请等待当前任务完成。')
    if (rule.include.length === 0 || rule.include.length > 20)
      throw new SourceScanError('layout', '小红书扫描需要 1 至 20 个关键词。')
    this.#busy = true
    try {
      const links = new Map<string, string>()
      const queries = rule.includeMode === 'all' ? [rule.include.join(' ')] : rule.include
      if (maxNotes < queries.length)
        throw new SourceScanError('layout', '每轮笔记上限不能少于搜索关键词数量。')
      for (const [queryIndex, keyword] of queries.entries()) {
        const limit = Math.min(
          maxNotes,
          links.size + Math.ceil((maxNotes - links.size) / (queries.length - queryIndex)),
        )
        const url = new URL('https://www.xiaohongshu.com/search_result')
        url.searchParams.set('keyword', keyword)
        url.searchParams.set('source', 'web_search_result_notes')
        await this.#load(url.toString())
        for (let page = 0; page < 5 && links.size < limit; page += 1) {
          const current = await this.#read()
          if (current.links.length === 0 && !current.empty)
            throw new SourceScanError(
              'layout',
              '没有读到搜索结果，页面可能需要登录或结构已变化。请打开小红书窗口检查。',
            )
          const previous = links.size
          for (const link of current.links) {
            const canonical = canonicalNoteUrl(link)
            if (canonical && links.size < limit) links.set(canonical, link)
          }
          if (current.empty || (page > 0 && previous === links.size)) break
          if (links.size < limit) {
            await this.#bounded(
              this.#getWindow().webContents.executeJavaScript(
                'window.scrollBy(0, window.innerHeight); undefined',
              ),
            )
            await new Promise<void>((resolve) => setTimeout(resolve, 2000))
          }
        }
        if (links.size >= maxNotes) break
      }
      const items: NormalizedContent[] = []
      for (const link of links.values()) {
        await this.#load(link)
        const page = await this.#read()
        if (!page.note)
          throw new SourceScanError(
            'layout',
            '无法读取笔记正文，笔记可能已删除或页面已变化。本轮未保存为成功扫描。',
          )
        items.push(normalizeXiaohongshuNote(page.note))
        await new Promise<void>((resolve) => setTimeout(resolve, 2000))
      }
      return items
    } finally {
      this.#busy = false
    }
  }

  dispose(): void {
    if (this.#window && !this.#window.isDestroyed()) this.#window.destroy()
    this.#window = null
  }
}
