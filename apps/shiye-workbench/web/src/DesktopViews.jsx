import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  List,
  GanttChart,
  Plus,
  Hash,
  Ellipsis,
  Play,
  Pause,
  Square,
  ChevronRight,
  CalendarDays,
  Check,
  Clock3,
  Search,
  ArrowRight,
  Bookmark,
  Heart,
  FileText,
  Video,
  ArrowUpRight,
  FolderOpen,
  ShieldCheck,
  Copy,
  Save,
  RefreshCw,
} from "lucide-react";
import { Button, Empty, Glass, IconButton, Status, spring, SegmentedTabs } from "./ui";
import {
  call,
  formatDate,
  number,
  shortNumber,
  statuses,
  taskGroup,
} from "./bridge";

export function TaskActions({task, demo, onAction, compact=false}) {
  const [busy,setBusy]=useState(false);
  const actions=[];
  if(task.status==="running") actions.push(["pause",Pause,"暂停"]);
  if(["paused","waiting","interrupted","stopped","error","partial"].includes(task.status)) actions.push(["resume",Play,"继续"]);
  if(["running","paused","waiting","queued"].includes(task.status)) actions.push(["stop",Square,"停止"]);
  async function action(name) {
    setBusy(true);
    try {await onAction(task,name);} finally {setBusy(false);}
  }
  return <div className="task-actions">{actions.map(([name,Icon,label]) => compact ?
    <IconButton key={name} icon={Icon} label={`${label} ${task.keyword}`} disabled={demo||busy} onClick={()=>action(name)}/> :
    <Button key={name} className="small task-action" icon={Icon} aria-label={`${label} ${task.keyword}`} disabled={demo||busy} onClick={()=>action(name)}>{label}</Button>
  )}</div>;
}

export function TaskViewTabs({view,setView}) {
  return <SegmentedTabs id="task-view" label="任务视图" value={view} onChange={setView} items={[
    {id:"list",label:"列表",icon:List},{id:"board",label:"看板",icon:LayoutGrid},{id:"timeline",label:"时间轴",icon:GanttChart}
  ]}/>;
}

export function DesktopTasks({
  tasks,
  view,
  setView,
  demo,
  onOpen,
  onAction,
  onNew,
  overview = false,
  toolbarContent,
  notice,
  filtered = false,
  onClear,
}) {
  const groups = [
    ["active", "进行中", "blue"],
    ["queued", "待处理", "gray"],
    ["done", "已完成", "green"],
  ];
  const card = (t) => (
    <motion.article
      layout
      transition={spring}
      className="task-card desktop-task"
      key={t.id}
    >
      <div className="task-card-top">
        <span
          className={`project-tag ${t.mode === "deep" ? "purple" : "blue"}`}
        >
          <Hash size={11} />
          {t.mode === "deep" ? "深度采集" : "快速采集"}
        </span>
        <IconButton
          icon={Ellipsis}
          label={`任务详情 ${t.keyword}`}
          onClick={() => onOpen(t)}
        />
      </div>
      <button className="task-title" onClick={() => onOpen(t)}>
        {t.keyword}
      </button>
      <div className="task-status-row">
        <Status status={t.status} />
        <span>{formatDate(t.created_at)}</span>
      </div>
      <div className="task-progress">
        <div>
          <span>已采集</span>
          <b>
            {number(t.count)}
            <span> / {number(t.target)}</span>
          </b>
        </div>
        <span className="progress-track">
          <motion.i
            animate={{ width: `${Math.min(100, (t.count / t.target) * 100)}%` }}
            transition={spring}
          />
        </span>
      </div>
      <p className="scan-summary">
        扫描 {number(t.scanned)} · 跳过 {number(t.skipped)}
      </p>
      {(t.criteria?.regions?.length > 0 || !["completed"].includes(t.status)) && <div className="task-card-foot">
        {t.criteria?.regions?.length > 0 && <span>{t.criteria.regions.join(" / ")}</span>}
        <TaskActions task={t} demo={demo} onAction={onAction} />
      </div>}
    </motion.article>
  );
  return (
    <>
      {!overview && <>
        <div className="task-controls">{toolbarContent}<TaskViewTabs view={view} setView={setView}/></div>
        <div className="task-results-summary"><span>{tasks.length} 个任务</span>{filtered && <button type="button" onClick={onClear}>清除筛选</button>}</div>
        {notice}
      </>}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          {view === "board" && (
            <div className="board desktop-board">
              {groups.map(([id, label, color]) => (
                <section className="board-column" key={id}>
                  <div className="column-head">
                    <span>
                      <i className={`column-dot ${color}`} />
                      {label}
                      <b>{tasks.filter((t) => taskGroup(t) === id).length}</b>
                    </span>
                  </div>
                  <div className="column-cards">
                    {tasks.filter((t) => taskGroup(t) === id).map(card)}
                    {!tasks.some((t) => taskGroup(t) === id) && (
                      <div className="column-idle">
                        {id === "active"
                          ? "暂时没有进行中的任务"
                          : id === "queued"
                            ? "暂无待处理任务"
                            : "完成的采集会出现在这里"}
                      </div>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
          {view === "list" && (
            <div className={`task-list ${overview ? "is-overview" : "is-full"}`}>
              {!overview && tasks.length>0 && <div className="task-table-head"><span>关键词</span><span>状态</span><span>已采集 / 目标</span><span>操作</span></div>}
              {tasks.map((t) => (
                <div key={t.id} className="task-list-row">
                  <button className="task-list-title" onClick={() => onOpen(t)}>
                    {t.keyword}
                    <small>
                      {t.mode === "deep" ? "深度" : "快速"}采集 ·{" "}
                      {formatDate(t.created_at)}
                    </small>
                  </button>
                  <Status status={t.status} />
                  <span className="list-count" title="已采集 / 目标数量">
                    {number(t.count)} / {number(t.target)} 条
                  </span>
                  <div className="task-list-operations">
                    <TaskActions task={t} demo={demo} onAction={onAction} compact={overview}/>
                    {overview ? <IconButton icon={ChevronRight} label={`任务详情 ${t.keyword}`} onClick={()=>onOpen(t)}/> : <Button className="small" aria-label={`任务详情 ${t.keyword}`} onClick={()=>onOpen(t)}>详情</Button>}
                  </div>
                </div>
              ))}
              {!tasks.length && (
                <Empty
                  title={filtered ? "没有匹配的任务" : "暂无采集任务"}
                  action={
                    filtered ? <Button onClick={onClear}>清除筛选</Button> : <Button onClick={() => onNew()} icon={Plus}>新建采集任务</Button>
                  }
                />
              )}
            </div>
          )}
          {view === "timeline" && (
            <div className="event-timeline">
              {tasks.map((t) => (
                <div key={t.id}>
                  <span className={`column-dot ${statuses[t.status]?.[1]}`} />
                  <time>{formatDate(t.created_at)}</time>
                  <button onClick={() => onOpen(t)}>
                    <b>{t.keyword}</b>
                    <span>{t.message || "已进入采集队列"}</span>
                  </button>
                  <Status status={t.status} />
                </div>
              ))}
              {!tasks.length && <Empty title="采集时间轴还没有记录" />}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

export function DesktopNoteCard({
  note,
  saved,
  selected,
  compact,
  onOpen,
  onSave,
  onSelect,
  demo,
}) {
  return (
    <Glass as="article" className={`note-card ${compact ? "compact" : ""}`}>
      <div className="note-card-category">
        {!compact && (
          <input
            type="checkbox"
            className="note-check"
            aria-label={`选择 ${note.title}`}
            checked={selected}
            onChange={onSelect}
          />
        )}
        <span
          className={`note-category-icon ${note.note_type === "video" ? "purple" : "blue"}`}
        >
          {note.note_type === "video" ? (
            <Video size={17} />
          ) : (
            <FileText size={17} />
          )}
        </span>
        <span>{note.keyword}</span>
        <button
          className={`save-note ${saved ? "saved" : ""}`}
          aria-label={`${saved ? "取消收藏" : "收藏"} ${note.title}`}
          aria-pressed={saved}
          onClick={onSave}
        >
          <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <button className="note-card-title" onClick={onOpen}>
        {note.title}
      </button>
      {!compact && (
        <p className="note-description">
          {note.description || "未读取正文；可查看原始笔记。"}
        </p>
      )}
      <div className="note-card-meta">
        <span className="author-dot blue">{note.author?.[0] || "作"}</span>
        <span>{note.author || "未知作者"}</span>
        <span className="note-likes">
          <Heart size={12} />
          {note.likes_known ? shortNumber(note.likes) : "未读取"}
        </span>
      </div>
      {!compact && (
        <div className="note-card-bottom">
          <span>
            {note.ip_location || "属地未读取"} ·{" "}
            {note.published_at || "发布时间未读取"}
          </span>
          <button onClick={onOpen}>
            查看详情
            <ArrowUpRight size={13} />
          </button>
        </div>
      )}
    </Glass>
  );
}

export function TaskDetail({
  task,
  snapshot,
  onAction,
  onRepeat,
  onNotes,
  onNoteSaved,
}) {
  const [events, setEvents] = useState([]);
  const [annotation, setAnnotation] = useState(
    snapshot.ui?.task_notes?.[task.id] || "",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    call("task_events", task.id)
      .then((v) => {
        if (current) setEvents(v);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [task.id, task.status, task.count]);
  return (
    <div className="form task-detail">
      <div className="detail-meta">
        <Status status={task.status} />
        <span>{task.mode === "deep" ? "深度采集" : "快速采集"}</span>
        <TaskActions task={task} demo={snapshot.demo} onAction={onAction} />
      </div>
      <h3>{task.keyword}</h3>
      <p className="task-message">{task.message || "已加入采集队列"}</p>
      <div className="task-detail-stats">
        {[
          ["扫描候选", task.scanned],
          ["命中保存", task.count],
          ["跳过候选", task.skipped],
          ["目标数量", task.target],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <b>{number(value)}</b>
          </div>
        ))}
      </div>
      <div className="task-detail-buttons">
        <Button icon={FolderOpen} onClick={() => onNotes(task.id)}>
          查看本任务结果
        </Button>
        <Button icon={Copy} onClick={() => onRepeat(task)}>
          用相同条件新建
        </Button>
      </div>
      <details className="detail-section"><summary>采集条件</summary>
      <div className="criteria-summary">
        {[
          ["公开属地", task.criteria?.regions?.join("、") || "不限"],
          [
            "属地来源",
            {
              either: "笔记优先，缺失时尝试作者主页",
              note: "仅笔记",
              author: "仅作者主页",
            }[task.criteria?.ip_source] || "笔记优先",
          ],
          [
            "发布时间",
            `${task.criteria?.date_from || "不限起始"} — ${task.criteria?.date_to || "不限结束"}`,
          ],
          [
            "内容类型",
            { image: "图文", video: "视频" }[task.criteria?.note_type] ||
              "全部",
          ],
          [
            "点赞范围",
            `${task.criteria?.min_likes ?? "不限"} — ${task.criteria?.max_likes ?? "不限"}`,
          ],
          ["包含词", task.criteria?.include_words?.join("、") || "无"],
          [
            "包含方式",
            task.criteria?.include_mode === "all" ? "全部命中" : "任一命中",
          ],
          [
            "匹配范围",
            { title: "标题", body: "正文", both: "标题与正文" }[
              task.criteria?.text_scope
            ] || "标题与正文",
          ],
          ["排除词", task.criteria?.exclude_words?.join("、") || "无"],
          ["限定作者", task.criteria?.authors?.join("、") || "不限"],
          ["排除作者", task.criteria?.exclude_authors?.join("、") || "无"],
          ["候选上限", task.criteria?.max_scan || 1000],
          ["词库快照", task.library?.name || "手动填写"],
          ["创建时间", formatDate(task.created_at)],
          ["结束时间", task.ended_at ? formatDate(task.ended_at) : "尚未结束"],
        ].map(([key, value]) => (
          <div key={key}>
            <span>{key}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>
      </details>
      {Object.keys(task.skip_reasons || {}).length > 0 && (
        <>
          <h4>跳过原因</h4>
          <div className="skip-reasons">
            {Object.entries(task.skip_reasons).map(([key, count]) => (
              <div key={key}>
                <span>{snapshot.reason_labels[key] || key}</span>
                <b>{count}</b>
              </div>
            ))}
          </div>
        </>
      )}
      <label>
        研究备注
        <textarea
          rows={3}
          maxLength={5000}
          value={annotation}
          onChange={(e) => setAnnotation(e.target.value)}
        />
      </label>
      <Button
        icon={Save}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await call("save_task_note", task.id, annotation);
            onNoteSaved();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        保存研究备注
      </Button>
      <details className="detail-section task-log-section" open={task.status === "error" || undefined}><summary>执行日志 · {events.length}</summary>
      <div className="task-log">
        {events.map((e) => (
          <div key={e.id}>
            <time>{formatDate(e.created_at)}</time>
            <p className={e.level === "error" ? "log-error" : ""}>
              {e.message}
            </p>
          </div>
        ))}
      </div>
      </details>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function NativeNoteDetail({ note, demo, saved, onSave, onOpen }) {
  if (!note) return <div className="loading-block">正在读取本地笔记…</div>;
  let terms = [];
  try {
    terms = JSON.parse(note.matched_terms || "[]");
  } catch {}
  return (
    <article className="note-detail">
      <div className="detail-meta">
        <span className="project-tag blue">
          {note.note_type === "video"
            ? "视频"
            : note.note_type === "image"
              ? "图文"
              : "类型未读取"}
        </span>
        <span>{demo ? "演示资料" : "本地采集资料"}</span>
        <button
          className={`save-detail ${saved ? "saved" : ""}`}
          onClick={onSave}
        >
          <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
          {saved ? "已收藏" : "收藏"}
        </button>
      </div>
      <h2>{note.title}</h2>
      <div className="note-author">
        <span className="author-dot blue">{note.author?.[0] || "作"}</span>
        {note.author || "作者未读取"}
        <span>
          <Heart size={13} />
          {note.likes_known ? number(note.likes) : "未读取"} 点赞
        </span>
      </div>
      <div className="note-body">
        <p>
          {note.description ||
            "尚未读取正文。快速模式可能只保存标题与基础信息。"}
        </p>
      </div>
      <section className="metadata-panel">
        <h3>公开元数据与来源</h3>
        <div className="criteria-summary">
          {[
            ["搜索关键词", note.keyword],
            ["公开 IP 属地", note.ip_location || "未读取"],
            [
              "属地来源",
              { note: "笔记页面", author: "作者主页（当前公开属地）" }[
                note.ip_source
              ] || "未读取",
            ],
            ["属地原文", note.ip_raw || "未读取"],
            ["帖子发布时间", note.published_at || "未读取"],
            ["发布时间原文", note.published_raw || "未读取"],
            [
              "时间精度",
              {
                day: "明确日期",
                timestamp: "时间戳",
                relative: "相对日期换算",
                inferred_year: "推算年份",
                unknown: "未知",
              }[note.published_precision] || note.published_precision,
            ],
            ["时间来源", note.published_source || "未读取"],
            [
              "时间类型",
              {
                published: "发布时间",
                updated: "仅编辑 / 更新时间",
                unknown: "无法确认",
              }[note.time_kind] || "无法确认",
            ],
            ["采集时间", formatDate(note.collected_at)],
            [
              "正文状态",
              {
                full: "完整正文",
                title: "仅标题与基础信息",
                fallback: "正文未成功读取",
              }[note.detail_status] || note.detail_status,
            ],
            ["命中词", terms.join("、") || "无"],
          ].map(([k, v]) => (
            <div key={k}>
              <span>{k}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>
      </section>
      <p className="field-help">
        属地只代表页面公开地区。采集时间不作为帖子发布时间；缺失字段不会推测填充。
      </p>
      <Button
        className="primary"
        icon={ArrowUpRight}
        disabled={!note.link || demo}
        onClick={onOpen}
      >
        打开小红书原始笔记
      </Button>
    </article>
  );
}

export function DesktopCommand({
  snapshot,
  onNavigate,
  onNew,
  onTask,
  onNote,
}) {
  const [q, setQ] = useState("");
  const [notes, setNotes] = useState([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const list = useRef(null);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      if (!q.trim()) {
        setNotes([]);
        return;
      }
      call("notes", { search: q, page: 1 })
        .then((r) => {
          if (current) {
            setNotes(r.rows.slice(0, 6));
            setError("");
          }
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
    }, 180);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [q]);
  const results = [
    {
      id: "new",
      title: "新建采集任务",
      sub: "关键词、模式与组合筛选",
      run: onNew,
      Icon: Plus,
    },
    ...["dashboard", "tasks", "library", "words", "saved"].map((p, i) => ({
      id: p,
      title: ["工作台", "采集任务", "内容资料库", "自定义词库", "收藏笔记"][i],
      sub: "前往工作空间",
      run: () => onNavigate(p),
      Icon: FolderOpen,
    })),
    ...snapshot.tasks.map((t) => ({
      id: t.id,
      title: t.keyword,
      sub: `采集任务 · ${statuses[t.status]?.[0]}`,
      run: () => onTask(t),
      Icon: Clock3,
    })),
  ]
    .filter((r) =>
      `${r.title} ${r.sub}`.toLowerCase().includes(q.toLowerCase()),
    )
    .slice(0, 8)
    .concat(
      notes.map((n) => ({
        id: `note-${n.id}`,
        title: n.title,
        sub: `笔记 · ${n.author}`,
        run: () => onNote(n),
        Icon: FileText,
      })),
    );
  useEffect(() => {
    setIndex(0);
  }, [q]);
  useEffect(() => {
    list.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);
  return (
    <div
      className="command-palette"
      onKeyDown={(e) => {
        if (["ArrowDown", "ArrowUp"].includes(e.key)) {
          e.preventDefault();
          setIndex((i) =>
            results.length
              ? (i + (e.key === "ArrowDown" ? 1 : -1) + results.length) %
                results.length
              : 0,
          );
        }
        if (e.key === "Enter" && results[index]) {
          e.preventDefault();
          results[index].run();
        }
      }}
    >
      <div className="command-input">
        <Search size={20} />
        <input
          data-autofocus
          role="combobox"
          aria-label="搜索全部内容与指令"
          aria-expanded="true"
          aria-controls="native-command-results"
          aria-activedescendant={
            results[index] ? `cmd-${results[index].id}` : undefined
          }
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索关键词、笔记、任务与指令…"
        />
        <kbd>ESC</kbd>
      </div>
      <div className="command-label">
        {q ? "搜索本地数据库" : "快捷指令与采集任务"}
      </div>
      <div
        role="listbox"
        id="native-command-results"
        className="command-results"
        ref={list}
      >
        {results.map((r, i) => (
          <button
            id={`cmd-${r.id}`}
            role="option"
            aria-selected={index === i}
            key={r.id}
            onMouseMove={() => setIndex(i)}
            onClick={r.run}
          >
            <span className="command-result-icon">
              <r.Icon size={17} />
            </span>
            <span>
              <b>{r.title}</b>
              <small>{r.sub}</small>
            </span>
            <ArrowRight size={14} />
          </button>
        ))}
        {!results.length && <Empty title="没有找到相关记录" />}
        {error && <p className="form-error">{error}</p>}
      </div>
      <div className="command-footer">
        <span>↑ ↓ 切换</span>
        <span>Enter 打开</span>
        <span>Ctrl / ⌘ + K 搜索</span>
      </div>
    </div>
  );
}

export function ThirdPartyLicenses() {
  const [text,setText]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{let current=true;fetch("./THIRD_PARTY_NOTICES.txt").then(response=>{if(!response.ok)throw new Error("许可文件读取失败");return response.text();}).then(value=>{if(current)setText(value);}).catch(error=>{if(current)setError(error.message);});return()=>{current=false;};},[]);
  return <div className="license-content">{error?<p className="form-error">{error}</p>:text?<pre className="license-copy">{text}</pre>:<p>正在读取许可文件…</p>}</div>;
}
