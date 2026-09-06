import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * @typedef {object} DemoRecord
 * @property {number} id
 * @property {string} source
 * @property {string} title
 * @property {string} content
 * @property {string} author
 * @property {string} url
 * @property {number} relativeHours
 * @property {string} category
 */

/**
 * @param {number} id
 * @param {string} category
 * @param {string} title
 * @param {string} content
 * @param {number} relativeHours
 * @returns {DemoRecord}
 */
function record(id, category, title, content, relativeHours) {
  return {
    id,
    source: 'demo-monitoring',
    title,
    content,
    author: `Synthetic author ${String(id).padStart(3, '0')}`,
    url: `https://example.invalid/public-content/${id}`,
    relativeHours,
    category,
  }
}

/** @type {DemoRecord[]} */
const demo = []
for (let index = 1; index <= 24; index += 1) {
  demo.push(
    record(
      index,
      'high-score',
      `Urgent issue report ${index}`,
      `I need help: an important workflow is broken. This urgent issue affects the demo team ${index}.`,
      index,
    ),
  )
}
for (let index = 25; index <= 40; index += 1) {
  demo.push(
    record(
      index,
      'positive-match',
      `Product feedback ${index}`,
      `Feedback from a synthetic tester with a practical suggestion for the next release.`,
      index - 19,
    ),
  )
}
for (let index = 41; index <= 50; index += 1) {
  demo.push(
    record(
      index,
      'excluded',
      `Sponsored feedback roundup ${index}`,
      `Advertisement and sponsored feedback created only to demonstrate exclusion rules.`,
      index - 39,
    ),
  )
}
for (let index = 51; index <= 60; index += 1) {
  demo.push(
    record(
      index,
      'expired',
      `Older issue report ${index}`,
      `This issue would match, but its synthetic publication time is outside the configured window.`,
      360 + index,
    ),
  )
}
for (let index = 61; index <= 70; index += 1) {
  demo.push(
    record(
      index,
      'low-score',
      `General question ${index}`,
      `A question with little context, intentionally kept below the candidate score threshold.`,
      index - 58,
    ),
  )
}
for (let pair = 1; pair <= 5; pair += 1) {
  const title = `Repeated help request ${pair}`
  const content = `Help with a broken demo workflow. Duplicate pair ${pair} has intentionally identical text.`
  demo.push(record(70 + pair * 2 - 1, 'duplicate-pair', title, content, pair + 1))
  demo.push(record(70 + pair * 2, 'duplicate-pair', title, content, pair + 1))
}

const examples = {
  'demo-monitoring/demo-data.json': demo,
  'legal-lead-triage/demo-data.json': [
    {
      id: 'legal-1',
      title: '工资被拖欠怎么办',
      content: '公司三个月没有支付工资，想了解劳动仲裁。',
      author: '虚构用户甲',
      relativeHours: 3,
    },
    {
      id: 'legal-2',
      title: '交通事故处理',
      content: '发生交通事故后应该如何保存材料？',
      author: '虚构用户乙',
      relativeHours: 8,
    },
    {
      id: 'legal-3',
      title: '每日普法',
      content: 'XX律师事务所分享劳动法知识。',
      author: '虚构机构',
      relativeHours: 4,
    },
    {
      id: 'legal-4',
      title: '合同问题',
      content: '对方不履行合同，想了解可以怎么处理。',
      author: '虚构用户丙',
      relativeHours: 20,
    },
  ],
  'customer-feedback/demo-data.json': [
    {
      id: 'feedback-1',
      title: 'Export feedback',
      content: 'The export is broken after the last update. Help is needed.',
      relativeHours: 2,
    },
    {
      id: 'feedback-2',
      title: 'Feature suggestion',
      content: 'Feedback: please add a compact table view.',
      relativeHours: 5,
    },
    {
      id: 'feedback-3',
      title: 'Sponsored review',
      content: 'Advertisement and sponsored feedback.',
      relativeHours: 6,
    },
    {
      id: 'feedback-4',
      title: 'Old issue',
      content: 'An issue recorded long before the active window.',
      relativeHours: 900,
    },
  ],
  'brand-monitoring/demo-data.json': [
    {
      id: 'brand-1',
      title: 'Northstar launch',
      content: 'Northstar release coverage with a positive product mention.',
      relativeHours: 1,
    },
    {
      id: 'brand-2',
      title: 'Northstar support',
      content: 'A customer reports a Northstar outage and needs help.',
      relativeHours: 4,
    },
    {
      id: 'brand-3',
      title: 'Paid Northstar post',
      content: 'Sponsored advertisement for Northstar.',
      relativeHours: 6,
    },
    {
      id: 'brand-4',
      title: 'Other product',
      content: 'A post unrelated to the monitored brand.',
      relativeHours: 2,
    },
  ],
  'recruitment-monitoring/demo-data.json': [
    {
      id: 'job-1',
      title: 'Frontend engineer',
      content: 'Hiring a TypeScript frontend engineer for a remote role.',
      relativeHours: 2,
    },
    {
      id: 'job-2',
      title: 'Backend role',
      content: 'Hiring a backend engineer with Node.js experience.',
      relativeHours: 8,
    },
    {
      id: 'job-3',
      title: 'Recruitment ad',
      content: 'Sponsored recruitment advertisement.',
      relativeHours: 5,
    },
    {
      id: 'job-4',
      title: 'Old opening',
      content: 'Hiring notice outside the active time window.',
      relativeHours: 1500,
    },
  ],
}

for (const [relativePath, value] of Object.entries(examples)) {
  const path = resolve(root, 'examples', relativePath)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

console.log(
  `Generated ${demo.length} synthetic demo records and ${Object.keys(examples).length - 1} scenario datasets.`,
)
