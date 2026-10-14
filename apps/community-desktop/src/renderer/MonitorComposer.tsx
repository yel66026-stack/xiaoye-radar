import { useState, type ReactNode } from 'react'
import type { SourceRecord } from '@xiaoye-radar/storage'
import type { CreateMonitorRequest } from '../shared/monitoring-config'

const cities = [
  '杭州',
  '宁波',
  '温州',
  '嘉兴',
  '湖州',
  '绍兴',
  '金华',
  '衢州',
  '舟山',
  '台州',
  '丽水',
]

export function MonitorComposer({
  sources,
  busy,
  create,
  connect,
}: {
  sources: SourceRecord[]
  busy: boolean
  create: (request: CreateMonitorRequest) => Promise<void>
  connect: () => Promise<void>
}): ReactNode {
  const [source, setSource] = useState<'xiaohongshu' | 'existing'>('xiaohongshu')
  const [sourceId, setSourceId] = useState('')
  const [name, setName] = useState('浙江内容监测')
  const [keywords, setKeywords] = useState('')
  const [includeMode, setIncludeMode] = useState<'any' | 'all'>('any')
  const [city, setCity] = useState('')
  const [timeMode, setTimeMode] = useState<'rolling' | 'range'>('rolling')
  const [days, setDays] = useState(7)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [interval, setIntervalMinutes] = useState(60)
  const [maxNotes, setMaxNotes] = useState(30)
  return (
    <section className="section-card monitor-composer">
      <div className="section-title">
        <h2>新建条件扫描</h2>
        <span className="tag">浙江＋时间＋关键词</span>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void create({
            name,
            source,
            sourceRecordId: sourceId,
            keywords: [
              ...new Set(
                keywords
                  .split(/[,，;；\n]/u)
                  .map((term) => term.trim())
                  .filter(Boolean),
              ),
            ],
            includeMode,
            province: '浙江',
            cities: city ? [city] : [],
            timeMode,
            days,
            startDate: startDate || null,
            endDate: endDate || null,
            intervalMinutes: interval || null,
            maxNotes,
          })
        }}
      >
        <fieldset disabled={busy} className="monitor-fields">
          <label>
            任务名称
            <input
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            数据来源
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as typeof source)}
            >
              <option value="xiaohongshu">小红书网页（实验性接入）</option>
              <option value="existing">已导入的 JSON / CSV 等文件</option>
            </select>
          </label>
          {source === 'existing' ? (
            <label>
              选择文件数据源
              <select
                required
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
              >
                <option value="">请选择</option>
                {sources
                  .filter((entry) => entry.adapterKind !== 'xiaohongshu')
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <div className="monitor-connect">
              <button type="button" className="secondary-button" onClick={() => void connect()}>
                打开小红书并登录
              </button>
              <small>首次使用请完成登录；账号会话仅保存在本机。</small>
            </div>
          )}
          <label>
            地区（依据笔记地点）
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="">浙江全省</option>
              {cities.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}市
                </option>
              ))}
            </select>
          </label>
          <label className="wide-field">
            搜索关键词
            <input
              required
              placeholder="例如：露营，民宿，装修（逗号分隔，最多 20 个）"
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
            />
          </label>
          <label>
            关键词匹配
            <select
              value={includeMode}
              onChange={(event) => setIncludeMode(event.target.value as typeof includeMode)}
            >
              <option value="any">命中任一关键词</option>
              <option value="all">必须包含所有关键词</option>
            </select>
          </label>
          <label>
            时间范围
            <select
              value={timeMode}
              onChange={(event) => setTimeMode(event.target.value as typeof timeMode)}
            >
              <option value="rolling">最近 N 天（每次扫描自动更新）</option>
              <option value="range">指定起止日期（北京时间）</option>
            </select>
          </label>
          {timeMode === 'rolling' ? (
            <label>
              最近天数
              <input
                type="number"
                min={1}
                max={3650}
                required
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
              />
            </label>
          ) : (
            <>
              <label>
                开始日期
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  max={endDate || undefined}
                />
              </label>
              <label>
                结束日期
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  min={startDate || undefined}
                />
              </label>
            </>
          )}
          <label>
            扫描频率
            <select
              value={interval}
              onChange={(event) => setIntervalMinutes(Number(event.target.value))}
            >
              <option value={0}>仅手动扫描</option>
              <option value={15}>每 15 分钟</option>
              <option value={30}>每 30 分钟</option>
              <option value={60}>每小时</option>
              <option value={360}>每 6 小时</option>
              <option value={1440}>每天</option>
            </select>
          </label>
          {source === 'xiaohongshu' ? (
            <label>
              每轮最多读取笔记
              <input
                type="number"
                required
                min={1}
                max={100}
                value={maxNotes}
                onChange={(event) => setMaxNotes(Number(event.target.value))}
              />
            </label>
          ) : null}
          <div className="wide-field monitor-help">
            地区、时间、关键词同时满足才保存为候选；地点或日期缺失的相关笔记进入“待确认”。定时扫描需要保持应用运行，重启后到期任务补扫一次。
          </div>
          <button className="primary-button" type="submit">
            保存监测任务
          </button>
        </fieldset>
      </form>
    </section>
  )
}
