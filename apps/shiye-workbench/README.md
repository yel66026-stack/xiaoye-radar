# 拾页工作台 Pro · Daylight 2.2.2

本应用于 2026-10-21 作为 Xiaoye Radar 仓库的一次新增应用更新公开源代码，沿用 2.2.2 版本号。项目自有代码和图标采用 [Apache License 2.0](LICENSE)，第三方组件保留各自许可证，见 `web/public/THIRD_PARTY_NOTICES.txt`。界面中的 Pro 是历史名称，无需许可证服务器或付费激活。

本目录是完整源码入口，与 `apps/community-desktop` 独立构建；下述命令均从 `apps/shiye-workbench` 执行。首次从源码运行会新建空白工作区，不会自动读取已经安装的拾页工作台数据。工作台需要 Windows 10/11 x64；网页变化可能影响平台采集，实时平台流程不属于离线回归测试保证范围。

仅使用有权访问和处理的内容，遵守来源平台规则；登录、验证码和访问频率限制由使用者自行处理。程序会暂停等待，不提供验证绕过。请勿提交运行生成的数据库、浏览器资料、个人导出或备份。本次源码更新不附带已安装程序的数据。


React + Tailwind CSS + Framer Motion + Lucide 的 Daylight 界面，接入原版 2.1 的 Python / SQLite / Playwright 业务引擎，通过 pywebview 的原生桥接运行。前端不包含模拟数据兜底。演示数据由原引擎的独立演示数据库提供，演示模式不允许真实采集。

## 运行 Windows 成品

安装版：双击「拾页工作台_2.2.2_Windows安装版.exe」按向导安装，自动创建当前用户的桌面快捷方式、开始菜单与 Windows 卸载入口。默认安装在 `%LOCALAPPDATA%\Programs\ShiyeWorkbench`，数据继续存放在 EXE 所在目录。更新保留数据，卸载仅删除程序与快捷方式，保留用户工作区。

解压 Windows64 交付包，双击「拾页工作台.exe」。不需要安装 Python、Node.js 或启动服务。使用本机 Microsoft Edge WebView2 Runtime 渲染界面，采集需要已安装的 Chrome 或 Edge 和手动登录的小红书账号。数据默认保存在 EXE 所在目录，请解压到自己有读写权限的文件夹。

## 开发与构建

环境：Windows 10/11 x64、Python 3.12、Node.js 24、pnpm 11。精确依赖在 `src/requirements-lock.txt` 和 `web/pnpm-lock.yaml`。Python 建议使用独立虚拟环境。

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\src\requirements-lock.txt
Set-Location web
pnpm install --frozen-lockfile
pnpm build
Set-Location ..
.\.venv\Scripts\python.exe .\src\main.py
```

Vite 构建输出到 `src/ui`，原生窗口从这里加载，不依赖外部 CDN。`web/public/app.ico` 与依赖许可随构建复制。`pnpm dev` 仅提供前端开发服务器；业务接口在桌面宿主中提供，普通浏览器打开开发服务器会提示未连接桌面桥接。

一键重新构建 Windows 单文件程序：

```powershell
.\build.ps1 -PythonExe "$PWD\.venv\Scripts\python.exe"
```

输出为 `dist/拾页工作台.exe`。也可以在前端构建完成后单独执行 `src/build.ps1`，其 `-OutputDir` 参数支持指定输出位置。

在已验证的 EXE 外生成 Windows 安装版（无需重新编译业务代码）：

```powershell
.\installer\build-installer.ps1 -AppExe '.\dist\拾页工作台.exe' -NsisExe 'E:\tools\nsis-3.12\makensis.exe'
```

安装脚本为 `installer/installer.nsi`，依赖官方 NSIS 3.12。安装器不捆绑个人数据库、浏览器资料或第三方下载器。

## 核心文件

- `web/src/DesktopApp.jsx`：工作台、任务视图、内容筛选、词库及设置。
- `web/src/DesktopForms.jsx`、`DesktopViews.jsx`：业务表单、任务与内容详情、指令面板。
- `web/src/bridge.js`：原生接口与筛选条件映射。
- `src/daylight_api.py`：界面适配、升级前备份、收藏与任务备注。
- `src/desktop.py`、`engine.py`、`rules.py`、`metadata.py`：沿用 2.1 原版业务实现。
- `src/store.py`：沿用原数据库结构，仅更新应用版本号。
- `src/main.py`：WebView2 宿主、单实例、非阻塞关闭与验收入口。

## 验证

```powershell
Set-Location web
pnpm test
pnpm build
Set-Location ..
.\.venv\Scripts\python.exe .\src\main.py --self-test .\qa\engine
.\.venv\Scripts\python.exe .\src\main.py --adapter-test .\qa\adapter
.\.venv\Scripts\python.exe .\src\ui_test.py .\qa\native
```

成品 EXE 也支持 `--self-test DIR`、`--adapter-test DIR`、`--ui-smoke --data-home DIR` 与 `--demo --ui-smoke --data-home DIR`，所有路径请使用全新隔离目录。原生验收会打开并自动关闭程序窗口。采集回归使用本地网页样本和真实浏览器引擎，不访问实际小红书账号。

## 旧版本升级

先在旧版设置中备份数据库并退出旧版。将旧程序文件夹完整复制一份，在副本中用新版 EXE 替换原「拾页工作台.exe」，保留 `data`、浏览器资料目录、导出和备份目录。首次连接旧数据库时，自动在「备份」目录生成 `升级前_Daylight_*.sqlite3`；任务、笔记、词库、设置继续保留。原文件夹可以留作回退。

应用可通过 `--data-home DIR` 指定完整数据根目录。收藏与任务备注写入既有 SQLite 的 settings 表；没有接入云端同步或在线 AI 服务。

## 界面规范

首页改为指标、最近任务和最近笔记，移除宣传横幅、口号、重复状态说明与首页的专注计时和内容线索小组件。常用文字提升到 12–15px，正文及操作加强对比度。采集、筛选、词库与导出业务保持原有引擎；规则说明可按需展开。

## 2.2.2 统一与分发

任务页统一搜索、状态筛选和三视图切换，默认列表，保留暂停、继续、停止和任务详情。词库卡片突出用于采集，保留全部导入导出和编辑规则。设置以常规、采集、导出、数据与备份四个分类呈现，跨分类编辑在保存前保留。第三方依赖完整许可已内置在 EXE 的静态资源中，通过使用帮助查看。

对外转发只需 EXE 或干净的便携分享 ZIP。不要转发自己运行生成的 data、导出、备份和浏览器资料目录。源码、验收报告和界面截图单独交付，不混入面向使用者的分享包。

## 开发补充

`src/icon_build.py` 是可选的图标重新生成工具，需要额外安装 Pillow；正常运行和构建使用已提交的 `web/public/app.ico`，不需要 Pillow。

仓库根目录的 npm 命令只构建小野雷达 Community；本应用使用本目录的 Python 锁文件与 `web/pnpm-lock.yaml`。请不要混用两个应用的数据目录。原生界面和安装器测试会操作真实窗口或安装环境，只应在独立测试环境执行；自动 CI 执行前端测试和构建，以及使用合成网页与临时目录的引擎、适配器测试。
