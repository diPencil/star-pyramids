# Website CMS: Hero Sections - First Batch

## Implemented

- Website CMS is a sidebar section heading immediately before Administration,
  with a normal Hero Sections link (no dropdown). The page-group filter reuses
  the same SharedSelect as the other admin tables.
- Protected listing and homepage editor, using existing admin components and
  `settings.view` / `settings.edit` permissions.
- Homepage image/video backgrounds, direct HTTPS URLs and authenticated uploads,
  optional mobile media, video poster, positioning and optional custom overlay.
- Required EN/ES/IT heading and alt text, with localized optional eyebrow.
- Save draft, protected preview, publish saved draft, unpublish and explicit
  restore to original content. Optimistic compare-and-swap prevents stale edits.
- Public rendering retains the existing TripSearchEngine and its business logic.
- Background video respects reduced-motion and save-data preferences, uses a
  poster, and pauses outside the viewport or when the document is hidden.

## Persistence and Safety

The existing Prisma SiteSetting model stores one private versioned JSON document
under `cms.hero.homepage.v1`. No schema change or migration is required.
This key is not part of the public settings allowlist. Public responses contain
only the published snapshot, never the draft or editing revision.

No record is inserted on reads. An absent record preserves the original hero.
The first explicit admin mutation creates the record; subsequent writes use
compare-and-swap. No seed, backfill, migration, real upload, or database-writing
test was executed for this batch. Persistence tests mock Prisma.

Unpublishing retains an explicit hidden state, not an implicit hardcoded fallback.
Restore replaces the draft and public snapshot with the original defaults.
On a storage/read failure, public rendering retains the search controls but does
not silently substitute hardcoded content for a potentially published hero.

## Coverage: Not Complete

The initial catalogue identifies 19 route-template families, not 19 individual
database records and not an exhaustive inventory of every dynamic route:

- 1 integrated CMS hero: homepage.
- 4 dynamic families link to their existing content editors: articles,
  destinations, events and marketing campaigns. These are editor-list entry
  points, not per-record selectors or duplicate CMS records.
- 14 other static families are explicitly source-managed and still pending.

Remaining work includes exhaustive tour/detail/subcategory discovery, connecting
the remaining static heroes while preserving each layout, per-record dynamic
navigation where appropriate, and capability-specific CTA editing/selectors.
Homepage has no separate static CTA, so no artificial CTA controls were added.

## Preview and Media Limits

Unsaved live preview uses the shared hero renderer for text/media/overlay.
Saved draft preview uses the real homepage, including its search controls, inside
an inert protected page. Preview language is locked independently of saved visitor
preferences. Unsaved preview does not reproduce the search form.

Image uploads reuse existing JPEG/PNG/WebP/GIF storage and its configured limit
(5 MB by default). Hero video uploads support MP4/WebM up to an application ceiling
of 20 MB; existing gallery video limits remain unchanged. External video URLs
must reference direct MP4/WebM files, not social/video-provider pages.
MIME, extension, signature, size, random filenames and existing path protections
are reused. Published media is not deleted by CMS actions.

Hostinger still requires verification that the deployed process can write to the
configured MEDIA_STORAGE_DIR, that both media-serving routes can read it, that the
directory survives redeployment, and that request limits permit the chosen files.
The 20 MB ceiling is not a guarantee of hosting capacity or upload persistence.
No environment files were changed.

## Validation

- TypeScript check: passed after production route types were regenerated.
- Existing safe unit suite: 23 files, 257 tests passed.
- Focused CMS/localization/gallery/media suite: 7 files, 97 tests passed,
  including 33 new CMS tests. These counts overlap; do not add them together.
- `pnpm build`: blocked at Prisma generation by a Windows DLL EPERM lock while
  the existing development server was running. The server was not stopped.
- Direct installed Next.js production build with webpack: passed, including
  TypeScript and 261/261 generated pages.
- `git diff --check`: passed, with existing line-ending warnings only.
- Guest homepage: original image/text and search tabs present; DOM width checks
  at 375, 390, 768 and 1440 found no document horizontal overflow. Screenshots
  inspected on mobile and desktop. Find Your Trip and Rent Car tab changes work.
- Guest CMS navigation redirects to login with the correct return URL.

Authenticated admin visual QA, actual save/publish/upload across refreshes,
published video playback and production persistent storage remain unverified.
They require an authorized session and an isolated environment or explicit
permission for test writes. No existing customer/admin data was changed.

Native project UI primitives were reused. The 21st CLI was unavailable; no
dependencies were installed. Existing unrelated uncommitted work was preserved.
Publication status is reported separately in the commit/push task response.

## Pre-commit Validation

- Safe unit suite: 257 tests passed.
- Mobile/localization/CMS regression selection: 92 tests passed in 9 files.
- Direct installed Next.js webpack production build: passed, 261/261 pages,
  including its TypeScript phase.
- Existing upstream security commits were incorporated by fast-forward only.
- Environment copies, backups, debug scripts, logs and Lighthouse artifacts are
  excluded from the intended source commit and retained locally.
