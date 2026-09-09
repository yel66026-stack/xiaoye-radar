# Legal Inquiry Triage / 法律求助内容筛选示例

This example shows how Xiaoye Radar can turn authorized public-text copies into a local human-review queue. It is one reusable Community use case, not a lawyer-acquisition product.

本示例展示如何用小夜雷达把有权处理的公开文本副本，经过基础关键词、排除词、三天时间窗、简单评分和内容去重后，送入本地人工审核队列。它只是 Community 的一种使用场景，不会把项目改造成律师获客工具。

## Run it

1. Start the desktop app and choose **法律求助筛选示例** on the dashboard.
2. Open **监测任务 / Monitoring** to inspect the source, rule and latest run.
3. Open **候选结果 / Candidates** and **审核队列 / Human review** to make a human decision.
4. Open **扫描历史 / History** to inspect the recorded counts.

The one-click path imports [`data/legal-inquiry-synthetic.json`](data/legal-inquiry-synthetic.json), saves [`rules/legal-inquiry-basic.yaml`](rules/legal-inquiry-basic.yaml), creates a monitoring job and performs one scan. Developers can run the same integration path with `npm test`.

## What is included

- 100 completely fictional records covering actionable requests, legal education, lawyer marketing, unrelated text, expired text, duplicate pairs and boundary cases.
- Seven basic categories: labor, family, debt, traffic, contract, consumer and rental.
- A deliberately small deterministic rule pack. It uses no AI, network service, Regex, platform login, credential, crawler or automated-contact logic.
- Fixed regression expectations: 51 candidates, 5 duplicates, 18 exclusions, 10 expired records and 16 other rule-filtered records on a clean first run.

Every record carries `synthetic: true`, `fictional: true`, an expected outcome and a synthetic category. Names, phone numbers, social handles, real post URLs and real case details are intentionally absent. `relativeHours` is converted to a timestamp at import so the time-window example remains repeatable.

## Modify the rule

Copy the YAML into the in-app rule editor or edit it for source-based development. The evaluation order is documented in [`../../docs/rules.md`](../../docs/rules.md). Keep keyword lists small and explainable; advanced commercial dictionaries and lead-scoring logic are outside the Community boundary. A changed rule meaning creates a new semantic revision, so existing content may be evaluated again without weakening same-revision deduplication.

## Safety and compliance

This example does not provide legal advice, and a Candidate is not a legal conclusion. Human review is the final step.

Use only synthetic data or data you are lawfully authorized to access and process. Do not use this example for unauthorized private-data collection, credential or CAPTCHA bypass, platform access-control bypass, automated harassment, spam, or automated unsolicited messaging. It contains no automatic direct-message or bulk-contact feature. See [`../../docs/compliance.md`](../../docs/compliance.md).
