import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  Layers2,
  LayoutDashboard,
  SquareCheckBig,
  Library,
  BookOpen,
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ArrowUpRight,
  Hash,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  CircleHelp,
  Bell,
  Download,
  SlidersHorizontal,
  X,
  Bookmark,
  Check,
  Globe2,
  Menu,
  ShieldCheck,
  RefreshCw,
  FolderOpen,
  Upload,
  CheckCheck,
} from "lucide-react";
import {
  Button,
  Dialog,
  Empty,
  Glass,
  IconButton,
  SectionHeading,
  TextLink,
  Toasts,
} from "./ui";
import { call, emptyRules, formatDate, number, statuses } from "./bridge";
import {
  ExportForm,
  FilterForm,
  LibraryForm,
  NewTaskForm,
  SettingsForm,
} from "./DesktopForms";
import {
  DesktopCommand,
  DesktopNoteCard,
  DesktopTasks,
  NativeNoteDetail,
  TaskDetail,
  ThirdPartyLicenses,
} from "./DesktopViews";

const nav = [
  ["dashboard", LayoutDashboard, "工作台"],
  ["tasks", SquareCheckBig, "采集任务"],
  ["library", Library, "内容资料库"],
  ["words", BookOpen, "自定义词库"],
];
const titles = {
  dashboard: "工作台",
  tasks: "采集任务",
  library: "内容资料库",
  words: "自定义词库",
  saved: "收藏笔记",
};

export default function DesktopApp() {
  const [snap, setSnap] = useState(null);
  const [connectionError, setConnectionError] = useState("");
  const [page, setPage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(
    () => matchMedia("(max-width:800px)").matches,
  );
  const [menu, setMenu] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [modal, setModal] = useState(null);
  const close = useCallback(() => setModal(null), []);
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [taskStatus, setTaskStatus] = useState("all");
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState("latest");
  const [notePage, setNotePage] = useState(1);
  const [notes, setNotes] = useState({ rows: [], total: 0 });
  const [notesError, setNotesError] = useState("");
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [selected, setSelected] = useState([]);
  const [noteVersion, setNoteVersion] = useState(0);
  const [notices, setNotices] = useState([]);
  const timers = useRef(new Set());
  const closing = useRef(false);
  const pollTimer = useRef(null);
  const fetchId = useRef(0);
  const mounted = useRef(true);
  const fetching = useRef(null);
  const toast = useCallback((text, error = false) => {
    const id = crypto.randomUUID();
    setNotices((v) => [...v.slice(-2), { id, text, error }]);
    const t = setTimeout(() => {
      setNotices((v) => v.filter((n) => n.id !== id));
      timers.current.delete(t);
    }, 4500);
    timers.current.add(t);
  }, []);
  const refresh = useCallback(async () => {
    if (closing.current) return;
    if (fetching.current) return fetching.current;
    const request = call("snapshot")
      .then((s) => {
        if (mounted.current) {
          setSnap(s);
          setConnectionError("");
        }
        return s;
      })
      .catch((e) => {
        if (mounted.current) setConnectionError(e.message);
      })
      .finally(() => {
        fetching.current = null;
      });
    fetching.current = request;
    return request;
  }, []);
  useEffect(() => {
    mounted.current = true;
    closing.current = false;
    async function poll() {
      await refresh();
      if (!closing.current && mounted.current)
        pollTimer.current = setTimeout(poll, 1500);
    }
    poll();
    return () => {
      mounted.current = false;
      closing.current = true;
      clearTimeout(pollTimer.current);
      timers.current.forEach(clearTimeout);
    };
  }, [refresh]);
  const navigate = useCallback((next) => {
    setPage(next);
    setQuery("");
    setTaskStatus("all");
    setFilters({});
    setSort("latest");
    setNotePage(1);
    setSelected([]);
    setMenu(false);
    setSwitcher(false);
  }, []);
  const newTask = useCallback(
    (initial) => setModal({ type: "task", data: initial }),
    [],
  );
  useEffect(() => {
    const media = matchMedia("(max-width:800px)");
    const change = () => {
      setMobile(media.matches);
      if (!media.matches) setMenu(false);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!mobile || !menu) return;
    const panel = document.querySelector(".sidebar");
    panel.querySelector("button")?.focus();
    const key = (e) => {
      if (e.key === "Escape") {
        setMenu(false);
      }
      if (e.key === "Tab") {
        const items = [...panel.querySelectorAll("button")].filter(
          (el) => !el.disabled && el.getClientRects().length,
        );
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.querySelector(".mobile-menu")?.focus();
    };
  }, [mobile, menu]);
  useEffect(() => {
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setModal((m) => (m?.type === "command" ? null : { type: "command" }));
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setModal((m) => m || { type: "task" });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const savedIds = snap?.ui?.saved_ids || [];
  const savedKey = JSON.stringify(savedIds);
  const filterKey = JSON.stringify(filters);
  const effectiveFilters = useMemo(
    () =>
      page === "dashboard"
        ? { page: 1, sort: "latest" }
        : {
            ...filters,
            search: query,
            sort,
            page: notePage,
            ...(page === "saved" ? { saved_only: true } : {}),
          },
    [page, filterKey, query, sort, notePage],
  );
  useEffect(() => {
    if (!snap || !["dashboard", "library", "saved"].includes(page)) return;
    const sequence = ++fetchId.current;
    setLoadingNotes(true);
    const timer = setTimeout(() => {
      call("notes", effectiveFilters)
        .then((r) => {
          if (sequence === fetchId.current) {
            setNotes(r);
            setNotesError("");
            const max = Math.max(1, Math.ceil(r.total / 30));
            if (notePage > max) setNotePage(max);
          }
        })
        .catch((e) => {
          if (sequence === fetchId.current) {
            setNotes({ rows: [], total: 0 });
            setNotesError(e.message);
          }
        })
        .finally(() => {
          if (sequence === fetchId.current) setLoadingNotes(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      fetchId.current++;
    };
  }, [
    page,
    effectiveFilters,
    snap?.demo,
    snap?.stats.total,
    noteVersion,
    savedKey,
  ]);
  useEffect(() => {
    window.App = {
      state: { snap, page, filters: effectiveFilters, selected, notes, view },
      navigate,
      newTask,
      closeModal: close,
      onClosing() {
        closing.current = true;
        clearTimeout(pollTimer.current);
      },
    };
  }, [
    snap,
    page,
    effectiveFilters,
    selected,
    notes,
    view,
    navigate,
    newTask,
    close,
  ]);
  const perform = async (name, args = [], message) => {
    try {
      const result = await call(name, ...args);
      await refresh();
      setNoteVersion((v) => v + 1);
      if (message) toast(message);
      return result;
    } catch (e) {
      toast(e.message, true);
      return undefined;
    }
  };
  const taskAction = async (task, action) =>
    perform(
      "task_action",
      [task.id, action],
      {
        pause: "已请求暂停，已保存的结果会保留。",
        resume: "已请求继续采集。",
        stop: "已请求停止，正在保存当前进度。",
      }[action],
    );
  const toggleSaved = async (note) =>
    perform(
      "set_note_saved",
      [note.id, !savedIds.includes(note.id)],
      savedIds.includes(note.id) ? "已取消收藏" : "这条内容，收好了。",
    );
  const changeFilters = (next) => {
    setFilters(next);
    setNotePage(1);
    setSelected([]);
  };
  const selectNote = (id) => {
    if (selected.includes(id))
      setSelected(selected.filter((value) => value !== id));
    else if (selected.length >= 1000)
      toast("最多勾选 1000 条；更多记录请导出当前筛选范围。", true);
    else setSelected([...selected, id]);
  };
  const selectPage = (checked) => {
    const next = checked
      ? [...new Set([...selected, ...notes.rows.map((n) => n.id)])]
      : selected.filter((id) => !notes.rows.some((n) => n.id === id));
    if (next.length > 1000) {
      toast("最多勾选 1000 条；更多记录请导出当前筛选范围。", true);
      return;
    }
    setSelected(next);
  };
  const search = (value) => {
    setQuery(value);
    setNotePage(1);
    setSelected([]);
  };
  const openNote = (note) => setModal({ type: "note", data: note });
  const openTask = (task) => setModal({ type: "task-detail", data: task.id });
  const importLibrary = async () => {
    const values = await perform("import_word_library");
    if (values) setModal({ type: "word", data: values });
  };
  const exportLibrary = async (l) => {
    const path = await perform("export_word_library", [l.id], "词库已导出");
    if (path) setModal({ type: "path", data: path });
  };
  const exportModal = () =>
    setModal({
      type: "export",
      data: {
        filters: effectiveFilters,
        count: notes.total,
        selected: [...selected],
      },
    });
  const toggleDemo = async () => {
    const result = await perform("toggle_demo");
    if (result !== undefined) {
      close();
      navigate("dashboard");
      setNoteVersion((v) => v + 1);
      toast(result ? "已进入独立演示工作区" : "已返回真实工作区");
    }
  };
  const taskRows = useMemo(
    () =>
      snap?.tasks.filter(
        (t) =>
          (taskStatus === "all" || t.status === taskStatus) &&
          `${t.keyword} ${t.message}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ) || [],
    [snap, taskStatus, query],
  );
  const busyWorkspace = Boolean(
    snap?.engine.active ||
      snap?.engine.login_busy ||
      snap?.tasks.some((t) => t.status === "queued"),
  );
  const activeTask = snap?.tasks.find((t) => t.id === snap.engine.active);
  const modalTask = snap?.tasks.find((t) => t.id === modal?.data);

  if (!snap)
    return (
      <div className="connection-screen">
        <div className="ambient">
          <i />
          <i />
          <i />
        </div>
        <Glass>
          <span className="brand-icon">
            <Layers2 size={27} />
          </span>
          <h1>拾页 Daylight</h1>
          <p>{connectionError || "正在连接本地工作区…"}</p>
          {connectionError && (
            <Button icon={RefreshCw} className="primary" onClick={refresh}>
              重新连接
            </Button>
          )}
        </Glass>
      </div>
    );
  const libraries = snap.libraries.filter((l) =>
    `${l.name} ${l.description} ${l.search_terms.join(" ")} ${l.include_words.join(" ")} ${l.exclude_words.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <div className="ambient" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div
        className={`app-shell native-app ${collapsed ? "is-collapsed" : ""}`}
      >
        {menu && mobile && (
          <button
            className="nav-scrim"
            aria-label="关闭导航"
            onClick={() => setMenu(false)}
          />
        )}
        <aside
          className={`sidebar glass ${menu ? "mobile-open" : ""}`}
          aria-label="主导航"
          role={mobile ? "dialog" : undefined}
          aria-modal={mobile && menu ? true : undefined}
          aria-hidden={mobile && !menu}
          inert={mobile && !menu}
        >
          <IconButton
            icon={X}
            label="关闭导航菜单"
            className="mobile-nav-close"
            onClick={() => setMenu(false)}
          />
          <button
            className="brand"
            onClick={() => navigate("dashboard")}
            aria-label="拾页，返回工作台"
          >
            <span className="brand-icon">
              <Layers2 size={23} />
            </span>
            <span className="brand-copy">
              <b>拾页</b>

            </span>
          </button>
          <div className="workspace-wrap">
            <button
              className="workspace-switch"
              aria-expanded={switcher}
              onClick={() => setSwitcher(!switcher)}
            >
              <span className="workspace-avatar">拾</span>
              <span className="nav-copy">
                <b>{snap.demo ? "演示工作区" : snap.settings.workspace}</b>

              </span>
              <ChevronDown size={14} />
            </button>
            {switcher && (
              <div className="workspace-popover glass">
                <p>
                  <Check size={14} />
                  {snap.demo ? "演示工作区" : snap.settings.workspace}
                </p>
                <button disabled={busyWorkspace} onClick={toggleDemo}>
                  {snap.demo ? "返回真实工作区" : "体验演示工作区"}
                </button>
                <button
                  onClick={() => {
                    setSwitcher(false);
                    setModal({ type: "settings" });
                  }}
                >
                  <Settings2 size={14} />
                  工作区设置
                </button>
                {busyWorkspace && <small>请先结束当前任务，再切换。</small>}
              </div>
            )}
          </div>
          <nav>
            {nav.map(([id, Icon, label]) => (
              <button
                key={id}
                className={`nav-item ${page === id ? "active" : ""}`}
                title={label}
                onClick={() => navigate(id)}
              >
                {page === id && (
                  <motion.span
                    layoutId="desktop-nav"
                    className="nav-highlight"
                  />
                )}
                <Icon size={18} />
                <span className="nav-copy">{label}</span>
                {id === "tasks" && (
                  <span className="nav-count">
                    {
                      snap.tasks.filter(
                        (t) => !["completed", "stopped"].includes(t.status),
                      ).length
                    }
                  </span>
                )}
                {id === "library" && (
                  <span className="nav-count">{snap.stats.total}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="nav-section-label favorites-label">
            <span>快捷访问</span>
            <Bookmark size={12} />
          </div>
          <nav>
            <button
              className={`nav-item ${page === "saved" ? "active" : ""}`}
              title="收藏笔记"
              onClick={() => navigate("saved")}
            >
              <Bookmark size={17} />
              <span className="nav-copy">收藏笔记</span>
              <span className="nav-count">{savedIds.length}</span>
            </button>
            {snap.stats.keywords.slice(0, 3).map((k, i) => (
              <button
                className="nav-item"
                key={k.keyword}
                title={k.keyword}
                onClick={() => {
                  navigate("library");
                  search(k.keyword);
                }}
              >
                <span className={`folder-dot ${i % 2 ? "orange" : "purple"}`} />
                <span className="nav-copy">{k.keyword}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-spacer" />
          {!snap.demo && <div className="desktop-browser-card">
            <span>
              <i
                className={`column-dot ${snap.engine.browser === "open" ? "green" : "gray"}`}
              />
              <b>
                {snap.demo
                  ? "演示模式"
                  : snap.engine.browser === "open"
                    ? "浏览器已打开"
                    : snap.engine.login_busy
                      ? "正在打开浏览器"
                      : "浏览器未打开"}
              </b>
            </span>

            <Button
              className="small"
              icon={Globe2}
              disabled={
                snap.demo ||
                snap.engine.login_busy ||
                Boolean(snap.engine.active)
              }
              onClick={() =>
                perform("login", [], "正在打开采集浏览器，请手动完成登录。")
              }
            >
              打开登录浏览器
            </Button>
          </div>}
          <button
            className="nav-item settings-nav"
            title="工作区设置"
            onClick={() => setModal({ type: "settings" })}
          >
            <Settings2 size={17} />
            <span className="nav-copy">工作区设置</span>
          </button>
          <div className="sidebar-user">
            <span className="nav-copy">收起导航</span>
            <IconButton
              icon={collapsed ? PanelLeftOpen : PanelLeftClose}
              label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
              onClick={() => setCollapsed(!collapsed)}
            />
          </div>
        </aside>
        <div className="main-shell" inert={mobile && menu}>
          <header className="topbar">
            <div className="topbar-actions">
              <IconButton icon={Menu} label="打开导航" className="mobile-menu" onClick={() => setMenu(true)} />
              <button
                className="global-search"
                aria-label="全局搜索（Ctrl 或 ⌘ + K）"
                onClick={() => setModal({ type: "command" })}
              >
                <Search size={15} />
                <span>搜索笔记或任务</span>
                <kbd>Ctrl K</kbd>
              </button>
              <span className="topbar-divider" />
              <IconButton
                icon={Bell}
                label="工作空间动态"
                onClick={() => setModal({ type: "events" })}
              />
              <IconButton
                icon={CircleHelp}
                label="使用帮助"
                onClick={() => setModal({ type: "help" })}
              />

            </div>
          </header>
          <main id="main-content" className="main-content" tabIndex={-1}>
            {connectionError && (
              <div className="storage-warning" role="alert">
                本地接口暂不可用：{connectionError}
                <Button className="small" icon={RefreshCw} onClick={refresh}>
                  重试
                </Button>
              </div>
            )}
            {snap.demo && (
              <div className="demo-banner">
                <span>
                  <ShieldCheck size={15} />
                  演示模式 · 以下为示例数据，不会发起采集
                </span>
                <button disabled={busyWorkspace} onClick={toggleDemo}>
                  返回真实工作区
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
            <div className="page-heading">
              <div>
                <h1>{titles[page]}</h1>
              </div>
              <div className="heading-actions">
                {page === "words" ? (
                  <>
                    <Button icon={Upload} onClick={importLibrary}>
                      导入词库
                    </Button>
                    <Button
                      className="primary"
                      icon={Plus}
                      onClick={() => setModal({ type: "word" })}
                    >
                      新建词库
                    </Button>
                  </>
                ) : (
                  <Button
                    className="primary"
                    icon={Plus}
                    onClick={() => newTask()}
                  >
                    新建采集任务
                  </Button>
                )}
              </div>
            </div>
            {page === "dashboard" && (
              <div className="dashboard-overview">
                <div className="overview-metrics">
                  {[
                    ["资料库笔记", snap.stats.total, Library, "library"],
                    ["今日新增", snap.stats.today, Download, "library"],
                    ["未完成任务", snap.tasks.filter(t => !["completed", "stopped"].includes(t.status)).length, SquareCheckBig, "tasks"],
                  ].map(([label, value, Icon]) => (
                    <Glass className="overview-metric" key={label}>
                      <span className="metric-label"><Icon size={17} />{label}</span>
                      <b>{number(value)}</b>
                    </Glass>
                  ))}
                </div>
                <Glass className="workbench overview-workbench">
                  <SectionHeading title="最近任务" action={<TextLink onClick={() => navigate("tasks")}>全部任务</TextLink>} />
                  <DesktopTasks tasks={snap.tasks.slice(0, 5)} view="list" overview demo={snap.demo} onOpen={openTask} onAction={taskAction} onNew={newTask} />
                </Glass>
                <section className="recent-section">
                  <SectionHeading title="最近收集" action={<TextLink onClick={() => navigate("library")}>全部笔记</TextLink>} />
                  {notesError ? <p className="form-error">{notesError}</p> : notes.rows.length ? (
                    <div className="recent-notes">
                      {notes.rows.slice(0, 3).map(n => <DesktopNoteCard key={n.id} note={n} saved={savedIds.includes(n.id)} compact demo={snap.demo} onOpen={() => openNote(n)} onSave={() => toggleSaved(n)} />)}
                    </div>
                  ) : <Glass><Empty title={loadingNotes ? "正在读取…" : "暂无笔记"} text="采集完成后显示在这里。" /></Glass>}
                </section>
              </div>
            )}
            {page === "tasks" && (
              <Glass className="page-panel tasks-page">
                <DesktopTasks tasks={taskRows} view={view} setView={setView} demo={snap.demo} onOpen={openTask} onAction={taskAction} onNew={newTask}
                  filtered={Boolean(query||taskStatus!=="all")} onClear={()=>{search("");setTaskStatus("all");}}
                  toolbarContent={<>
                    <div className="inline-search"><Search size={16}/><input aria-label="搜索采集任务" placeholder="搜索关键词或任务消息" value={query} onChange={e=>search(e.target.value)}/></div>
                    <select className="filter-select" aria-label="任务状态" value={taskStatus} onChange={e=>setTaskStatus(e.target.value)}>
                      <option value="all">全部状态</option>{Object.entries(statuses).map(([key,[label]])=><option key={key} value={key}>{label}</option>)}
                    </select>
                    <IconButton icon={RefreshCw} label="刷新任务进度" onClick={refresh}/>
                  </>}
                  notice={activeTask && <div className="active-engine"><i className="live-dot"/>{activeTask.keyword}<span>{activeTask.message}</span></div>}
                />
              </Glass>
            )}
            {["library", "saved"].includes(page) && (
              <>
                <Glass className="library-toolbar content-toolbar">
                  <div className="inline-search">
                    <Search size={16} />
                    <input
                      aria-label="搜索资料"
                      placeholder="搜索标题、作者或关键词…"
                      value={query}
                      onChange={(e) => search(e.target.value)}
                    />
                    {query && (
                      <IconButton
                        icon={X}
                        label="清空搜索"
                        onClick={() => search("")}
                      />
                    )}
                  </div>
                  <select
                    className="filter-select"
                    aria-label="内容类型"
                    value={filters.note_type || "all"}
                    onChange={(e) =>
                      changeFilters({ ...filters, note_type: e.target.value })
                    }
                  >
                    <option value="all">全部类型</option>
                    <option value="image">图文</option>
                    <option value="video">视频</option>
                  </select>
                  <select
                    className="filter-select"
                    aria-label="资料排序"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      setNotePage(1);
                    }}
                  >
                    <option value="latest">最新采集</option>
                    <option value="oldest">最早采集</option>
                    <option value="likes">点赞最多</option>
                  </select>
                  <select
                    className="filter-select"
                    aria-label="正文状态"
                    value={filters.detail || ""}
                    onChange={(e) =>
                      changeFilters({ ...filters, detail: e.target.value })
                    }
                  >
                    <option value="">全部正文状态</option>
                    <option value="full">已读取完整正文</option>
                  </select>
                  <select
                    className="filter-select"
                    aria-label="来源任务"
                    value={filters.task_id || ""}
                    onChange={(e) =>
                      changeFilters({ ...filters, task_id: e.target.value })
                    }
                  >
                    <option value="">全部来源任务</option>
                    {snap.tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.keyword} · {t.id.slice(0, 6)}
                      </option>
                    ))}
                  </select>
                  <Button
                    className="small"
                    icon={SlidersHorizontal}
                    onClick={() => setModal({ type: "filter" })}
                  >
                    组合筛选
                  </Button>
                  <Button
                    className="small"
                    icon={Download}
                    onClick={exportModal}
                  >
                    导出数据
                  </Button>
                </Glass>
                {Object.keys(filters).length > 0 && (
                  <div className="active-filter-chips">
                    <span>
                      {filters.task_id ? "已限定本任务结果" : "组合筛选已应用"}
                    </span>
                    {filters.regions?.length > 0 && (
                      <span>属地：{filters.regions.join(" / ")}</span>
                    )}
                    {(filters.date_from || filters.date_to) && (
                      <span>
                        发布时间：{filters.date_from || "不限"} 至{" "}
                        {filters.date_to || "不限"}
                      </span>
                    )}
                    <button onClick={() => changeFilters({})}>
                      <X size={12} />
                      清除筛选
                    </button>
                  </div>
                )}
                <div className="results-summary">
                  <span>
                    {loadingNotes
                      ? "正在读取…"
                      : `${number(notes.total)} 条${page === "saved" ? "收藏" : "资料"}`}
                    {selected.length > 0 &&
                      ` · 已选择 ${selected.length} 条记录`}
                  </span>
                  <label className="select-page">
                    <input
                      type="checkbox"
                      aria-label="选择当前页全部笔记"
                      checked={
                        notes.rows.length > 0 &&
                        notes.rows.every((n) => selected.includes(n.id))
                      }
                      onChange={(e) => selectPage(e.target.checked)}
                    />
                    选择本页
                  </label>
                </div>
                {selected.length > 0 && (
                  <div className="selection-bar">
                    <span>已选择 {selected.length} 条记录</span>
                    <Button
                      className="small"
                      icon={Download}
                      onClick={exportModal}
                    >
                      导出所选
                    </Button>
                    <button onClick={() => setSelected([])}>取消选择</button>
                  </div>
                )}
                {notesError ? (
                  <Glass>
                    <Empty
                      title="读取资料时遇到问题"
                      text={notesError}
                      action={
                        <Button
                          icon={RefreshCw}
                          onClick={() => setNoteVersion((v) => v + 1)}
                        >
                          重试
                        </Button>
                      }
                    />
                  </Glass>
                ) : (
                  <div className="notes-grid" aria-busy={loadingNotes}>
                    {notes.rows.map((n) => (
                      <DesktopNoteCard
                        key={n.id}
                        note={n}
                        saved={savedIds.includes(n.id)}
                        selected={selected.includes(n.id)}
                        demo={snap.demo}
                        onOpen={() => openNote(n)}
                        onSave={() => toggleSaved(n)}
                        onSelect={() => selectNote(n.id)}
                      />
                    ))}
                  </div>
                )}
                {!notesError && !loadingNotes && !notes.total && (
                  <Glass>
                    <Empty
                      title={
                        page === "saved"
                          ? "还没有符合条件的收藏"
                          : "没有符合条件的资料"
                      }
                      text="可以调整筛选条件，或者在采集完成后回到这里。"
                      action={
                        <Button
                          onClick={() => {
                            changeFilters({});
                            search("");
                            if (page === "saved") navigate("library");
                          }}
                        >
                          浏览资料库
                        </Button>
                      }
                    />
                  </Glass>
                )}
                <div className="pagination">
                  <span>
                    每页 30 条 · 第 {notePage} /{" "}
                    {Math.max(1, Math.ceil(notes.total / 30))} 页
                  </span>
                  <Button
                    className="small"
                    disabled={notePage <= 1 || loadingNotes}
                    onClick={() => setNotePage((p) => p - 1)}
                  >
                    上一页
                  </Button>
                  <Button
                    className="small"
                    disabled={notePage * 30 >= notes.total || loadingNotes}
                    onClick={() => setNotePage((p) => p + 1)}
                  >
                    下一页
                  </Button>
                </div>
              </>
            )}
            {page === "words" && (
              <>
                <Glass className="library-toolbar content-toolbar">
                  <div className="inline-search">
                    <Search size={16} />
                    <input
                      aria-label="搜索词库"
                      placeholder="搜索词库或关键词"
                      value={query}
                      onChange={(e) => search(e.target.value)}
                    />
                  </div>
                  <span className="collection-count">{libraries.length} 个词库</span>
                </Glass>
                <div className="word-grid">
                  {libraries.map((l, i) => (
                    <Glass className="word-card" key={l.id}>
                      <div className="word-card-top">
                        <span
                          className={`word-icon ${i % 2 ? "orange" : "blue"}`}
                        >
                          <BookOpen size={23} />
                        </span>
                        <span>{l.search_terms.length} 个搜索词</span>
                      </div>
                      <h2><button type="button" onClick={()=>setModal({type:"word",data:l})}>{l.name}</button></h2>
                      {l.description && <p>{l.description}</p>}
                      <div className="word-chips">
                        {l.search_terms.slice(0, 6).map((w) => (
                          <span key={w}>
                            <Hash size={11} />
                            {w}
                          </span>
                        ))}
                        {l.search_terms.length > 6 && (
                          <span>+ {l.search_terms.length - 6}</span>
                        )}
                      </div>
                      {(l.include_words.length > 0 || l.exclude_words.length > 0) && <div className="word-rules">
                        {l.include_words.length > 0 && <span>包含 {l.include_words.length} 词 · {l.include_mode === "all" ? "全部" : "任一"}命中</span>}
                        {l.exclude_words.length > 0 && <span>排除 {l.exclude_words.length} 词</span>}
                      </div>}
                      <div className="word-card-actions">
                        <Button className="primary small" icon={Plus} onClick={()=>newTask(l)}>用于采集</Button>
                        <Button className="small" onClick={()=>setModal({type:"word",data:l})}>编辑</Button>
                        <Button className="small" icon={Download} onClick={()=>exportLibrary(l)}>导出</Button>
                      </div>
                    </Glass>
                  ))}
                  {!libraries.length && <Glass className="word-empty"><Empty title={query ? "没有匹配的词库" : "暂无词库"} action={query ? <Button onClick={()=>search("")}>清除搜索</Button> : <Button icon={Plus} onClick={()=>setModal({type:"word"})}>新建词库</Button>}/></Glass>}

                </div>
              </>
            )}

          </main>
        </div>
      </div>
      <AnimatePresence mode="wait">
        {modal && (
          <Dialog
            key={`${modal.type}-${modal.data?.id || (modal.type === "task-detail" && modal.data) || ""}`}
            title={
              {
                task: "新建采集任务",
                word: modal.data?.id ? "编辑词库" : "新建词库",
                filter: "组合筛选资料库",
                export: "导出笔记数据",
                settings: "工作区设置",
                licenses: "第三方许可",
                note: "笔记详情",
                command: "搜索与快捷指令",
                "task-detail": "采集任务详情",
                events: "工作空间动态",
                help: "使用帮助",
                path: "文件已保存到本机",
              }[modal.type]
            }
            onClose={close}
            wide={["task", "word", "filter", "command", "settings", "licenses"].includes(
              modal.type,
            )}
            drawer={["note", "task-detail"].includes(modal.type)}
          >
            {modal.type === "task" && (
              <NewTaskForm
                snapshot={snap}
                initial={modal.data}
                onDone={async (ids) => {
                  await refresh();
                  close();
                  navigate("tasks");
                  toast(`已创建 ${ids.length} 个采集任务`);
                }}
              />
            )}
            {modal.type === "word" && (
              <LibraryForm
                library={modal.data}
                onDone={async () => {
                  await refresh();
                  close();
                  toast("词库已保存");
                }}
                onDelete={async () => {
                  await refresh();
                  close();
                  toast("词库已删除；既有任务快照不变");
                }}
              />
            )}
            {modal.type === "filter" && (
              <FilterForm
                filters={filters}
                onApply={(rules) => {
                  changeFilters({
                    ...rules,
                    ...(filters.task_id ? { task_id: filters.task_id } : {}),
                    ...(filters.detail ? { detail: filters.detail } : {}),
                  });
                  close();
                  toast("筛选已应用");
                }}
              />
            )}
            {modal.type === "export" && (
              <ExportForm
                snapshot={snap}
                filters={modal.data.filters}
                count={modal.data.count}
                selected={modal.data.selected}
                onDone={refresh}
              />
            )}
            {modal.type === "licenses" && <ThirdPartyLicenses/>}
            {modal.type === "settings" && (
              <SettingsForm
                snapshot={snap}
                onDone={async () => {
                  await refresh();
                  close();
                  toast("工作区设置已保存");
                }}
              />
            )}
            {modal.type === "note" && (
              <NativeNoteDetail
                note={modal.data}
                demo={snap.demo}
                saved={savedIds.includes(modal.data.id)}
                onSave={() => toggleSaved(modal.data)}
                onOpen={() => perform("open_note", [modal.data.id])}
              />
            )}
            {modal.type === "task-detail" &&
              (modalTask ? (
                <TaskDetail
                  task={modalTask}
                  snapshot={snap}
                  onAction={taskAction}
                  onRepeat={(t) =>
                    newTask({
                      ...t,
                      criteria: {
                        ...t.criteria,
                        date_preset:
                          t.criteria?.date_from || t.criteria?.date_to
                            ? "custom"
                            : "all",
                      },
                    })
                  }
                  onNotes={(id) => {
                    close();
                    navigate("library");
                    changeFilters({ task_id: id });
                  }}
                  onNoteSaved={async () => {
                    await refresh();
                    toast("备注已保存");
                  }}
                />
              ) : (
                <Empty title="任务不在当前列表中" />
              ))}
            {modal.type === "command" && (
              <DesktopCommand
                snapshot={snap}
                onNavigate={(p) => {
                  close();
                  navigate(p);
                }}
                onNew={() => newTask()}
                onTask={openTask}
                onNote={openNote}
              />
            )}
            {modal.type === "events" && (
              <div className="activity-list">
                <p className="field-help">
                  {snap.demo ? "演示数据库动态" : "本机采集与导出日志"}
                </p>
                {snap.events.map((e) => (
                  <div className="activity-item" key={e.id}>
                    <span>
                      <CheckCheck size={17} />
                    </span>
                    <p className={e.level === "error" ? "log-error" : ""}>
                      {e.message}
                      <small>{formatDate(e.created_at)}</small>
                    </p>
                  </div>
                ))}
                {!snap.events.length && <Empty title="还没有工作空间动态" />}
              </div>
            )}
            {modal.type === "path" && (
              <div className="form">
                <div className="export-path">
                  <FolderOpen size={18} />
                  <span>{modal.data}</span>
                </div>
                <Button
                  icon={FolderOpen}
                  onClick={() => perform("open_folder", ["exports"])}
                >
                  打开导出目录
                </Button>
                <Button
                  className="primary"
                  onClick={() => perform("open_export", [modal.data])}
                >
                  打开文件
                </Button>
              </div>
            )}
            {modal.type === "help" && (
              <div className="help-content">
                <span className="help-brand">
                  <Layers2 size={26} />
                  <b>拾页 Daylight Pro {snap.version}</b>
                </span>
                <h3>开始采集</h3>
                <p>
                  1. 打开登录浏览器，手动登录小红书。
                  2. 新建任务，填写关键词和采集条件。
                  3. 在资料库筛选、勾选并导出笔记。
                </p>
                <div className="help-shortcuts">
                  <span>
                    全局搜索<kbd>Ctrl / ⌘ + K</kbd>
                  </span>
                  <span>
                    新建任务<kbd>Ctrl / ⌘ + N</kbd>
                  </span>
                  <span>
                    关闭弹窗<kbd>Esc</kbd>
                  </span>
                  <span>
                    搜索结果选择<kbd>↑ ↓ / Enter</kbd>
                  </span>
                </div>
                <div className="insight-tip">
                  <h4>筛选与采集说明</h4>
                  <p>
                    不同条件同时满足；地区和作者名单内满足任一；排除词优先。缺失必需字段的笔记会跳过，详情可查看原因。公开
                    IP 属地不是用户真实
                    IP，作者主页当前地区不能代表历史帖子的实际发布地区。
                  </p>
                </div>
                <p>
                  登录、验证与平台提示需要你在浏览器里手动处理。网站结构和字段公开范围变化可能影响读取。数据保存在本机，不会自动同步到其他设备。
                </p>
                <div className="help-actions">
                  <Button disabled={busyWorkspace} onClick={toggleDemo}>
                    {snap.demo ? "返回真实工作区" : "切换到独立演示工作区"}
                  </Button>
                  <Button onClick={() => setModal({ type: "settings" })}>数据备份与设置</Button>
                  <Button onClick={()=>setModal({type:"licenses"})}>第三方许可</Button>
                </div>
                {snap.upgrade_backup && (
                  <p className="field-help selectable-path">
                    升级前备份：{snap.upgrade_backup}
                  </p>
                )}
              </div>
            )}
          </Dialog>
        )}
      </AnimatePresence>
      <Toasts
        items={notices}
        dismiss={(id) => setNotices((v) => v.filter((t) => t.id !== id))}
      />
    </MotionConfig>
  );
}
