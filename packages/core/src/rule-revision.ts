import { createHash } from 'node:crypto'
import type { RuleSet } from './types'

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function sorted(values: string[]): string[] {
  return [...values].sort(compareText)
}

export function ruleRevisionFor(rule: RuleSet): string {
  const semantics = {
    enabled: rule.enabled,
    priority: rule.priority,
    include: sorted(rule.include),
    exclude: sorted(rule.exclude),
    textContains: sorted(rule.textContains),
    regex: sorted(rule.regex),
    sourceFilters: sorted(rule.sourceFilters),
    timeWindowDays: rule.timeWindowDays,
    minimumScore: rule.minimumScore,
    basicScore: rule.basicScore,
    keywordScores: Object.fromEntries(
      Object.entries(rule.keywordScores).sort(([left], [right]) => compareText(left, right)),
    ),
    deduplication: rule.deduplication,
  }

  return createHash('sha256').update(JSON.stringify(semantics), 'utf8').digest('hex')
}
