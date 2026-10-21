import React, { useState } from "react";
import {
  Plus,
  Save,
  FolderOpen,
  Download,
  Check,
  ShieldCheck,
  ArrowUpRight,
  Trash2,
  SlidersHorizontal,
  Copy,
} from "lucide-react";
import { Button, Empty, SegmentedTabs } from "./ui";
import {
  call,
  displayRules,
  emptyRules,
  formatDate,
  number,
  rulePayload,
  splitTerms,
} from "./bridge";

export function RuleFields({ values, onChange, collection = false }) {
  const v = values;
  const set = (k, e) =>
    onChange({
      ...v,
      [k]: e.target.value,
      ...(k === "date_preset" && e.target.value !== "custom"
        ? { date_from: "", date_to: "" }
        : {}),
    });
  return (
    <div className="rule-fields">
      <div className="form-grid">
        <label>
          公开 IP 属地
          <textarea
            rows={2}
            value={v.regions}
            onChange={(e) => set("regions", e)}
            placeholder="北京，上海；多个地区满足任一"
          />
        </label>
        <label>
          属地来源
          <select value={v.ip_source} onChange={(e) => set("ip_source", e)}>
            <option value="either">笔记优先，缺失时尝试作者主页</option>
            <option value="note">仅笔记公开属地</option>
            <option value="author">仅作者主页公开属地</option>
          </select>
        </label>
        <label>
          帖子发布时间
          <select value={v.date_preset} onChange={(e) => set("date_preset", e)}>
            <option value="all">不限发布时间</option>
            <option value="last1">今天（北京时间）</option>
            <option value="last7">近 7 天</option>
            <option value="last30">近 30 天</option>
            <option value="last90">近 90 天</option>
            <option value="custom">自定义日期范围</option>
          </select>
        </label>
        <label>
          内容类型
          <select value={v.note_type} onChange={(e) => set("note_type", e)}>
            <option value="all">全部类型</option>
            <option value="image">图文</option>
            <option value="video">视频</option>
          </select>
        </label>
      </div>
      {v.date_preset === "custom" && (
        <div className="form-grid">
          <label>
            开始日期
            <input
              type="date"
              value={v.date_from}
              onChange={(e) => set("date_from", e)}
            />
          </label>
          <label>
            结束日期
            <input
              type="date"
              value={v.date_to}
              onChange={(e) => set("date_to", e)}
            />
          </label>
        </div>
      )}
      <div className="form-grid">
        <label>
          最低点赞数
          <input
            type="number"
            min="0"
            max="1000000000"
            value={v.min_likes ?? ""}
            onChange={(e) => set("min_likes", e)}
            placeholder="不限"
          />
        </label>
        <label>
          最高点赞数
          <input
            type="number"
            min="0"
            max="1000000000"
            value={v.max_likes ?? ""}
            onChange={(e) => set("max_likes", e)}
            placeholder="不限"
          />
        </label>
        <label>
          限定作者完整昵称
          <textarea
            rows={2}
            value={v.authors}
            onChange={(e) => set("authors", e)}
            placeholder="多个昵称用换行或逗号分隔"
          />
        </label>
        <label>
          排除作者完整昵称
          <textarea
            rows={2}
            value={v.exclude_authors}
            onChange={(e) => set("exclude_authors", e)}
            placeholder="任一完整昵称匹配即排除"
          />
        </label>
      </div>
      <label>
        包含词
        <textarea
          rows={2}
          value={v.include_words}
          onChange={(e) => set("include_words", e)}
          placeholder="多个词用换行或逗号分隔"
        />
      </label>
      <div className="form-grid">
        <label>
          包含词命中方式
          <select
            value={v.include_mode}
            onChange={(e) => set("include_mode", e)}
          >
            <option value="any">任一词命中</option>
            <option value="all">全部词命中</option>
          </select>
        </label>
        <label>
          文本匹配范围
          <select value={v.text_scope} onChange={(e) => set("text_scope", e)}>
            <option value="both">标题与正文</option>
            <option value="title">仅标题</option>
            <option value="body">仅正文</option>
          </select>
        </label>
      </div>
      <label>
        排除词
        <textarea
          rows={2}
          value={v.exclude_words}
          onChange={(e) => set("exclude_words", e)}
          placeholder="任一词命中即跳过，优先于包含词"
        />
      </label>
      {collection && (
        <label>
          每轮候选扫描上限
          <input
            type="number"
            required
            min="1"
            max="20000"
            value={v.max_scan}
            onChange={(e) => set("max_scan", e)}
          />
          <small>只统计符合条件的笔记；达到上限后可继续采集。</small>
        </label>
      )}
      <details className="rule-explanation">
        <summary>筛选规则说明</summary>
        <p>不同条件需同时满足；地区和作者名单满足任一，排除词优先。所需字段缺失时跳过该笔记。</p>
        <p>公开属地不是真实 IP，也不代表历史发帖地点。日期按北京时间计算，条件在创建或应用时固定。</p>
      </details>
    </div>
  );
}

export function NewTaskForm({ snapshot, initial, onDone }) {
  const [keywords, setKeywords] = useState(
    initial?.keyword || initial?.search_terms?.join("\n") || "",
  );
  const [target, setTarget] = useState(initial?.target || 100);
  const [mode, setMode] = useState(initial?.mode || "fast");
  const [library, setLibrary] = useState(
    initial?.search_terms ? initial.id : "",
  );
  const [rules, setRules] = useState(
    displayRules(initial?.criteria || initial),
  );
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function load(id) {
    setLibrary(id);
    const l = snapshot.libraries.find((l) => l.id === id);
    if (l) {
      setKeywords(l.search_terms.join("\n"));
      setRules((v) => ({
        ...v,
        include_words: l.include_words.join("\n"),
        exclude_words: l.exclude_words.join("\n"),
        include_mode: l.include_mode,
      }));
    }
  }
  async function submit(e) {
    e.preventDefault();
    setError("");
    const words = splitTerms(keywords);
    if (!words.length || words.length > 30) {
      setError("请填写 1–30 个搜索词。");
      return;
    }
    setBusy(true);
    try {
      const ids = await call("create_tasks", {
        keywords: words,
        target: Number(target),
        mode,
        library_id: library || undefined,
        criteria: rulePayload(rules),
      });
      await onDone(ids);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form id="task-form" className="form" onSubmit={submit}>
      {(snapshot.demo || snapshot.engine.browser !== "open") && <p className={`mode-notice ${snapshot.demo ? "is-demo" : ""}`}>
        <ShieldCheck size={14} />
        {snapshot.demo ? "演示模式不可采集，请切换到真实工作区。" : "首次采集前，请打开浏览器并登录小红书。"}
      </p>}
      <label>
        载入自定义词库
        <select value={library} onChange={(e) => load(e.target.value)}>
          <option value="">手动填写搜索词</option>
          {snapshot.libraries.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        搜索关键词
        <textarea
          data-autofocus
          id="keywords"
          required
          maxLength={3000}
          rows={3}
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="每行一个关键词，例如：AI 办公"
        />
        <small>
          最多 30 个，每个不超过 80 字。
        </small>
      </label>
      <div className="form-grid">
        <label>
          每个关键词的目标数量
          <input
            type="number"
            required
            min="1"
            max="1000"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </label>
        <label>
          采集模式
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="fast">快速模式 · 标题与基础信息</option>
            <option value="deep">深度模式 · 读取完整正文</option>
          </select>
        </label>
      </div>
      <button
        type="button"
        className="advanced-toggle"
        aria-expanded={advanced}
        onClick={() => setAdvanced(!advanced)}
      >
        <span>
          <SlidersHorizontal size={15} />
          组合筛选条件
        </span>
        <span>{advanced ? "收起" : "展开"}</span>
      </button>
      {advanced && <RuleFields values={rules} onChange={setRules} collection />}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <span className="field-help">
          {splitTerms(keywords).length} 个关键词任务
        </span>
        <Button
          type="submit"
          className="primary"
          icon={Plus}
          disabled={snapshot.demo || busy}
        >
          {busy ? "正在加入队列…" : "创建采集任务"}
        </Button>
      </div>
    </form>
  );
}

export function FilterForm({ filters, onApply }) {
  const [values, setValues] = useState(displayRules(filters));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      id="library-filter-form"
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const rules = await call("preview_criteria", rulePayload(values));
          await onApply(rules);
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <RuleFields values={values} onChange={setValues} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button onClick={() => setValues({ ...emptyRules })}>清空条件</Button>
        <Button className="primary" type="submit" disabled={busy} icon={Check}>
          {busy ? "正在校验…" : "应用筛选"}
        </Button>
      </div>
    </form>
  );
}

export function LibraryForm({ library, onDone, onDelete }) {
  const [v, setV] = useState({
    name: library?.name || "",
    description: library?.description || "",
    search_terms: library?.search_terms?.join("\n") || "",
    include_words: library?.include_words?.join("\n") || "",
    exclude_words: library?.exclude_words?.join("\n") || "",
    include_mode: library?.include_mode || "any",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const change = (k, e) => setV({ ...v, [k]: e.target.value });
  return (
    <form
      id="word-library-form"
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const saved = await call("save_word_library", {
            ...v,
            id: library?.id,
            ...Object.fromEntries(
              ["search_terms", "include_words", "exclude_words"].map((k) => [
                k,
                splitTerms(v[k]),
              ]),
            ),
          });
          await onDone(saved);
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <label>词库名称<input data-autofocus aria-label="词库名称" required maxLength={40} value={v.name} onChange={e=>change("name",e)}/></label>
        <label>说明（选填）<input aria-label="词库说明" maxLength={300} value={v.description} onChange={e=>change("description",e)}/></label>
      </div>
      <label>
        搜索词
        <textarea
          rows={4}
          maxLength={3000}
          value={v.search_terms}
          onChange={(e) => change("search_terms", e)}
          placeholder="每行一个，最多 30 个"
        />
      </label>
      <div className="form-grid">
        <label>包含词<textarea rows={3} maxLength={33000} value={v.include_words} onChange={e=>change("include_words",e)} placeholder="每行一个，最多 300 个"/></label>
        <label>排除词<textarea rows={3} maxLength={33000} value={v.exclude_words} onChange={e=>change("exclude_words",e)} placeholder="每行一个，最多 300 个"/></label>
      </div>
      <label>包含词匹配方式<select value={v.include_mode} onChange={e=>change("include_mode",e)}><option value="any">任一词命中</option><option value="all">全部词命中</option></select></label>
      <p className="field-help">
        修改词库不影响已创建的任务。
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        {library?.id && (
          <Button
            className={confirm ? "danger" : "ghost"}
            icon={Trash2}
            disabled={busy}
            onClick={async () => {
              if (!confirm) {
                setConfirm(true);
                return;
              }
              setBusy(true);
              try {
                await call("delete_word_library", library.id);
                await onDelete();
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirm ? "确认删除词库" : "删除词库"}
          </Button>
        )}
        <Button className="primary" type="submit" disabled={busy} icon={Save}>
          {busy ? "正在保存…" : "保存词库"}
        </Button>
      </div>
    </form>
  );
}

export function ExportForm({ snapshot, filters, count, selected, onDone }) {
  const [format, setFormat] = useState(snapshot.settings.export_format);
  const [scope, setScope] = useState(selected.length ? "selected" : "filtered");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await call("export_notes", {
        format,
        filters:
          scope === "all"
            ? {}
            : {
                ...filters,
                ...(scope === "selected" ? { ids: selected } : {}),
              },
      });
      setResult(result);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="form">
      {result ? (
        <div className="export-success">
          <span className="export-success-icon">
            <Check size={27} />
          </span>
          <h3>已导出 {number(result.count)} 条笔记</h3>
          <p>{result.path}</p>
          <div>
            <Button
              icon={FolderOpen}
              onClick={async () => {
                try {
                  await call("open_folder", "exports");
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              打开导出文件夹
            </Button>
            <Button
              className="primary"
              icon={ArrowUpRight}
              onClick={async () => {
                try {
                  await call("open_export", result.path);
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              打开文件
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="field-help">
            导出文件将写入工作区设置中的目录，保留属地、发布时间来源、正文状态和命中词等全部原版字段。
          </p>
          <label>
            导出范围
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="filtered">
                当前筛选范围 · {number(count)} 条
              </option>
              <option value="all">
                整个资料库 · {number(snapshot.stats.total)} 条
              </option>
              {selected.length > 0 && (
                <option value="selected">
                  勾选记录 · {number(selected.length)} 条
                </option>
              )}
            </select>
          </label>
          <label>
            文件格式
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="xlsx">Excel 工作簿 (.xlsx)</option>
              <option value="csv">CSV 表格 (.csv)</option>
              <option value="json">JSON 数据 (.json)</option>
            </select>
          </label>
          <div className="export-path">
            <FolderOpen size={16} />
            <span>{snapshot.settings.export_dir}</span>
          </div>
          {snapshot.demo && (
            <p className="mode-notice">当前导出的内容将标注为演示数据。</p>
          )}
          <Button
            icon={Download}
            className="primary"
            onClick={run}
            disabled={
              busy ||
              (scope === "all"
                ? !snapshot.stats.total
                : scope === "selected"
                  ? !selected.length
                  : !count)
            }
          >
            {busy ? "正在生成文件…" : "导出文件"}
          </Button>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function SettingsForm({snapshot,onDone}) {
  const [v,setV]=useState(snapshot.settings);
  const [section,setSection]=useState("general");
  const [busy,setBusy]=useState(false);
  const [actionBusy,setActionBusy]=useState(false);
  const [error,setError]=useState("");
  const [backup,setBackup]=useState("");
  const change=(key,event)=>setV({...v,[key]:event.target.value});
  const dirty=JSON.stringify(v)!==JSON.stringify(snapshot.settings);
  async function action(name,...args) {
    setError("");setActionBusy(true);
    try{return await call(name,...args);}catch(error){setError(error.message);return null;}finally{setActionBusy(false);}
  }
  async function submit(event) {
    event.preventDefault();setError("");
    if(!v.workspace.trim()){setSection("general");setError("请填写工作区名称。");return;}
    if(!(Number(v.interval)>=3&&Number(v.interval)<=30&&Number(v.detail_interval)>=2&&Number(v.detail_interval)<=30)){setSection("collection");setError("翻页间隔为 3–30 秒，详情间隔为 2–30 秒。");return;}
    setBusy(true);
    try{await call("save_settings",v);await onDone();}catch(error){setError(error.message);}finally{setBusy(false);}
  }
  return <form id="settings-form" className="form settings-form" onSubmit={submit}>
    <SegmentedTabs id="settings-section" label="设置分类" value={section} onChange={setSection} items={[
      {id:"general",label:"常规"},{id:"collection",label:"采集"},{id:"export",label:"导出"},{id:"data",label:"数据与备份"}
    ]}/>
    <div className="settings-section" role="tabpanel" aria-label={{general:"常规设置",collection:"采集设置",export:"导出设置",data:"数据与备份"}[section]}>
      {section==="general" && <label>工作区名称<input data-autofocus aria-label="工作区名称" required maxLength={30} value={v.workspace} onChange={e=>change("workspace",e)}/></label>}
      {section==="collection" && <>
        <label>采集浏览器<select value={v.browser} onChange={e=>change("browser",e)}><option value="auto">自动选择</option><option value="chrome">Google Chrome</option><option value="edge">Microsoft Edge</option></select></label>
        <div className="form-grid">
          <label>翻页间隔（秒）<input type="number" required min="3" max="30" step="0.5" value={v.interval} onChange={e=>change("interval",e)}/></label>
          <label>详情间隔（秒）<input type="number" required min="2" max="30" step="0.5" value={v.detail_interval} onChange={e=>change("detail_interval",e)}/></label>
        </div>
      </>}
      {section==="export" && <>
        <label>导出目录<div className="path-input"><input aria-label="导出目录" required value={v.export_dir} onChange={e=>change("export_dir",e)}/><Button icon={FolderOpen} disabled={actionBusy} onClick={async()=>{const path=await action("choose_folder");if(path)setV({...v,export_dir:path});}}>选择文件夹</Button></div></label>
        <div className="form-grid">
          <label>默认格式<select value={v.export_format} onChange={e=>change("export_format",e)}><option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV (.csv)</option><option value="json">JSON (.json)</option></select></label>
          <label>自动导出<select value={v.auto_export?"yes":"no"} onChange={e=>setV({...v,auto_export:e.target.value==="yes"})}><option value="yes">任务完成后导出</option><option value="no">仅手动导出</option></select></label>
        </div>
      </>}
      {section==="data" && <>
        <div className="backup-actions"><Button className="primary" icon={Download} disabled={actionBusy} onClick={async()=>{const path=await action("backup");if(path)setBackup(path);}}>{actionBusy?"处理中…":"备份数据库"}</Button><Button icon={FolderOpen} disabled={actionBusy} onClick={()=>action("open_folder","backup")}>打开备份文件夹</Button></div>
        <p className="field-help">备份包含内容与设置，不含浏览器登录资料。</p>
        {backup && <div className="backup-result" role="status"><Check size={17}/><div><b>备份已保存</b><p className="selectable-path">{backup}</p></div></div>}
        <div className="data-tools"><Button icon={FolderOpen} disabled={actionBusy} onClick={()=>action("open_folder","logs")}>查看运行日志</Button><details className="storage-location"><summary>查看数据库位置</summary><p className="selectable-path">{snapshot.database}</p></details></div>
      </>}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions settings-actionbar"><span className="field-help" aria-live="polite">{dirty?"有未保存的更改":""}</span><Button type="submit" className="primary" icon={Save} disabled={busy||actionBusy}>{busy?"正在保存…":"保存设置"}</Button></div>
  </form>;
}
