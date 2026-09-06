import {
  Activity,
  Archive,
  BookOpen,
  Check,
  ChevronRight,
  CircleGauge,
  Clock3,
  Database,
  Download,
  ExternalLink,
  FileSearch,
  Filter,
  FolderOpen,
  GitFork,
  History,
  Inbox,
  Layers3,
  LoaderCircle,
  Menu,
  Play,
  Radar,
  Rss,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ReviewStatus } from '@xiaoye-radar/core'
import type { WorkspaceState } from '@xiaoye-radar/storage'
import type { ActionResponse, BootstrapResponse } from '../shared/contracts'

type Page =
  'dashboard' | 'sources' | 'rules' | 'jobs' | 'candidates' | 'review' | 'history' | 'settings'

const starterRule = `id: starter-feedback-rule
name: Starter feedback triage
description: A source-neutral starter rule for product and service feedback.
enabled: true
priority: normal

time_window:
  days: 30

include:
  - help
  - feedback
  - issue
  - 建议
  - 求助

exclude:
  - advertisement
  - sponsored
  - 广告

score:
  urgent: 25
  broken: 18
  无法使用: 20
  建议: 12

basic_score: 5
minimum_score: 10
deduplication: content
`

const navigation: Array<{ id: Page; label: string; detail: string; icon: typeof Radar }> = [
  { id: 'dashboard', label: '总览', detail: 'Overview', icon: CircleGauge },
  { id: 'sources', label: '数据源', detail: 'Sources', icon: Database },
  { id: 'rules', label: '规则库', detail: 'Rules', icon: SlidersHorizontal },
  { id: 'jobs', label: '监测任务', detail: 'Monitoring', icon: Activity },
  { id: 'candidates', label: '候选结果', detail: 'Candidates', icon: FileSearch },
  { id: 'review', label: '审核队列', detail: 'Human review', icon: Inbox },
  { id: 'history', label: '扫描历史', detail: 'History', icon: History },
  { id: 'settings', label: '设置', detail: 'Settings', icon: Settings },
]

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function outcomeLabel(status: ReviewStatus): string {
  return { pending: '待审核', approved: '已通过', rejected: '已排除', archived: '已归档' }[status]
}

function Empty({
  icon,
  title,
  detail,
}: {
  icon: ReactNode
  title: string
  detail: string
}): ReactNode {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  )
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string
  value: number
  detail: string
}): ReactNode {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
      <small>{detail}</small>
    </article>
  )
}

function PageTitle({
  eyebrow,
  title,
  detail,
  actions,
}: {
  eyebrow: string
  title: string
  detail: string
  actions?: ReactNode
}): ReactNode {
  return (
    <header className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
      {actions ? <div className="heading-actions">{actions}</div> : null}
    </header>
  )
}

export function App(): ReactNode {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null)
  const [page, setPage] = useState<Page>('dashboard')
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [ruleDocument, setRuleDocument] = useState(starterRule)
  const [selectedSource, setSelectedSource] = useState('')
  const [selectedRule, setSelectedRule] = useState('')
  const [reviewFilter, setReviewFilter] = useState<ReviewStatus | 'all'>('all')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [candidateLimit, setCandidateLimit] = useState(100)
  const mainContent = useRef<HTMLElement>(null)

  const state: WorkspaceState = bootstrap?.state ?? {
    schemaVersion: 1,
    sources: [],
    rules: [],
    jobs: [],
    candidates: [],
    runs: [],
  }

  useEffect(() => {
    void window.xiaoyeCommunity
      .getBootstrap()
      .then((value) => setBootstrap(value))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : String(reason)),
      )
  }, [])

  const effectiveSource = selectedSource || state.sources[0]?.id || ''
  const effectiveRule = selectedRule || state.rules[0]?.id || ''

  const pending = state.candidates.filter(({ reviewStatus }) => reviewStatus === 'pending').length
  const approved = state.candidates.filter(({ reviewStatus }) => reviewStatus === 'approved').length
  const filteredCandidates = useMemo(
    () =>
      reviewFilter === 'all'
        ? state.candidates
        : state.candidates.filter(({ reviewStatus }) => reviewStatus === reviewFilter),
    [reviewFilter, state.candidates],
  )
  const pageCandidates =
    page === 'review'
      ? state.candidates.filter(({ reviewStatus }) => reviewStatus === 'pending')
      : filteredCandidates
  const visibleCandidates = pageCandidates.slice(0, candidateLimit)

  useEffect(() => {
    mainContent.current?.focus({ preventScroll: true })
  }, [page])

  useEffect(() => {
    if (!navigationOpen) return
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setNavigationOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [navigationOpen])

  async function action(
    name: string,
    operation: () => Promise<ActionResponse | null>,
  ): Promise<void> {
    setBusy(name)
    setError('')
    setNotice('')
    try {
      const result = await operation()
      if (result) {
        setBootstrap((current) => (current ? { ...current, state: result.state } : current))
        setNotice(result.message)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(null)
    }
  }

  async function setReview(candidateId: string, status: ReviewStatus): Promise<void> {
    await action('review', () =>
      window.xiaoyeCommunity.updateReview(candidateId, status, notes[candidateId] ?? ''),
    )
  }

  async function utilityAction(
    name: string,
    operation: () => Promise<{ ok: true } | null>,
    successMessage: string,
  ): Promise<void> {
    setBusy(name)
    setError('')
    setNotice('')
    try {
      const result = await operation()
      if (result) setNotice(successMessage)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(null)
    }
  }

  function go(next: Page): void {
    setPage(next)
    setCandidateLimit(100)
    setNavigationOpen(false)
  }

  if (!bootstrap && !error) {
    return (
      <main className="loading-screen" aria-live="polite">
        <LoaderCircle className="spin" aria-hidden="true" />
        <p>正在打开 Community 工作区…</p>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <button
        className="mobile-menu"
        type="button"
        aria-label={navigationOpen ? '关闭导航' : '打开导航'}
        aria-expanded={navigationOpen}
        onClick={() => setNavigationOpen((value) => !value)}
      >
        {navigationOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>

      <aside className={`sidebar ${navigationOpen ? 'open' : ''}`}>
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <Radar />
          </span>
          <div>
            <strong>XIAOYE RADAR</strong>
            <small>COMMUNITY EDITION</small>
          </div>
        </div>
        <nav aria-label="主导航">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <button
                type="button"
                key={item.id}
                className={page === item.id ? 'active' : ''}
                aria-current={page === item.id ? 'page' : undefined}
                onClick={() => go(item.id)}
              >
                <Icon aria-hidden="true" />
                <span>
                  <b>{item.label}</b>
                  <small>{item.detail}</small>
                </span>
                {item.id === 'review' && pending > 0 ? <em>{pending}</em> : null}
              </button>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>Local first</strong>
            <small>无遥测 · 无私有服务</small>
          </div>
        </div>
      </aside>

      <main ref={mainContent} className="main-content" tabIndex={-1}>
        <div className="top-status">
          <span className="status-dot" aria-hidden="true" />
          <span>Community workspace ready</span>
          <code>v{bootstrap?.appVersion ?? '0.4.0'}</code>
        </div>

        {page === 'dashboard' ? (
          <>
            <section className="hero-panel">
              <div className="hero-copy">
                <span className="eyebrow">OPEN SOURCE · LOCAL FIRST</span>
                <h1>
                  把公开内容变成
                  <br />
                  可审核的信号。
                </h1>
                <p>
                  数据源接入、规则过滤、内容去重与人工审核，在一个不依赖登录和私有服务的桌面工作台中完成。
                </p>
                <div className="hero-actions">
                  <button
                    className="primary-button"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void action('demo', () => window.xiaoyeCommunity.importDemo())}
                  >
                    {busy === 'demo' ? (
                      <LoaderCircle className="spin" aria-hidden="true" />
                    ) : (
                      <Play aria-hidden="true" />
                    )}
                    导入并运行 Demo
                  </button>
                  <button className="secondary-button" type="button" onClick={() => go('sources')}>
                    查看数据源 <ChevronRight aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div
                className="radar-visual"
                role="img"
                aria-label="Source to review pipeline illustration"
              >
                <div className="radar-grid">
                  <span className="radar-ring ring-one" />
                  <span className="radar-ring ring-two" />
                  <span className="radar-ring ring-three" />
                  <span className="radar-sweep" />
                  <span className="radar-ping ping-one" />
                  <span className="radar-ping ping-two" />
                  <Radar aria-hidden="true" />
                </div>
                <div className="visual-caption">
                  <span>Pipeline status</span>
                  <strong>{state.runs[0] ? 'Last run complete' : 'Waiting for first run'}</strong>
                </div>
              </div>
            </section>

            <section className="metrics-grid" aria-label="Workspace metrics">
              <Metric
                label="数据源"
                value={state.sources.length}
                detail="CSV · JSON · RSS · FILE"
              />
              <Metric
                label="候选结果"
                value={state.candidates.length}
                detail={`${pending} pending review`}
              />
              <Metric label="已通过" value={approved} detail="Human verified" />
              <Metric
                label="扫描次数"
                value={state.runs.length}
                detail={formatDate(state.runs[0]?.finishedAt ?? null)}
              />
            </section>

            <section className="section-card pipeline-card">
              <div className="section-title">
                <div>
                  <span className="eyebrow">HOW IT WORKS</span>
                  <h2>一条清晰、可替换的数据管线</h2>
                </div>
                <BookOpen aria-hidden="true" />
              </div>
              <div className="pipeline-flow">
                {[
                  'Source Adapter',
                  'Normalizer',
                  'Rule Engine',
                  'Deduplication',
                  'Candidate Queue',
                  'Human Review',
                  'Export',
                ].map((step, index) => (
                  <div key={step} className="pipeline-step">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{step}</strong>
                    {index < 6 ? <ChevronRight aria-hidden="true" /> : null}
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {page === 'sources' ? (
          <>
            <PageTitle
              eyebrow="SOURCE ADAPTER SDK"
              title="数据源"
              detail="导入本地 CSV、JSON、RSS / Atom、Markdown 或纯文本文件。文件内容只保存在本机。"
              actions={
                <>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void action('demo', () => window.xiaoyeCommunity.importDemo())}
                  >
                    <Play aria-hidden="true" /> Demo
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void action('source', () => window.xiaoyeCommunity.importSource())
                    }
                  >
                    <Upload aria-hidden="true" /> 导入文件
                  </button>
                </>
              }
            />
            {state.sources.length === 0 ? (
              <Empty
                icon={<Database />}
                title="还没有数据源"
                detail="导入 Demo 或选择一个受支持的本地文件。"
              />
            ) : (
              <div className="card-grid">
                {state.sources.map((source) => (
                  <article className="source-card" key={source.id}>
                    <div className="source-icon" aria-hidden="true">
                      {source.adapterKind === 'rss' ? <Rss /> : <Database />}
                    </div>
                    <div className="source-copy">
                      <div>
                        <span className="health-dot" /> healthy
                      </div>
                      <h3>{source.name}</h3>
                      <p>{source.fileName}</p>
                    </div>
                    <dl>
                      <div>
                        <dt>Adapter</dt>
                        <dd>{source.adapterKind}</dd>
                      </div>
                      <div>
                        <dt>Items</dt>
                        <dd>{source.itemCount}</dd>
                      </div>
                      <div>
                        <dt>Imported</dt>
                        <dd>{formatDate(source.importedAt)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </>
        ) : null}

        {page === 'rules' ? (
          <>
            <PageTitle
              eyebrow="RULE ENGINE"
              title="规则库"
              detail="规则使用 JSON 或 YAML；支持 include、exclude、时间窗、评分、来源过滤、正则与去重。"
            />
            <div className="rules-layout">
              <section className="section-card rule-list">
                <div className="section-title">
                  <h2>已保存规则</h2>
                  <Filter aria-hidden="true" />
                </div>
                {state.rules.length === 0 ? (
                  <p className="muted-copy">保存右侧示例，或导入 Demo。</p>
                ) : (
                  state.rules.map((rule) => (
                    <button
                      key={rule.id}
                      type="button"
                      onClick={() => setSelectedRule(rule.id)}
                      className={selectedRule === rule.id ? 'rule-row active' : 'rule-row'}
                      aria-pressed={selectedRule === rule.id}
                    >
                      <span className={`priority priority-${rule.priority}`} />
                      <span>
                        <strong>{rule.name}</strong>
                        <small>
                          {rule.include.length} include · {rule.exclude.length} exclude
                        </small>
                      </span>
                      <ChevronRight aria-hidden="true" />
                    </button>
                  ))
                )}
              </section>
              <section className="section-card editor-card">
                <div className="section-title">
                  <div>
                    <h2>规则编辑器</h2>
                    <p>保存前会进行 schema 与正则校验。</p>
                  </div>
                  <code>YAML</code>
                </div>
                <label htmlFor="rule-document">规则配置</label>
                <textarea
                  id="rule-document"
                  spellCheck={false}
                  value={ruleDocument}
                  onChange={(event) => setRuleDocument(event.target.value)}
                />
                <div className="editor-footer">
                  <span>本地验证 · 不上传内容</span>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void action('rule', () => window.xiaoyeCommunity.saveRule(ruleDocument))
                    }
                  >
                    {busy === 'rule' ? (
                      <LoaderCircle className="spin" aria-hidden="true" />
                    ) : (
                      <Check aria-hidden="true" />
                    )}{' '}
                    保存规则
                  </button>
                </div>
              </section>
            </div>
          </>
        ) : null}

        {page === 'jobs' ? (
          <>
            <PageTitle
              eyebrow="MONITORING WORKFLOW"
              title="监测任务"
              detail="选择一个公开数据源与规则集，执行可重复、可审计的本地扫描。"
            />
            <section className="section-card run-panel">
              <div className="run-fields">
                <label>
                  数据源
                  <select
                    value={effectiveSource}
                    onChange={(event) => setSelectedSource(event.target.value)}
                  >
                    <option value="">选择数据源</option>
                    {state.sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name} ({source.itemCount})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  规则集
                  <select
                    value={effectiveRule}
                    onChange={(event) => setSelectedRule(event.target.value)}
                  >
                    <option value="">选择规则</option>
                    {state.rules.map((rule) => (
                      <option key={rule.id} value={rule.id}>
                        {rule.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="primary-button run-button"
                  type="button"
                  disabled={busy !== null || !effectiveSource || !effectiveRule}
                  onClick={() =>
                    void action('run', () =>
                      window.xiaoyeCommunity.runMonitoring(effectiveSource, effectiveRule),
                    )
                  }
                >
                  {busy === 'run' ? (
                    <LoaderCircle className="spin" aria-hidden="true" />
                  ) : (
                    <Play aria-hidden="true" />
                  )}{' '}
                  立即扫描
                </button>
              </div>
              <div className="run-note">
                <ShieldCheck aria-hidden="true" />
                <span>扫描只读取导入的本地副本；不会登录平台、绕过访问控制或调用私有 API。</span>
              </div>
            </section>
            <section className="section-card">
              <div className="section-title">
                <h2>任务记录</h2>
                <Activity aria-hidden="true" />
              </div>
              {state.jobs.length === 0 ? (
                <Empty
                  icon={<Layers3 />}
                  title="尚未建立任务"
                  detail="第一次运行数据源与规则组合时会自动创建。"
                />
              ) : (
                <div className="table-list">
                  {state.jobs.map((job) => (
                    <div className="table-row" key={job.id}>
                      <span className="job-icon">
                        <Activity />
                      </span>
                      <span>
                        <strong>{job.name}</strong>
                        <small>{job.enabled ? 'Enabled' : 'Disabled'}</small>
                      </span>
                      <span>
                        <small>上次运行</small>
                        <b>{formatDate(job.lastRunAt)}</b>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}

        {page === 'candidates' || page === 'review' ? (
          <>
            <PageTitle
              eyebrow={page === 'review' ? 'HUMAN IN THE LOOP' : 'CANDIDATE QUEUE'}
              title={page === 'review' ? '审核队列' : '候选结果'}
              detail={
                page === 'review'
                  ? '机器规则负责缩小范围，最终判断始终由人完成。'
                  : '查看规则命中的内容、评分依据与审核状态。'
              }
              actions={
                page === 'candidates' ? (
                  <>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void utilityAction(
                          'export-csv',
                          () => window.xiaoyeCommunity.exportCandidates('csv'),
                          'CSV 已导出',
                        )
                      }
                    >
                      <Download aria-hidden="true" /> CSV
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void utilityAction(
                          'export-json',
                          () => window.xiaoyeCommunity.exportCandidates('json'),
                          'JSON 已导出',
                        )
                      }
                    >
                      <Download aria-hidden="true" /> JSON
                    </button>
                  </>
                ) : undefined
              }
            />
            {page === 'candidates' ? (
              <div className="filter-bar" role="group" aria-label="候选状态筛选">
                {(['all', 'pending', 'approved', 'rejected', 'archived'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={reviewFilter === status ? 'active' : ''}
                    aria-pressed={reviewFilter === status}
                    onClick={() => {
                      setReviewFilter(status)
                      setCandidateLimit(100)
                    }}
                  >
                    {status === 'all' ? '全部' : outcomeLabel(status)}
                    <span>
                      {status === 'all'
                        ? state.candidates.length
                        : state.candidates.filter((candidate) => candidate.reviewStatus === status)
                            .length}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {pageCandidates.length === 0 ? (
              <Empty
                icon={<Inbox />}
                title={page === 'review' ? '审核队列已清空' : '没有候选结果'}
                detail="运行 Demo 或扫描已导入的数据源后，候选内容会出现在这里。"
              />
            ) : (
              <div className="candidate-list">
                {visibleCandidates.map((candidate) => (
                  <article className="candidate-card" key={candidate.id}>
                    <div className="candidate-score">
                      <strong>{candidate.score}</strong>
                      <span>SCORE</span>
                    </div>
                    <div className="candidate-body">
                      <div className="candidate-meta">
                        <span className={`status-pill status-${candidate.reviewStatus}`}>
                          {outcomeLabel(candidate.reviewStatus)}
                        </span>
                        <span>{candidate.item.source}</span>
                        <span>{formatDate(candidate.item.publishedAt)}</span>
                      </div>
                      <h3>{candidate.item.title || 'Untitled content'}</h3>
                      <p>{candidate.item.content}</p>
                      <div className="keyword-list">
                        {candidate.matchedKeywords.map((keyword) => (
                          <span key={keyword}>{keyword}</span>
                        ))}
                      </div>
                      <label className="note-field">
                        审核备注
                        <input
                          value={notes[candidate.id] ?? candidate.reviewNote}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [candidate.id]: event.target.value,
                            }))
                          }
                          placeholder="可选：记录判断依据"
                        />
                      </label>
                      <div className="candidate-actions">
                        <button
                          type="button"
                          className="approve"
                          disabled={busy !== null}
                          onClick={() => void setReview(candidate.id, 'approved')}
                        >
                          <Check aria-hidden="true" /> 通过
                        </button>
                        <button
                          type="button"
                          className="reject"
                          disabled={busy !== null}
                          onClick={() => void setReview(candidate.id, 'rejected')}
                        >
                          <X aria-hidden="true" /> 排除
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void setReview(candidate.id, 'archived')}
                        >
                          <Archive aria-hidden="true" /> 归档
                        </button>
                        {candidate.item.url ? (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() =>
                              void utilityAction(
                                `open-${candidate.id}`,
                                () => window.xiaoyeCommunity.openCandidateUrl(candidate.id),
                                '已在默认浏览器中打开来源',
                              )
                            }
                          >
                            <ExternalLink aria-hidden="true" /> 来源
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
                {visibleCandidates.length < pageCandidates.length ? (
                  <button
                    className="secondary-button load-more"
                    type="button"
                    onClick={() => setCandidateLimit((current) => current + 100)}
                  >
                    再显示 100 条（剩余 {pageCandidates.length - visibleCandidates.length}）
                  </button>
                ) : null}
              </div>
            )}
          </>
        ) : null}

        {page === 'history' ? (
          <>
            <PageTitle
              eyebrow="AUDIT TRAIL"
              title="扫描历史"
              detail="每次运行都保留时间、规则、来源与结果计数，便于复查。"
            />
            <section className="section-card">
              {state.runs.length === 0 ? (
                <Empty
                  icon={<Clock3 />}
                  title="还没有扫描记录"
                  detail="运行 Demo 会生成第一条完整的集成流程记录。"
                />
              ) : (
                <div className="history-list">
                  {state.runs.map((run) => (
                    <article key={run.id}>
                      <div className="history-status">
                        <Check aria-hidden="true" />
                      </div>
                      <div>
                        <span>{formatDate(run.finishedAt)}</span>
                        <h3>
                          {run.sourceName} <ChevronRight aria-hidden="true" /> {run.ruleName}
                        </h3>
                        <p>
                          {run.stats.total} 输入 · {run.stats.candidates} 候选 ·{' '}
                          {run.stats.excluded} 排除 · {run.stats.duplicates} 重复 ·{' '}
                          {run.stats.timeFiltered} 超时
                        </p>
                      </div>
                      <code>{run.status}</code>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}

        {page === 'settings' ? (
          <>
            <PageTitle
              eyebrow="PRIVACY & RUNTIME"
              title="设置"
              detail="Community 与 Pro 使用不同应用标识和数据目录，不共享写权限。"
            />
            <div className="settings-grid">
              <section className="section-card">
                <div className="setting-icon" aria-hidden="true">
                  <FolderOpen />
                </div>
                <h2>本地数据目录</h2>
                <p className="path-value">{bootstrap?.dataPath}</p>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    void utilityAction(
                      'open-data',
                      () => window.xiaoyeCommunity.openDataFolder(),
                      '已打开 Community 数据目录',
                    )
                  }
                >
                  <FolderOpen aria-hidden="true" /> 打开目录
                </button>
              </section>
              <section className="section-card">
                <div className="setting-icon" aria-hidden="true">
                  <ShieldCheck />
                </div>
                <h2>隐私默认值</h2>
                <dl className="setting-list">
                  <div>
                    <dt>Telemetry</dt>
                    <dd>关闭</dd>
                  </div>
                  <div>
                    <dt>Automatic updates</dt>
                    <dd>未启用</dd>
                  </div>
                  <div>
                    <dt>Private services</dt>
                    <dd>无依赖</dd>
                  </div>
                </dl>
              </section>
              <section className="section-card">
                <div className="setting-icon" aria-hidden="true">
                  <GitFork />
                </div>
                <h2>开源边界</h2>
                <p>
                  Community
                  只包含通用规则、公开文件适配器、本地存储与人工审核。平台登录及商业能力保留在 Pro。
                </p>
              </section>
            </div>
          </>
        ) : null}
      </main>

      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {notice ? (
          <div className="toast success" role="status">
            <Check aria-hidden="true" />
            {notice}
            <button type="button" aria-label="关闭通知" onClick={() => setNotice('')}>
              <X aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {error ? (
          <div className="toast error" role="alert">
            <X aria-hidden="true" />
            {error}
            <button type="button" aria-label="关闭错误" onClick={() => setError('')}>
              <X aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
      {navigationOpen ? (
        <button
          className="nav-scrim"
          type="button"
          aria-label="关闭导航"
          onClick={() => setNavigationOpen(false)}
        />
      ) : null}
    </div>
  )
}
