export function waitForBridge(timeout = 18000) {
  return new Promise((resolve, reject) => {
    let interval;
    const finish = () => {
      if (window.pywebview?.api?.snapshot) {
        clearInterval(interval);
        clearTimeout(timer);
        window.removeEventListener("pywebviewready", finish);
        resolve(window.pywebview.api);
        return true;
      }
      return false;
    };
    const timer = setTimeout(() => {
      clearInterval(interval);
      window.removeEventListener("pywebviewready", finish);
      reject(
        new Error(
          "桌面接口未连接。请通过拾页工作台.exe 启动，或重新打开软件。",
        ),
      );
    }, timeout);
    window.addEventListener("pywebviewready", finish);
    interval = setInterval(finish, 100);
    finish();
  });
}
export async function call(name, ...args) {
  const api = await waitForBridge();
  if (typeof api[name] !== "function")
    throw new Error("桌面接口版本不匹配，请使用当前版本的 EXE。");
  const result = await api[name](...args);
  if (!result?.ok) throw new Error(result?.error || "操作未完成，请重试。");
  return result.data;
}
export const statuses = {
  queued: ["等待中", "gray"],
  running: ["采集中", "blue"],
  paused: ["已暂停", "amber"],
  waiting: ["待登录 / 验证", "amber"],
  completed: ["已完成", "green"],
  partial: ["部分完成", "amber"],
  stopped: ["已停止", "gray"],
  error: ["运行异常", "red"],
  interrupted: ["可继续", "purple"],
};
export const splitTerms = (value) => [
  ...new Map(
    String(value || "")
      .normalize("NFKC")
      .split(/[\n,，;；]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => [s.toLowerCase(), s]),
  ).values(),
];
export const number = (value) => Number(value || 0).toLocaleString("zh-CN");
export const shortNumber = (value) =>
  Number(value) >= 10000
    ? `${(Number(value) / 10000).toFixed(1)}万`
    : number(value);
export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "尚未开始";
export const emptyRules = {
  regions: "",
  ip_source: "either",
  date_preset: "all",
  date_from: "",
  date_to: "",
  note_type: "all",
  min_likes: "",
  max_likes: "",
  authors: "",
  exclude_authors: "",
  include_words: "",
  exclude_words: "",
  include_mode: "any",
  text_scope: "both",
  max_scan: 1000,
};
export function displayRules(rules = {}) {
  return {
    ...emptyRules,
    ...rules,
    ...Object.fromEntries(
      [
        "regions",
        "authors",
        "exclude_authors",
        "include_words",
        "exclude_words",
      ].map((k) => [
        k,
        Array.isArray(rules[k]) ? rules[k].join("\n") : rules[k] || "",
      ]),
    ),
  };
}
export function rulePayload(values) {
  return {
    ...values,
    ...Object.fromEntries(
      [
        "regions",
        "authors",
        "exclude_authors",
        "include_words",
        "exclude_words",
      ].map((k) => [k, splitTerms(values[k])]),
    ),
  };
}
export function taskGroup(t) {
  return ["running", "paused", "waiting"].includes(t.status)
    ? "active"
    : t.status === "completed"
      ? "done"
      : "queued";
}
