/**
 * Single publish-visibility rule for tours, shared by server and client.
 *
 * The database `status` column is the source of truth (`'published'` or
 * any other value; the API defaults new rows to `'published'` and the PUT
 * route preserves it). Legacy/static catalogue entries carry no status
 * (`undefined`) and are always treated as published, so existing tours,
 * URLs, and curated lists are unaffected. Only an explicit non-published
 * DB status hides a tour from public surfaces.
 */
export function isTourPublished(tour: { status?: string | null }): boolean {
  return tour.status === undefined || tour.status === null || tour.status === 'published';
}
