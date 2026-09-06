import { randomUUID } from 'node:crypto'
import { ContentDeduplicator, fingerprintFor, normalizeText } from './deduplication'
import type {
  Candidate,
  DecisionOutcome,
  MonitorResult,
  MonitorStats,
  NormalizedContent,
  RuleDecision,
  RuleSet,
} from './types'

const DAY_MS = 24 * 60 * 60 * 1000
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000

function matches(text: string, terms: string[]): string[] {
  return terms.filter((term) => text.includes(normalizeText(term)))
}

function ruleFiltered(outcome: DecisionOutcome): boolean {
  return [
    'filtered_disabled',
    'filtered_source',
    'filtered_include',
    'filtered_text',
    'filtered_regex',
    'filtered_score',
  ].includes(outcome)
}

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function compareItems(left: NormalizedContent, right: NormalizedContent, rule: RuleSet): number {
  return (
    compareText(
      fingerprintFor(left, rule.deduplication),
      fingerprintFor(right, rule.deduplication),
    ) ||
    compareText(left.id, right.id) ||
    compareText(left.url ?? '', right.url ?? '') ||
    compareText(left.title, right.title) ||
    compareText(left.content, right.content) ||
    compareText(left.publishedAt ?? '', right.publishedAt ?? '') ||
    compareText(left.author ?? '', right.author ?? '')
  )
}

export class RuleEngine {
  evaluate(
    item: NormalizedContent,
    rule: RuleSet,
    deduplicator: ContentDeduplicator,
    now: Date,
  ): RuleDecision {
    if (rule.regex.length > 0) {
      throw new Error(
        'Regular-expression rules are disabled in v0.4.0 until hard-timeout isolation is available',
      )
    }
    const text = normalizeText(`${item.title}\n${item.content}`)
    const fingerprint = fingerprintFor(item, rule.deduplication)
    const base = {
      item,
      fingerprint,
      score: 0,
      matchedKeywords: [] as string[],
      reasons: [] as string[],
    }

    if (deduplicator.checkAndAdd(fingerprint)) {
      return { ...base, outcome: 'duplicate', reasons: ['Duplicate fingerprint'] }
    }
    if (!rule.enabled) {
      return { ...base, outcome: 'filtered_disabled', reasons: ['Rule is disabled'] }
    }
    if (rule.sourceFilters.length > 0 && !rule.sourceFilters.includes(item.source)) {
      return {
        ...base,
        outcome: 'filtered_source',
        reasons: ['Source is outside the rule allowlist'],
      }
    }

    if (rule.timeWindowDays !== null) {
      const published = item.publishedAt ? Date.parse(item.publishedAt) : Number.NaN
      const age = now.getTime() - published
      if (
        Number.isNaN(published) ||
        age < -FUTURE_TOLERANCE_MS ||
        age > rule.timeWindowDays * DAY_MS
      ) {
        return {
          ...base,
          outcome: 'filtered_time',
          reasons: [
            Number.isNaN(published) ? 'Published time is missing' : 'Outside the time window',
          ],
        }
      }
    }

    const excluded = matches(text, rule.exclude)
    if (excluded.length > 0) {
      return {
        ...base,
        outcome: 'excluded',
        matchedKeywords: excluded,
        reasons: ['Matched an exclusion keyword'],
      }
    }

    const included = matches(text, rule.include)
    if (rule.include.length > 0 && included.length === 0) {
      return { ...base, outcome: 'filtered_include', reasons: ['No include keyword matched'] }
    }

    const contained = matches(text, rule.textContains)
    if (rule.textContains.length > 0 && contained.length === 0) {
      return { ...base, outcome: 'filtered_text', reasons: ['No text-contains rule matched'] }
    }

    const scoredTerms = Object.entries(rule.keywordScores)
      .filter(([term]) => text.includes(normalizeText(term)))
      .map(([term, score]) => ({ term, score }))
    const matchedKeywords = [
      ...new Set([...included, ...contained, ...scoredTerms.map(({ term }) => term)]),
    ]
    const includeScore = included.reduce(
      (total, term) => total + (rule.keywordScores[term] ?? 10),
      0,
    )
    const separatelyScored = scoredTerms
      .filter(({ term }) => !included.includes(term))
      .reduce((total, { score }) => total + score, 0)
    const score = Math.max(
      0,
      Math.min(100, Math.round(rule.basicScore + includeScore + separatelyScored)),
    )

    if (score < rule.minimumScore) {
      return {
        ...base,
        outcome: 'filtered_score',
        score,
        matchedKeywords,
        reasons: [`Score ${score} is below minimum ${rule.minimumScore}`],
      }
    }

    return {
      ...base,
      outcome: 'candidate',
      score,
      matchedKeywords,
      reasons: [
        included.length > 0 ? `Matched ${included.length} include keyword(s)` : 'No include gate',
      ].filter(Boolean),
    }
  }

  process(
    items: NormalizedContent[],
    rule: RuleSet,
    options: {
      existingFingerprints?: Iterable<string>
      now?: Date
      runId?: string
      sourceRecordId: string
    },
  ): MonitorResult {
    const now = options.now ?? new Date()
    const runId = options.runId ?? randomUUID()
    const deduplicator = new ContentDeduplicator(options.existingFingerprints)
    const decisions = [...items]
      .sort((left, right) => compareItems(left, right, rule))
      .map((item) => this.evaluate(item, rule, deduplicator, now))
    const createdAt = now.toISOString()
    const candidates: Candidate[] = decisions
      .filter((decision) => decision.outcome === 'candidate')
      .map((decision) => ({
        id: randomUUID(),
        runId,
        ruleId: rule.id,
        ruleRevision: rule.revision,
        sourceRecordId: options.sourceRecordId,
        item: decision.item,
        fingerprint: decision.fingerprint,
        score: decision.score,
        priority: rule.priority,
        matchedKeywords: decision.matchedKeywords,
        reasons: decision.reasons,
        reviewStatus: 'pending' as const,
        reviewNote: '',
        reviewedAt: null,
        createdAt,
      }))
      .sort(
        (left, right) =>
          right.score - left.score ||
          compareText(left.fingerprint, right.fingerprint) ||
          compareText(left.item.id, right.item.id),
      )

    const stats: MonitorStats = {
      total: decisions.length,
      candidates: candidates.length,
      duplicates: decisions.filter(({ outcome }) => outcome === 'duplicate').length,
      excluded: decisions.filter(({ outcome }) => outcome === 'excluded').length,
      timeFiltered: decisions.filter(({ outcome }) => outcome === 'filtered_time').length,
      ruleFiltered: decisions.filter(({ outcome }) => ruleFiltered(outcome)).length,
    }

    return { decisions, candidates, stats }
  }
}
