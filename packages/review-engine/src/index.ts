import {
  candidateSchema,
  reviewStatusSchema,
  type Candidate,
  type ReviewStatus,
} from '@xiaoye-radar/core'

const transitions: Record<ReviewStatus, ReadonlySet<ReviewStatus>> = {
  pending: new Set(['approved', 'rejected', 'archived']),
  approved: new Set(['pending', 'archived']),
  rejected: new Set(['pending', 'archived']),
  archived: new Set(['pending']),
}

export function reviewCandidate(
  candidate: Candidate,
  statusValue: unknown,
  note = '',
  now = new Date(),
): Candidate {
  const status = reviewStatusSchema.parse(statusValue)
  const cleanedNote = note.trim()
  if (cleanedNote.length > 2000) throw new Error('Review note must be 2,000 characters or fewer')
  if (status !== candidate.reviewStatus && !transitions[candidate.reviewStatus].has(status)) {
    throw new Error(`Cannot move a candidate from ${candidate.reviewStatus} to ${status}`)
  }
  return candidateSchema.parse({
    ...candidate,
    reviewStatus: status,
    reviewNote: cleanedNote,
    reviewedAt: status === 'pending' ? null : now.toISOString(),
  })
}

export function allowedReviewTransitions(status: ReviewStatus): ReviewStatus[] {
  return [...transitions[status]]
}
