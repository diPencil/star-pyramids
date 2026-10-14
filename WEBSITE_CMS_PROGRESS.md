# Website CMS: Pages, Sections and Heroes - Progress

## Remaining Coverage Implemented (2026-10-14)

This entry supersedes the partial-batch inventories below. No eligible registered
presentation block remains uncovered. This is an implementation/automated-test
coverage result, NOT a claim that authenticated browser or Hostinger QA passed.

### Exact Final Inventory

| Scope | CMS presentation | Original business modules | Fixed functional | Uncovered |
| --- | ---: | ---: | ---: | ---: |
| 56 page/template entries, 53 actual route patterns | 81 | 23 | 62 | 0 |
| 11 shared-source entries | 3 | 7 | 1 | 0 |
| Total registered blocks | 84 | 30 | 63 | 0 |

The filesystem test still checks exact public-route equality. The 166 page blocks
plus 11 shared entries are 177 ownership registrations, not copied database
records. Detailed inspection split earlier umbrella entries into 24 additional
actual presentation blocks. None was marked CMS-managed merely by changing a label:
the regression suite checks each registered text/media/link field's public consumer.

### Resolution of All 29 Previous Blocks

| Previous items | Count | Final ownership and implementation |
| --- | ---: | --- |
| About story, values, travel styles, steps, closing and help | 6 | CMS: actual original markup; repeated cards, icons, images, links, ordering/visibility; help uses the shared editor |
| Contact trust and response/supporting content | 2 | CMS: actual trust cards, planning steps, supporting text and contact-method labels; contact values remain in Settings |
| Destinations, Blogs, Cars and Offers listing presentation | 4 | CMS adapters consumed by their original components; live records remain module-owned |
| Blog, Destination, Event and Campaign template presentation | 4 | CMS labels/sections; existing records remain authoritative, with protected previews using published original records |
| Trips; four cruise identities; One-day, Multi-day, Nile and Shore; Events listing | 10 | Fixed catalogue UI: after the already-managed hero, source contains result counts, filtering/navigation, record-driven headings and pagination rather than an additional marketing body |
| Tour detail; one-day region; multi-day category interface copy | 3 | Fixed tabs, booking/pricing/availability, filtering and contractual UI; actual itinerary/story/media remains in original record editors |
| Total previous items resolved | 29 | 16 CMS presentation integrations, 13 evidenced functional classifications; no invented business records |

Functional classification evidence: `components/trips-page.tsx` (`TripsContent`),
`components/site.tsx` (`RegionTourContent`, `TourListingInner`,
`OneDayToursRegionsContent`, `MultiDayToursCategoriesContent`,
`MultiDayCategoryContent`, `OneDayDestinationContent`),
`components/extended-pages.tsx` (`EventsPageContent`),
`components/tour-detail.tsx`, and `components/day-tour-detail.tsx`.

### Persistence, Preview and Source Ownership

- Extended the existing typed PageContent/SiteSetting/CAS architecture and the
  existing PageVisualEditor/API; no new storage architecture or migration.
  New `cms.page.<allowlisted-id>.v1` documents are not initialized by reads.
- Published presentation is delivered server-side through an allowlisted bulk
  read and a DOM-free provider. Private drafts are never included in public props.
  Every template has the same draft/publish/restore and revision-conflict checks.
- Reordering changes registered sibling section slots only; functional anchors
  remain in place. Required enquiry and navigation structures cannot be hidden.
  CMS read failure hides optional content without removing required forms.
- `/admin/website-cms/pages/shared` owns header/mobile navigation labels, footer
  labels and shared help copy. Brand/logo/contact/copyright stay in Settings;
  promotional bars stay in Offers; gallery/reviews remain in their modules.
- Shared help now submits to `/api/enquiries`, validates and deduplicates retries,
  and shows success only after API acceptance. An email field was necessary to
  satisfy the existing enquiry contract; the existing visual tokens are retained,
  with scoped desktop/tablet/mobile form tracks and explicit error states.
- About and Contact steps/trust cards, About travel styles and Offers process/
  trust cards support real repeaters. Business-driven repeated records are NOT
  copied into CMS documents. Contact FAQ teasers reuse the authoritative FAQ body.
- Existing hero image/video/mobile/poster media capabilities remain in the hero
  editor. Body components that actually render static images support safe URL/upload
  references; arbitrary public HTTPS images bypass the Next optimizer allowlist
  safely rather than crashing. Uploaded files keep the existing media integration.
- Protected inert desktop/tablet/mobile previews use the actual public components,
  published source records and the saved page draft. Missing eligible preview
  records produce an explicit empty state; no sample records are inserted.
- Static-page SEO overrides preserve canonical/hreflang. Dynamic record SEO remains
  in its original source and is not duplicated in template presentation editors.
- Standalone WEBSITE CMS sidebar heading remains above ADMINISTRATION, ordered
  Overview, Hero Sections, Pages & Sections, with unchanged permissions/routes.

### Verification and Remaining Non-Implementation Limits

- Safe suite: 323/323 tests passed in 31 explicit database-independent files.
  Tests include per-template in-memory API/CAS lifecycle,
  draft privacy, permissions, real field consumers, repeaters, order/visibility,
  safe media, shared navigation/footer/help, responsive CSS and mandatory-form
  availability on CMS failure. Original About SSR markup is compared against its
  preserved pre-adapter source in all three enabled languages.
- Standalone TypeScript, final production webpack build (267/267 generated pages),
  tracked diff check and new-file whitespace checks passed on the final source.
  Results are recorded in WEBSITE_CMS_VALIDATION.md.
- Direct browser access was rejected by the browser tool's URL policy in this
  environment. No alternate browser/HTTP workaround was used. Representative SSR
  and desktop/tablet/mobile CSS checks passed, but live pixel/interactive visual QA
  and authenticated save/publish against the demo database remain unverified.
- Privacy/Terms keep their exact existing placeholder text and expose owner-approved
  content editing. Full approved legal text is still an owner content dependency,
  not an uncovered CMS adapter. Existing untranslated source content keeps its
  prior fallback until the owner publishes translations; no policy was fabricated.
- Hostinger path remains `/home/u909646470/domains/starpyramids.com/uploads` through
  the existing MEDIA_STORAGE_DIR integration. No remote permission/persistence test
  or deployment was performed, and no production-readiness guarantee is asserted.
- No real database-writing test, seed, backfill, migration, environment change,
  media cleanup, recovery-project change, dependency upgrade, commit, push or deploy.

## Additional Content Adapters (2026-10-14)

Implemented five of the previously registered 34 uncovered blocks:

- FAQ questions/answers: repeatable EN/ES/IT content, item visibility/order,
  authoritative empty lists, original accordion markup and interaction.
- Guide and Accessible Travel contact CTAs: localized text, validated destination,
  visibility and original public markup. Existing topics/heroes remain authoritative
  in their original editors, without copied records.
- Privacy and Terms: owner-approved repeatable policy sections and heading/copy,
  preserving the existing placeholders until publication. No legal policy was
  invented, imported from unapproved static samples, or automatically translated.
- The FAQ introduction was additionally discovered and connected, not silently
  counted as already covered. Original FAQ answer source currently has English
  only; initial ES/IT values preserve that original fallback and are editable.
- All five pages use the existing Pages & Sections editor and private SiteSetting
  lifecycle, per-page CAS keys, protected inert preview, published rendering, SEO,
  existing RBAC, origin checks and bounded request bodies. No database writes were
  performed to initialize these pages. Homepage storage/API defaults remain compatible.
- Website CMS remains a standalone sidebar heading immediately above Administration,
  ordered Overview, Hero Sections, Pages & Sections; no expandable parent.

Current registry: 56 entries / 53 route patterns; 142 registered sections:
41 CMS-managed, 23 business-managed, 49 functional, 29 uncovered. Three shared
presentation concerns remain uncovered. There are still 23 partial inventories;
this is NOT complete website coverage. No remaining blocks were relabelled as
business-managed or functional merely to reduce the uncovered count.

Remaining implementation: About's six blocks; Contact's two; 14 catalogue/listing
presentation blocks; seven dynamic template presentation blocks; shared header,
footer and help presentation/submission. The older remaining-work table below is
historical for the prior batch; its FAQ, legal editor and information CTA rows are
superseded by this entry. Approved full legal text is still owner-supplied content,
not a technical CMS integration blocker.

Validation: 274 safe tests passed in 27 explicit files, including additional-page
actual renderer tests and per-page in-memory API/CAS/publication/access tests.
Standalone TypeScript passed; production webpack build passed (267/267 generated
pages); git diff --check passed. Authenticated browser save/publish and hosting
runtime storage were not exercised in this batch. The task-owned QA server on
3100 was stopped before the build; no unrelated process was terminated.
No live content edits, migrations, environment changes, commit, push or deployment.

## Central CMS Working Batch (2026-10-14)

This task delivers the overview/pages foundation and the full homepage section
adapter. It does NOT complete the entire website CMS. The registry explicitly
marks the remaining work; older hero-only completion counts below are historical.

### Delivered

- Website CMS is a standalone sidebar section above Administration, with Overview,
  Hero Sections and Pages & Sections. Journey Gallery/Settings/Offers remain
  their original sources; no duplicate media or promotional-bar module was added.
- `/admin/website-cms` loads publication/draft/update information from actual
  allowlisted SiteSetting rows. `/admin/website-cms/pages` has search, grouping,
  coverage/publication filtering, responsive tables and source-editor links.
- `/admin/website-cms/pages/homepage` edits the actual 14 homepage sections.
  The hero retains its authoritative existing editor and records. The other 13
  sections support their registered text, visibility/order, source selection,
  limits, FAQ/statistic/process/sustainability items and supported Lucide icons.
  Search, the planner and the enquiry form cannot be hidden or removed.
- New private `cms.page.homepage.v1` extends the existing SiteSetting architecture
  and revision/CAS lifecycle. Its single publication writes page section content,
  order and SEO together. Existing hero/business records are not overwritten.
  There is no migration, initialization write, seed or demo-ID default selection.
- Actual public components consume published values. Empty selections and items
  stay empty; hidden sections do not return through hardcoded fallbacks. Missing
  business links are disabled instead of silently linking to deleted content.
- EN/ES/IT editing, real-component protected/inert saved-draft preview at
  1440/768/375, unsaved navigation protection, existing admin confirmations,
  and homepage SEO overrides preserve canonical/locale URL behavior.
- Existing homepage hero image/video/mobile/poster uploads remain in the original
  media editor. Business images remain in their source modules. Social image URL
  editing is supported; a new global asset browser has not been implemented.

### Coverage (Registered Sections, Not a Full-Site Certification)

- 56 page/template entries cover all 53 actual public route-file patterns.
  Four cruise identities share one `[type]` route pattern. A filesystem test
  checks that no actual public route is omitted and no nonexistent route is added.
- 141 registered page sections: 35 CMS-managed, 23 business-managed, 49 fixed /
  functional, and 34 known uncovered presentation sections. There are also 11
  shared-source entries, including three uncovered shared presentation concerns.
- 24 page/template section inventories remain partial. The counts above are
  counts of registered blocks, not a claim that every nested subsection is
  already discovered. The dashboard displays both limitations prominently.

### Exact Remaining Work for the Next Batch

Phase C must complete each static page's detailed section inventory and add its
own typed adapter to the existing page document/editor/runtime approach. Do not
copy business records into SiteSetting. Known uncovered blocks are:

| Actual route | Remaining presentation integration |
| --- | --- |
| `/egypt-travel-guide` | Shared contact CTA |
| `/accessible-travel` | Shared contact CTA |
| `/trips` | Additional presentation copy |
| `/egypt-tours/nile-cruises/standard-nile-cruises` | Additional presentation copy |
| `/egypt-tours/nile-cruises/deluxe-nile-cruise` | Additional presentation copy |
| `/egypt-tours/nile-cruises/superior-nile-cruise` | Additional presentation copy |
| `/egypt-tours/nile-cruises/luxury-nile-cruise` | Additional presentation copy |
| `/about` | Company story; Our approach cards; Travel style cards; Planning steps; Closing CTA; Help CTA |
| `/contact` | Contact trust strip; Response steps & supporting copy |
| `/destinations` | Additional presentation copy |
| `/blogs` | Additional presentation copy |
| `/events` | Additional presentation copy |
| `/rent-car` | Additional presentation copy |
| `/special-offers` | Additional presentation copy |
| `/faq` | FAQ questions and answers |
| `/egypt-tours/one-day-tours` | Additional presentation copy |
| `/egypt-tours/multi-days-tours` | Additional presentation copy |
| `/egypt-tours/nile-cruises` | Additional presentation copy |
| `/egypt-tours/shore-excursions` | Additional presentation copy |
| `/blogs/[slug]` | Template presentation copy |
| `/egypt-tours/[slug]` | Template presentation copy |
| `/egypt-tours/one-day-tours/[region]` | Template presentation copy |
| `/egypt-tours/multi-days-tours/[category]` | Template presentation copy |
| `/destinations/[slug]` | Template presentation copy |
| `/events/[slug]` | Template presentation copy |
| `/special-offers/[slug]` | Template presentation copy |
| `/privacy` | Approved legal content (current placeholder) |
| `/terms` | Approved legal content (current placeholder) |

Phase D: finish the seven dynamic template presentation adapters; the original
record editor links already work. Phase E: localized navigation/footer labels,
shared help-CTA presentation/submission, and any required existing-media chooser.
Extend Settings-owned locale fields in Settings, not in a conflicting CMS copy.
Phase F: remaining-page SEO/localization, authenticated editor/browser QA and
final section-coverage verification. Legal content needs approved owner-supplied
copy; do not invent or automatically translate policies.

### Validation and Safety

- TypeScript passed. 260 database-independent tests passed in 26 explicitly
  selected files, including actual homepage SSR, API/CAS lifecycle, permissions,
  streamed-body limits, published references, uploads in isolated temporary
  storage, and preservation of existing hero/information-page workflows.
- Production webpack build passed (267/267 generated pages). Browser comparison
  confirmed the same 14 section tags/classes, heading order, search tabs and help
  form as the previous production build after the gallery data loaded. At
  375/768/1440 there was no document horizontal overflow. Find Your Trip enables
  Search after choosing One Day; Rent Car and Make Your Trip controls remain
  present. ES/IT headings, FAQ and statistics labels switch correctly. Guest
  page preview and Pages & Sections redirect to login. No console errors were
  observed. `git diff --check` passed. Authenticated admin UI QA remains unverified.
- No automated test writes to the demo database. No real draft/publication or
  media mutation was performed. No .env/schema/migration/dependency change,
  reset, cleanup, commit, push or deployment. Hostinger runtime permissions and
  actual persistent storage access were not checked from this local session.

### Continuation Notes

- New page-document API/visual editing currently supports `homepage` only.
  Other page-structure screens link their real existing editors and mark uncovered
  sections; they must not be represented as fully editable page documents.
- Reuse `SectionDefinition`, the existing revision/CAS envelope and the scoped
  real-component renderer approach when adding typed adapters for Phase C.
  Extend the page allowlist/schema deliberately; never accept arbitrary SiteSetting
  keys or silently mutate existing published documents when registering new blocks.
- Page restore affects homepage presentation only. Its hero retains the old
  private key/editor. Catalogue selection stores slugs, not copied prices, content
  or database IDs. Reference options and publish checks require published records;
  offer links reuse the existing tour-offer routing and active-window rules.
- Current local QA server is on port 3100. No deployment or authenticated content
  write was performed to prove editor behavior; the API/renderer tests use mocks.

## Information Pages Completion (2026-10-14)

- Activated `/egypt-travel-guide` and `/accessible-travel` as complete public
  pages using the existing EditorialHero, SiteShell, breadcrumb, accordion,
  split-editorial and help-panel styles. Page-specific CSS is scoped.
- Guide has six translated planning topics with real internal links. Accessible
  Travel has four translated support sections, retaining the existing 5% policy
  while requiring specific access arrangements to be confirmed before booking.
- Both pages now use the existing editorial CMS editor/API/private SiteSetting
  persistence. Hero image/copy/CTA and section text/links/order are editable in
  EN/ES/IT with the existing draft, preview, publish and explicit restore flow.
  Sections can be added/removed from a draft; published empty arrays remain
  authoritative. Unpublishing the hero retains the last public page body.
- Inventory is now 27 entries / 24 route patterns: 20 CMS-managed identities
  and seven original-editor links. Older counts and placeholder statements below
  are historical and superseded by this entry.
- No migration, seed, backfill, environment change or real content mutation was
  performed. Original page content is served without creating database rows.
- Current workflow: the existing client-demo database remains the application's
  database. Missing TEST_DATABASE_URL does not block feature development; only
  automated real-database writing tests require explicit isolation.
- Verification: standalone TypeScript passed; 75 targeted tests in nine files
  passed with mocked/in-memory dependencies. Production webpack build passed
  (264/264 generated pages). Public browser checks passed at 375/768/1440 with
  EN/ES/IT switching, loaded images, keyboard accordion expansion and the real
  contact link. Guest CMS preview redirects to login; no console errors observed.
  Authenticated admin mutation was not performed in the client-demo database.

## Latest Phase 2 Verification (2026-10-14)

### Continuation: workflow boundary verification

- Added `tests/showcase-hero-workflow.test.ts`: all 15 showcase/compact IDs run
  through the actual GET/PATCH handlers and persistence service with only the
  Prisma boundary replaced by an in-memory map. Covers save, reload, publish,
  private subsequent drafts, stale revision rejection, unpublish, saving while
  hidden, and explicit restore. This is not real-MySQL or authenticated-browser QA.
- The new 15 tests and 20 related existing tests passed (35 total in this run).
  TypeScript passed. No application code or data changed in this continuation.
- Safe configuration inspection confirms TEST_DATABASE_URL is absent and the
  explicit integration isolation confirmation is absent. No credentials printed.
  Real write verification remains blocked pending an explicitly disposable DB
  and isolated application/storage with a test staff account.
- Default-context webpack build was retried and still fails unlinking
  `.next/diagnostics/build-diagnostics.json`. Its ACL owner is CodexSandboxOffline;
  the ordinary Users entry lacks delete permission. This is evidence of a
  permissions mismatch, not proof that no process also holds the file. No ACL,
  ownership, cache, process or environment modification was performed.

- Added All trips plus Standard, Deluxe, Superior and Luxury Nile introductions
  to the existing showcase persistence/API/editor/preview architecture. Their
  existing markup, icons, counts, search, filters and tour data are preserved.
  Compact heroes expose only the text their current layout supports. Unsupported
  media/CTA mutations are rejected server-side. Reference cruise definitions
  still supply originals; no cruise or tour records were duplicated.
- Added original-editor links for tour details, one-day destinations and
  multi-day categories. The list now contains 25 unique entries / 22 route
  patterns: 18 CMS identities and seven dynamic editor links. Dynamic links are
  clearly editor-list entry points, not claimed per-record CMS editors.
- Draft/publish/unpublish/restore and source-content preservation pass mocked
  storage/API tests and actual React server rendering tests. Real authenticated
  saves, publishing, restores and uploads were NOT executed: no disposable
  environment or authorization to write into the existing DB was established.
- TypeScript passed using the installed compiler. 39 explicitly selected safe
  files / 377 tests passed. The full Vitest command was rejected by automatic
  approval review because a full-suite command did not explicitly limit DB-safe
  tests; only the approved explicit mocked/unit selection was executed.
- Corepack could not resolve/download pnpm 10.28.0 (ENOTFOUND registry.npmjs.org),
  so installed TypeScript/Vitest/Next binaries were used without installation.
  Direct webpack build still fails before compilation with Windows EPERM on
  `.next/diagnostics/build-diagnostics.json`. This is not a new Prisma DLL result.
  No caches were deleted, processes stopped, or environment files changed.
- Browser: all five newly connected public routes render their original hero
  at 375/1440 without horizontal document overflow; Standard also checked at
  768. Trips filter changes the URL and displays seven Nile cruises. Guest
  `/website-cms-preview/showcase/trips` redirects to login. The desktop Standard
  hero screenshot retains its original layout. Authenticated preview not tested.
- Hostinger code review: image storage `lib/server/media.ts` and video storage
  `lib/server/journey-video-storage.ts` share `MEDIA_STORAGE_DIR`; without it,
  storage is deployment-relative `storage/media`. Set the runtime variable to
  the persistent absolute directory verified by the operator (previous SSH
  output: `/home/u909646470/domains/starpyramids.com/uploads`). This turn did not
  verify production process permissions, serving, upload limits or retention
  after redeployment. Do not infer those guarantees from the directory's name.
  No production configuration, media or database content was changed.
- No commit, push, deployment, migration, seed or schema change was performed.

The sections below retain the earlier batches' historical results; the latest
coverage and verification above supersede their older counts.

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

The existing Prisma SiteSetting model stores separate private versioned JSON
documents under `cms.hero.homepage.v1` and `cms.hero.faq.v1`. No schema change or
migration is required.
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

The initial catalogue listed 19 route-template families. Following actual route
inspection, Guide and Accessible Travel were removed: their routes currently
render short placeholder pages, not the unused editorial components. The current
catalogue now has 25 entries: 18 individually editable static heroes and seven
dynamic route families. Four entries share the cruise-type route template, so
this is 22 route patterns, not 25 distinct visual designs or database records:

- 18 integrated CMS heroes: homepage, FAQ, destinations, About, Contact, Blogs,
  Events, Rent cars, Special offers, four top-level tour categories, All trips,
  and the four reference-defined cruise types.
- Seven dynamic families link to existing content editors: articles,
  destinations, events, campaigns, tour details (day/package layouts), one-day
  destinations, and multi-day categories. These are editor-list entry
  points, not per-record selectors or duplicate CMS records.
- No static row in the current 25-row catalogue remains pending. Seven dynamic
  families retain their authoritative content editor entry points.

Route inspection now covers the nested tour/detail/subcategory families. No
additional eligible existing public hero was found outside this catalogue.
Search, planner, car-request, checkout/cart, legal, authentication, account and
booking/verification routes are functional forms, document views or plain page
headings, not additional marketing hero templates. Guide and Accessible Travel
remain placeholder routes; their unused editorial components are not counted.
Homepage has no separate static CTA. Compact introductions have no media/CTA;
their editor and API reject unsupported fields instead of advertising them.
Runtime write verification and production build remain outstanding; this is
not a production-completion certification.

## Preview and Media Limits

Both live and saved draft previews use the real homepage, including its search
controls, inside an inert protected page. The live iframe receives validated
unsaved content from its same-origin parent only, without database writes.
A readiness handshake avoids losing the initial update before hydration.
The mobile iframe provides an actual narrow viewport for responsive CSS and
media queries. Preview language is locked independently of visitor preferences.
Incomplete or invalid live messages retain the last valid preview; saving still
requires all content validation. Preview interaction and submission are disabled.

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

## Follow-up: Homepage Preview and Editor Consistency

- Replaced incomplete inline live preview with the protected real homepage iframe.
- Editor media type/source/position and preview size use the existing SharedSelect.
- Unpublish is disabled with unsaved edits, preventing an action response from
  silently replacing the editor's unsaved content.
- Restore confirmation explicitly describes replacement of draft, unsaved edits
  and published content.
- Added five database-independent preview security/composition tests; the focused
  CMS and preference selection passes 51 tests, and the safe unit suite passes 257.
- TypeScript passed. Protected admin browser QA and actual writes remain
  unverified; this preview-only follow-up did not expand hero coverage.
- This follow-up does not modify database data, schemas, environment or storage.

## Follow-up: FAQ Editorial Hero

- Added `/admin/website-cms/hero-sections/faq` and its protected API/preview.
- FAQ text (heading, eyebrow, description and button label), image upload/URL,
  optional alt text and a verified-static-page CTA selector are editable.
- EN/ES/IT defaults are compared by AST tests to the original FAQ hero JSX.
  Decorative image alt remains empty by default, matching the original markup.
- Existing EditorialHero layout and CSS remain unchanged. A route-scoped context
  supplies published FAQ overrides only; other editorial pages retain their
  existing props. FAQ questions and interaction logic are not edited.
- Private key `cms.hero.faq.v1` uses existing SiteSetting storage. Missing rows
  preserve original content without creating records. Drafts stay private;
  unpublish is explicit, restore requires confirmation, and CAS protects saves.
- No schema/migration, real database writes, uploads or backfill were executed.
- Homepage plus FAQ now cover 2 of the initial 19 template families. Four dynamic
  editor links remain; 13 other static templates still require implementation.
- FAQ preview currently supports saved drafts, desktop/mobile and EN/ES/IT.
  Unsaved live preview, video/mobile media overrides and arbitrary external/tour
  CTA selectors for FAQ are not claimed as implemented.
- Validation: TypeScript passed; 71 focused tests and 257 safe unit tests passed.
  Vitest needed an unsandboxed rerun because its temporary SSR module files were
  inaccessible to sandbox workers. No database-writing tests were run.
- Current production build is blocked by Windows EPERM unlinking the existing
  `.next/diagnostics/build-diagnostics.json`, including on an unsandboxed retry.
  Existing caches were not deleted and services were not stopped to bypass it.
- A fresh browser navigation reached localhost:3000/faq. The original heading,
  description, CTA and loaded image were present; FAQ accordion interaction worked.
  DOM geometry at 375/390/768/1440 had no document horizontal overflow. Guest
  access to the FAQ editor redirected to login with the correct return path.
  Authenticated admin QA and real save/publish/refresh remain unverified.
- No commit, push or deployment was performed for these follow-ups.

## Follow-up: Destinations and Shared Editorial Management

- Destinations listing now has a protected CMS editor and saved-draft preview.
  Original EN/ES/IT content is checked against its existing JSX with AST tests.
- The existing FAQ editor/API logic is reused by allowlisted editorial identities;
  FAQ URLs and its private storage key remain compatible. Unknown IDs return 404
  before accessing settings. Each page has its own key and original restore data.
- Shared editor owns `components/admin/editorial-hero-editor.tsx`; persistence
  remains in `lib/server/faq-hero.ts`, with `lib/server/editorial-hero-api.ts` for
  shared authorization/validation. These names preserve the original FAQ API.
- Default hero copy is resolved in the nested page locale context, preventing
  an outer page hook from forcing English in the original multilingual hero.
- Page layout, destination records/cards, counts and business behavior are not
  replaced. No DB insertion, migration, backfill or upload was executed.
- Current coverage is 3/17 route-template families after the inventory correction.
  Remaining static families: About, Contact, Blogs, Events, Rent cars, Offers,
  and the four top-level tour categories. Dynamic detail editors are linked, not
  duplicated. Further route-family discovery is still required.
- Guide/Accessible Travel have pre-existing placeholder routes despite complete
  unused components; connecting those pages is separate from editing an existing
  hero and has not been silently performed in this CMS batch.
- TypeScript passed; 78 focused tests passed. Local browser reached Destinations
  with original hero copy, CTA and destination cards. Authenticated admin mutation
  and publication are not browser-verified. Build result is reported separately.

## Final Validation Follow-up (2026-10-14)

- Latest follow-up: operator reports fresh build success; read-only inspection
  confirms a new BUILD_ID. The earlier EPERM below is historical. Another 76
  selected CMS tests passed; actual MySQL validation is still blocked by missing
  TEST_DATABASE_URL and explicit isolation confirmation.

- Current inventory is 25 entries / 22 route patterns: 18 CMS-managed heroes and
  7 dynamic groups. Earlier counts below are historical snapshots.
- See WEBSITE_CMS_VALIDATION.md for current results, narrowly scoped Windows
  permission repair, disposable MySQL setup and Hostinger storage requirements.
- TypeScript and 91 selected safe tests passed. Isolated filesystem upload and
  retrieval tests use mocked database metadata; they do not certify real MySQL
  persistence or playable video. A suffix byte-range defect was fixed and tested.
- Build remains blocked by DELETE access denial on the existing Next diagnostics
  JSON. No ACL changes, database writes, production uploads or deployment occurred.

## Follow-up: All Remaining Static Rows in the Current Catalogue

- Connected all ten previously pending static rows through existing hero
  components. PageShowcaseHero is retained for showcase/category layouts; the
  custom Events hero keeps its separate markup. There is no generic public
  replacement template and no public CSS redesign.
- `lib/showcase-hero-defaults.ts` captures original static EN/ES/IT copy. Tests
  compare existing JSX copy and source category definitions. No featured title,
  slug, price, count, date or vehicle/tour/event record is copied into CMS data.
- `lib/showcase-heroes.ts` defines page-specific editable fields and validation.
  Private keys use `cms.hero.showcase.<id>.v1` in existing SiteSetting storage.
  Reads never create rows. Explicit writes have revision/CAS protection.
- Authenticated APIs and a shared editor support draft/publish/unpublish/restore,
  desktop/mobile image upload or HTTPS URL, optional alt text, position and
  overlay. Original-position mode preserves existing CSS cropping on text-only
  updates. Static CTA destinations use verified pages and each page's anchors;
  dynamic featured links remain owned by their original records.
- Live previews render the actual pages in protected inert frames at desktop or
  mobile width, with EN/ES/IT content. Same-origin parent/source/hero-ID checks and
  content validation protect unsaved-preview messages; previews do not save data.
- Public integration preserves the exact existing page components, including
  BlogsPage's server-loaded articles and all existing search/forms/filter logic.
  Special Offers still requires its existing featured tour before showing the
  hero; missing/loading source data does not fabricate a featured package.
- The management list links all 13 static heroes to real editors and loads their
  publication status. Four dynamic detail families still link to existing editors.
  Original featured-media references remain dynamic, so list thumbnails may be
  absent until an image override is published; this is not a fake stock preview.
- Scope is the current 17-row catalogue, not an exhaustive certification of every
  nested dynamic route. Guide/Accessible placeholder routes are still unchanged.
- Validation: 107 focused tests passed in 15 files, including actual SSR rendering
  checks for identical uninitialized markup, translated publication, mobile media
  and preservation of featured record values. Existing safe unit suite: 257 passed.
- Browser checked the ten public routes at 375/390/768/1440: no document horizontal
  overflow. Source headings/layouts remained present where source data supplied a
  hero. Some image checks preceded load completion; Rent cars subsequently loaded
  its original image and was visually inspected. Offers initially had no featured
  tour/hero, consistent with its existing data-dependent condition.
- TypeScript/diff-check results are in the final task response. Production build
  remains blocked by Windows EPERM unlinking the existing diagnostics file; no
  cache removal or service shutdown was used to bypass it. Protected browser
  navigation timed out; authenticated editor/persistence QA is not claimed.
- No migration, DB write, upload, environment change, commit, push or deployment
  was executed by this follow-up.
