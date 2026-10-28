# CMS and public-content integration audit

Scope: CMS/public content/security only. Existing dirty work was preserved.
TripBuilder, accounting, cars and events business logic remain with their owners.
No browser, live database writes, environment-file changes, migrations, staging,
or commits were performed. Tests used mocked persistence; media round-trip tests
used disposable temporary filesystem fixtures.

## Source paths audited

Paths below are relative to `D:/Development/star-pyramids-nodejs/web-source`.

| Boundary | Reviewed source modules/routes |
| --- | --- |
| Page drafts/publication and read models | `lib/page-sections.ts`, `lib/server/page-sections.ts`, `app/api/admin/website-cms/pages/[pageKey]/route.ts`, `components/admin/page-visual-editor.tsx`, `components/homepage.tsx` |
| Hero drafts/publication | `lib/website-heroes.ts`, `lib/server/website-heroes.ts`, `lib/server/showcase-heroes.ts`, `lib/server/faq-hero.ts`, `app/api/admin/website-cms/hero-sections/route.ts`, `app/api/admin/website-cms/showcase-heroes/[id]/route.ts` |
| Staff preview isolation | `app/website-cms-preview/homepage/page.tsx`, `app/website-cms-preview/pages/[pageKey]/page.tsx`, `app/website-cms-preview/showcase/[id]/page.tsx`, `app/website-cms-preview/editorial/[id]/page.tsx`, `lib/server/guards.ts` |
| Sustainability media | `components/sustainability-badge.tsx`, sustainability definition/validation in `lib/page-sections.ts`, sustainability JSX in `components/homepage.tsx`, existing badge rules in `app/globals.css` |
| Gallery publication/lightbox | `lib/journey-gallery.ts`, `lib/server/journey-gallery.ts`, `lib/journey-gallery-client.ts`, `lib/gallery-lightbox.ts`, `components/gallery-lightbox.tsx`, `app/api/journey-gallery/route.ts`, `app/api/journey-gallery/[id]/route.ts` |
| Media upload/retrieval | `app/api/media/route.ts`, `app/api/admin/website-cms/hero-media/route.ts`, `lib/server/media.ts`, `lib/server/journey-video-storage.ts`, `app/media/[...path]/route.ts`, `app/gallery-videos/[...path]/route.ts`, new `lib/server/upload-form.ts` |
| Review scopes/moderation/private fields | `lib/review-scope.ts`, `lib/server/review-trips.ts`, `app/api/reviews/route.ts`, `app/api/admin/reviews/route.ts`, `app/api/admin/reviews/[publicId]/route.ts` |
| Provider review secrets/public feed | `app/api/review-integrations/route.ts`, `lib/server/review-integrations.ts`, `lib/server/review-providers.ts`, `lib/server/review-credentials.ts` |
| Destination publication/client isolation | `lib/server/destinations.ts`, `lib/server/catalogue-translations.ts`, `lib/catalogue-client.ts`, `app/api/destinations/route.ts`, `app/api/destinations/[slug]/route.ts`, `app/destinations/[slug]/page.tsx`; checked editor consumers in `app/admin/destinations/page.tsx` and `app/admin/destinations/new/page.tsx` |
| SEO publication/discovery | `lib/server/seo-manager.ts`, `lib/server/record-seo.ts`, `lib/server/record-seo-api.ts`, `lib/server/seo-inventory.ts`, `lib/server/global-seo.ts`, `lib/server/page-content-metadata.ts`, `lib/dynamic-seo.ts`, `app/api/admin/website-cms/seo/records/[kind]/[slug]/route.ts`, `app/sitemap.ts`, `app/page.tsx` |

## Confirmed fixes and exact changed files

1. **Unpublished destination disclosure:** anonymous list/detail APIs previously
   exposed unpublished rows. Public requests now require publication; explicit
   `?admin=1` requests require destination view/edit permission. Successful
   responses are private/no-store. Public output continues stripping private SEO.
   Files: `app/api/destinations/route.ts`,
   `app/api/destinations/[slug]/route.ts`, `lib/catalogue-client.ts`.
2. **Stale/private destination cache:** editors now use a separate private cache.
   Generation checks discard pre-invalidation responses and errors, preventing
   an older request from restoring rows after a publication change. Catalogue
   fetches bypass browser caching. File: `lib/catalogue-client.ts`.
3. **Unbounded multipart parsing:** file-size checks ran after multipart parsing;
   the CMS route's length-header check did not bound chunked/forged-length
   requests. Actual streamed bytes are now bounded before parsing, with HTTP 413
   for oversized bodies. Existing file-level limits/signature checks remain.
   Files: `lib/server/upload-form.ts`, `app/api/media/route.ts`,
   `app/api/admin/website-cms/hero-media/route.ts`.

Tests added:

- `tests/destination-publication-api.test.ts`
- `tests/destination-cache-boundary.test.ts`
- `tests/upload-form-boundary.test.ts`

Existing test files extended without replacing previous work:

- `tests/gallery-api.test.ts` (mock export plus route-level 413 regression)
- `tests/website-hero-media.test.ts` (route-level 413 regression)

Documentation changed: `BACKEND_SETUP.md` and this audit report.

## Verification results

- Final scoped Vitest run: **54 files passed, 744 tests passed**.
- Scope selected all top-level test files with these prefixes:
  `cms-`, `website-hero`, `website-reviews`, `showcase-hero`,
  `editorial-hero`, `faq-hero`, `compact-heroes`, `hero-media`,
  `sustainability-badge`, `gallery-`, `journey-gallery`, `media-`,
  `review-`, `reviews-phase6`, `record-seo`, `seo-`, `destination-`,
  `upload-form`, `catalogue-language`.
- Runner: installed `node node_modules/vitest/vitest.mjs run` with those paths.
  Corepack initially could not download its configured pnpm version (DNS failure).
  Sandbox execution then hit temporary worker-file/rename restrictions; the
  approved rerun outside that restriction passed. No dependency changes.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`:
  final run failed only in concurrently changed tour handlers outside this scope:
  `app/api/tours/[slug]/route.ts` lines 156, 176, 195 and
  `app/api/tours/route.ts` lines 122, 140 (unknown/object values incompatible
  with string/Prisma input types). No diagnostics in this audit's changed files.
- Scoped `git diff --check`: passed.
- Production build and browser/live-database validation were not run by this
  audit. Main integration owner must resolve the tour-handler type errors and
  perform final release verification.

No further confirmed blocking defect identified in the reviewed CMS/public
content boundaries. This is not a claim of complete application-wide security
or release verification.
