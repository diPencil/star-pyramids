# Reviews Phase 6 — implementation and verification

2026-10-27. Local only. No browser testing, production access, database writes, migrations, commit, push or deployment. Rent Cars, Destinations and Gallery implementation files were not changed in this phase.

## Architecture and sources

- `Review` stores one review per `(userId, tourSlug)`. `@website` remains the reserved website scope; other slugs classify trip-linked reviews. The slug is a historical reference, not a Prisma Tour foreign key.
- Review statuses are exactly `PENDING`, `PUBLISHED`, `REJECTED`. Publication remains a separate moderation decision, never inferred from a tour's publication.
- External Google, Tripadvisor, Trustindex and GetYourGuide feeds remain independently configured and attributed. They are not inserted into Review, reclassified as website reviews or combined into a fabricated cross-provider rating/count.
- Legacy localStorage exports remain for compatibility but have no active homepage/trip consumers. Embedded `detailReviews` are not merged into moderated database results.
- No schema change was needed.

## Root causes and fixes

1. Homepage All mounted a website-only fetch. It now requests `scope=all`; Website and Trip tabs request their own scope, with keyed remounts and scope-tagged summaries to prevent stale cards/counts on switching.
2. Trip pages optimistically displayed PENDING submissions and increased the public average/count. Submissions now close the form and show a moderation acknowledgement only; published reviews and statistics remain unchanged.
3. Trip review requests checked tour existence without publication. Trip-filtered reads/submissions now require `status=published`. Aggregated published historical reviews remain visible when their tour is unavailable, but expose `trip:null` and no hidden slug/title/link.
4. Trip names were not resolved. Public and admin responses now enrich associations from published DB tours using a batched query; missing/deleted/unpublished trips have no public link. Displayed names are actual database values.
5. Admin search used Prisma `mode:insensitive`, unsupported by this MySQL provider. It now relies on the database collation and searches customer fields, review text/title, slug and published trip titles.
6. Admin locally paginated/sorted only the first API page. Page/size/scope/status/search/sort now reach the server; filtered totals and deterministic tie-break sorting cover the full result set. Shrinking totals after moderation clamp/refetch the page instead of stranding the user.
7. Admin detail confirmation was unreachable because buttons directly moderated. Buttons now open the existing confirmation dialog. In-flight guards prevent double actions; moderation controls require the user's effective permission.
8. Invalid pagination could become NaN; malformed moderation bodies could throw. Pagination is bounded; invalid scopes/status/sort/conflicting filters and malformed/unknown moderation fields are rejected.
9. Concurrent moderation could blindly overwrite a newer status. A conditional status update now returns 409 if another moderator changed it; only status and publication timestamp are updated, preserving content, rating, user and association.
10. Trip-fetch errors were presented as empty reviews. They now have explicit error/retry states. Trip pagination is available, dates and rating labels follow EN/ES/IT, rating choices support keyboard/radio semantics, and scoped CSS prevents long-card-text overflow without redesigning the cards or animations.

Independent read-only code review found two P2 issues (conflicting admin filters and shrinking pagination); both were corrected. No P0/P1 issue was reported.

## API behavior / compatibility

- `GET /api/reviews?scope=all|website|trips`: PUBLISHED rows only; identical filters for rows/count/average. Omitted scope defaults to all. Invalid scope returns 400.
- `GET /api/reviews?tourSlug=canonical-slug`: retained for existing trip consumers, now published-tour only. `scope=website` remains compatible. Direct forged `tourSlug=@website` remains rejected.
- Existing `reviews`, `summary`, `pagination` fields and review content/name/date fields remain. `scope` and nullable `trip:{slug,title,href}` are additive. Private user fields are never projected publicly.
- `page` defaults to 1, public limit to 10/max20, admin limit to 20/max50. Default public sorting is publishedAt descending with publicId tie-break; admin sorting is whitelisted and server-side.
- `POST /api/reviews`: authentication and same-origin required; valid website/trip input creates PENDING only. Existing per-user/per-tour uniqueness, rate limits and concurrent duplicate handling remain. Client publication status is not trusted.
- Admin list/detail require `reviews.view`; mutations additionally require `reviews.moderate` and same-origin. Valid transitions remain pending→published/rejected, published→pending/rejected, rejected→pending/published. Conflicts return 409; unexpected storage failures return generic messages.
- External provider sections keep separate source statistics. The All local statistic explicitly labels website/trip reviews rather than claiming to aggregate external ratings.

## Localization boundary

EN/ES/IT interface labels, dates, accessible ratings, review filters/actions and submission acknowledgement are supported; Arabic remains disabled. Customer review text is never machine-translated or rewritten.

**Real content limitation:** the current Tour table has `title` and legacy `titleAr`, but no persisted ES/IT trip-title fields or registered tour catalogue translation editor. Reviews therefore use the actual English DB title as the existing project's fallback in ES/IT. No invented translated title, static demo-title substitution, new competing translation source or unapproved schema migration was added. Fully translated trip names require approved ES/IT tour-title content and its owning tour-editor persistence in a separate scope.

## Data integrity evidence

Only SELECTs were run against the local demo database. Before/after full verification:

- 1 review: 0 website, 1 trip; 1 PUBLISHED, 0 PENDING, 0 REJECTED.
- Identical SHA-256 over all persisted review fields: `55015f9cd8cc8841b104133297547cb2d5faf2762d1ae9332e243985ad448cf6`.
- Script: `node --env-file=.env scripts/verify-reviews-readonly.cjs`; it rejects non-local targets and prints no review text, names or emails.
- All automated mutation tests use mocks/in-memory fixtures. No real moderation, submission, duplicate insertion, reset, seed or cleanup was run.

## Verification results

- `pnpm typecheck`: passed.
- Focused review tests: 6 files, **79 passed** (including the unpublished-submission regression).
- `pnpm test:unit`: 24 files, 264 passed.
- `pnpm test`: 115 files, 1489 passed on the final source version.
- `pnpm exec next build --webpack`: **passed, exit 0, 282/282 pages**, including TypeScript and build traces. Direct Next build avoids the previously documented default Prisma DLL replacement lock; no new schema/client generation is required by Reviews Phase 6.
- `git diff --check`: passed.
- Actual component SSR verifies selected homepage scopes, tab labels and rating accessibility; API tests verify filtering, hidden/missing trip projection, status isolation, pagination/sort, MySQL-compatible search, authorization, malformed input and conditional moderation. SSR is not browser interaction/visual verification.
- Live provider credentials/network availability and a real DB-writing moderation/submission lifecycle were not exercised.

## Files changed in this phase

- `app/api/reviews/route.ts`
- `app/api/admin/reviews/route.ts`
- `app/api/admin/reviews/[publicId]/route.ts`
- `app/admin/reviews/page.tsx`
- `app/admin/reviews/[publicId]/page.tsx`
- `components/provider-reviews.tsx`
- `components/website-reviews.tsx`
- `components/reviews.tsx`
- `components/reviews-phase6.css` (new)
- `lib/review-scope.ts`
- `lib/review-copy.ts` (new)
- `lib/server/review-trips.ts` (new)
- `scripts/verify-reviews-readonly.cjs` (new)
- `tests/website-reviews.test.ts`
- `tests/reviews-phase6.test.ts` (new)
- `tests/review-tabs.test.ts` (new)
- `REVIEWS_PHASE6_VERIFICATION.md` (new)

All pre-existing unrelated dirty/untracked work was preserved.

## User manual acceptance checklist

1. On Homepage, switch All → Website → Trip rapidly. Verify correct cards, counts, no stale results, empty/error/retry and pagination; check EN/ES/IT on mobile/tablet/desktop.
2. Confirm trip cards link to the actual published trip. Unavailable trips must show no hidden name or public link.
3. Intentionally submit a new review: it must show a moderation acknowledgement, without increasing published counts or stars. Repeat submission should be rejected.
4. In Admin, filter by status/source, search customer/text/trip, change sort/page size and visit later pages. Moderate the only item on a final filtered page and verify navigation recovers.
5. Verify publish/reject/pending confirmations, double-click protection, concurrent moderator conflict and a view-only user's unavailable moderation controls.
6. Inspect the same review on Homepage and its trip after publishing, then after rejection; verify preserved text/rating and matching publication status. Check keyboard rating selection, modal focus and long review/title wrapping.

Stop at Phase 6. No release or later phase has been started.
