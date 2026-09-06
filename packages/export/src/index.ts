import type { Candidate } from '@xiaoye-radar/core'

const columns: Array<[string, (candidate: Candidate) => unknown]> = [
  ['id', (candidate) => candidate.id],
  ['review_status', (candidate) => candidate.reviewStatus],
  ['priority', (candidate) => candidate.priority],
  ['score', (candidate) => candidate.score],
  ['source', (candidate) => candidate.item.source],
  ['title', (candidate) => candidate.item.title],
  ['content', (candidate) => candidate.item.content],
  ['author', (candidate) => candidate.item.author],
  ['published_at', (candidate) => candidate.item.publishedAt],
  ['url', (candidate) => candidate.item.url],
  ['matched_keywords', (candidate) => candidate.matchedKeywords.join('|')],
  ['review_note', (candidate) => candidate.reviewNote],
  ['created_at', (candidate) => candidate.createdAt],
]

function preventSpreadsheetFormula(value: string): string {
  return /^[=+\-@]/u.test(value.trimStart()) ? `'${value}` : value
}

function csvCell(value: unknown): string {
  const scalar =
    value === null || value === undefined
      ? ''
      : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : JSON.stringify(value)
  const text = preventSpreadsheetFormula(scalar)
  return `"${text.replaceAll('"', '""')}"`
}

export function candidatesToCsv(candidates: Candidate[]): string {
  const header = columns.map(([label]) => csvCell(label)).join(',')
  const rows = candidates.map((candidate) =>
    columns.map(([, read]) => csvCell(read(candidate))).join(','),
  )
  return `\uFEFF${[header, ...rows].join('\r\n')}\r\n`
}

export function candidatesToJson(candidates: Candidate[]): string {
  return `${JSON.stringify(candidates, null, 2)}\n`
}
