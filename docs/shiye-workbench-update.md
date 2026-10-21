# 拾页工作台 2.2.2 开源更新

日期：2026-10-21。此次为 `xiaoye-radar` 仓库新增应用更新，源码入口为 [`apps/shiye-workbench`](../apps/shiye-workbench/README.md)。

## 新增内容

- Daylight 桌面界面：工作台、任务列表与多视图、内容筛选、词库、设置。
- Python / SQLite 业务引擎：关键词任务、暂停与继续、组合条件、去重及持久化。
- 收藏、任务备注、数据库备份和 Excel / CSV / JSON 导出。
- Windows WebView2 宿主、单文件 EXE 构建和 NSIS 安装器源脚本。
- 前端桥接测试、引擎与筛选回归、升级与导出适配测试，以及原生界面验证工具。

## 版本与目录

| 应用                | 版本  | 技术栈                              | 入口                   |
| ------------------- | ----- | ----------------------------------- | ---------------------- |
| 小野雷达 Community  | 0.4.2 | Electron / TypeScript / React       | 仓库根目录 npm 工作区  |
| 拾页工作台 Daylight | 2.2.2 | Python / SQLite / pywebview / React | `apps/shiye-workbench` |

两者独立运行和构建，没有跨应用数据库迁移。拾页首次从源码运行默认使用本应用目录下的 `development` 工作区；发布的安装版在程序所在目录保存数据。升级旧拾页工作区之前请备份，具体步骤见应用 README。

## 开发与验证

从 `apps/shiye-workbench` 执行 README 中的锁定依赖安装步骤，先构建前端，再启动 `src/main.py`。根目录的 `npm run verify` 验证 Community 与仓库密钥扫描；独立的 Shiye CI 执行 `pnpm test`、`pnpm build`、Python 引擎及适配器回归。

引擎回归使用拦截后的合成网页与隔离测试目录，不访问个人账号或安装版数据。测试需要 Windows 上安装 Chrome 或 Edge。网页实时变化、真实账号登录、原生窗口和安装器兼容性需要单独验收，不能由离线回归结果替代。

## 开源范围

项目自有源码和图标采用 Apache-2.0，依赖保留原许可证。`web/public/THIRD_PARTY_NOTICES.txt` 包含前端与 Python / Windows 组件的许可，并随前端构建进入程序。

仓库只包含源代码、静态资源、锁文件、合成测试和构建脚本。运行产生的 `data`、`development`、浏览器资料、日志、采集结果、导出、备份、数据库和构建产物均不属于源码交付。

小红书工作流使用用户自己的浏览器和手动登录，遇到验证或频率限制时暂停。使用者需要有权访问和处理相关内容，并遵守来源平台规则。敏感安全问题请按仓库 [SECURITY.md](../SECURITY.md) 私下报告，不要在公开 Issue 附上 Cookie、登录状态或真实数据。
