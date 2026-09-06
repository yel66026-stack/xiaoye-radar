# 小夜雷达 Xiaoye Radar

**小夜雷达，开源公开内容监测、规则过滤与人工审核工具。**

[English](README.md) · [架构](docs/architecture.md) · [Adapter SDK](docs/source-adapter.md) · [规则说明](docs/rules.md) · [社区协作](docs/community.md) · [合规边界](docs/compliance.md)

Community Edition 用来处理你有权访问的公开内容副本。它可以导入 CSV、JSON、本地 RSS/Atom 文件、Markdown 和纯文本，随后执行时间过滤、关键词筛选、排除、评分与去重，再把候选内容交给人审核。整个流程在本机完成，不要求平台账号，也不调用私有服务。

> 当前版本为 `v0.4.0` Community Edition。Windows 便携版目前未签名；安全问题请通过 GitHub Private Vulnerability Reporting 私密提交，不要发到公开 Issue。

![小夜雷达 Community 总览](docs/images/dashboard.png)

## 为什么做这个版本

很多监测项目都会重复写一段相似的中间流程。数据来自不同格式，字段要先统一；内容要按时间、关键词和来源过滤；重复结果不能一遍遍进入队列；机器给出的候选还得留给人确认。Community Edition 把这段通用工作整理成一个能直接运行的桌面应用，也把关键能力拆成几个清楚的 TypeScript workspace。

这个版本可以独立使用。它没有 Pro License 检查、私有 API、账号登录、遥测和自动更新。

## 已有能力

- Include、Exclude、Text Contains、来源、时间窗、评分、优先级和启停规则
- 按正文、来源 ID 或 URL 生成 SHA-256 指纹，并按规则语义修订进行去重
- CSV、JSON、本地 RSS/Atom、Markdown 和文本 Adapter
- 严格字段归一化，递归删除敏感 metadata，单文件上限 10 MiB
- 串行原子写入的本地 JSON 工作区
- 待审核、已通过、已排除、已归档四种审核状态
- CSV 与 JSON 导出，CSV 会处理电子表格公式注入
- 80 条全虚构 Demo，以及法律、客户反馈、品牌和招聘示例
- Electron 安全 Preload、IPC sender 校验、沙箱与严格 CSP
- 中英双语桌面界面和英文开发文档

![候选结果](docs/images/candidates.png)

## 快速开始

开发环境需要 Node.js `22.12` 或更高版本。桌面发行包当前以 Windows 10/11 为目标。

```bash
git clone https://github.com/yel66026-stack/xiaoye-radar.git
cd xiaoye-radar
npm ci
npm run dev
```

这些命令不需要私有 npm 源或 Secret。

完整检查与 Windows 打包命令如下。

```bash
npm run verify
npm run dist:win
npm run smoke:portable
```

`verify` 会依次检查格式、Lint、TypeScript、测试、当前代码树与完整 Git 历史 Secret，以及生产构建。便携版写入 `release/community/`，该目录不会进入 Git。

## 一键 Demo

打开软件，点击“导入并运行 Demo”。应用会导入 80 条虚构文本并跑完一次完整流程。

| 结果         | 数量 |
| ------------ | ---: |
| 输入         |   80 |
| 候选         |   45 |
| 重复         |    5 |
| 排除         |   10 |
| 超出时间窗   |   10 |
| 低于评分阈值 |   10 |

集成测试固定检查这些数字。解析、过滤顺序或持久化逻辑如果意外改变，CI 会直接失败。

## 规则配置

规则支持 JSON 与 YAML。下面这份配置会保留近期求助或反馈，排除广告，再按词语加分。

```yaml
id: starter-feedback-rule
name: Starter feedback triage
enabled: true
priority: normal

time_window:
  days: 30

include: [help, feedback, issue]
exclude: [advertisement, sponsored]

score:
  urgent: 25
  broken: 18

basic_score: 5
minimum_score: 10
deduplication: content
```

字段含义和执行顺序见 [docs/rules.md](docs/rules.md)。

首个公开版本会拒绝非空的 `regex` 字段。只有在正则求值移出 Electron 主进程并具备硬超时后，才会重新开放用户自定义 Regex。

## Source Adapter SDK

每个来源都遵循 `initialize`、`validateConfig`、`fetch`、`normalize`、`healthCheck` 和 `dispose` 生命周期。`v0.4.0` 内置的是本地文件 Adapter，workspace 包还没有宣称发布到 npm。第三方 Adapter 的接口、错误处理和测试方法见 [docs/source-adapter.md](docs/source-adapter.md)。

Community 不包含网页抓取器、验证码绕过、凭据收集、认证绕过和平台风控规避实现。

## 示例

- [完整 Demo](examples/demo-monitoring/README.md)
- [法律求助分流](examples/legal-lead-triage/README.md)，只是一份虚构的规则引擎示例
- [客户反馈](examples/customer-feedback/README.md)
- [品牌监测](examples/brand-monitoring/README.md)，品牌名称为虚构
- [招聘信息](examples/recruitment-monitoring/README.md)

仓库中的示例数据全部为 synthetic/mock data。替换数据时，请先确认自己拥有访问与处理权限。

## Community 与 Pro

| 能力                          | Community | Pro                  |
| ----------------------------- | --------- | -------------------- |
| 通用规则引擎                  | 有        | 保留现有商业实现     |
| CSV、JSON、RSS/Atom、本地文件 | 有        | 视产品能力而定       |
| 本地存储与人工审核            | 有        | 有                   |
| 公共 Adapter SDK 契约         | 有        | 私有接线需所有者确认 |
| 平台专用连接器                | 无        | 有                   |
| 账号、登录与 Session          | 无        | 有                   |
| 专业规则包与评分              | 基础示例  | 商业高级能力         |
| 商业自动化                    | 无        | 有                   |

这个仓库没有 Pro 平台代码、选择器、登录状态、客户数据和完整商业规则包。更细的边界见 [docs/editions.md](docs/editions.md)。

## 参与项目

开发与提交流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。新增 Adapter 时，需要说明数据是怎样取得的。任何绕过认证、访问控制、速率限制或平台保护机制的实现都不会被接受。

## 安全、隐私与合规

涉及凭据、个人数据或可利用漏洞的报告不要发到公开 Issue。请按 [SECURITY.md](SECURITY.md) 使用 GitHub Private Vulnerability Reporting。

Community 使用独立本地目录，不读写 Pro 数据。Telemetry 与自动更新均未实现。Renderer 没有 Node.js 权限；导入文件会检查大小和结构；疑似凭据的嵌套 metadata 会被删除；外部链接只允许无内嵌账号密码的 HTTP(S) 地址。

软件只能处理你有权访问的数据。使用者仍需遵守来源服务条款、当地法律、隐私义务，以及适用场景中的 `robots.txt`。完整说明见 [docs/compliance.md](docs/compliance.md)。

## 路线与许可证

版本规划见 [ROADMAP.md](ROADMAP.md)，首发变化和限制见 [`v0.4.0` Release Notes](docs/RELEASE_NOTES_v0.4.0.md)。项目使用 Apache License 2.0，第三方信息见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
