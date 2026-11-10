// Reserved non-route key: keeps the existing per-user unique constraint and
// moderation workflow without inventing a catalogue tour or migrating records.
export const WEBSITE_REVIEW_SCOPE = '@website'

export const REVIEW_SCOPES = ['all', 'website', 'trips'] as const
export type ReviewScope = typeof REVIEW_SCOPES[number]
export function parseReviewScope(value: string | null): ReviewScope | null {
  return value === null ? 'all' : REVIEW_SCOPES.includes(value as ReviewScope) ? value as ReviewScope : null
}
export function reviewScopeFilter(scope: ReviewScope) {
  return scope === 'website' ? { tourSlug: WEBSITE_REVIEW_SCOPE } : scope === 'trips' ? { tourSlug: { not: WEBSITE_REVIEW_SCOPE } } : {}
}
export function reviewPage(value: string | null, fallback: number, maximum: number) {
  const number = Number(value)
  return value && Number.isSafeInteger(number) && number > 0 ? Math.min(number, maximum) : fallback
}
