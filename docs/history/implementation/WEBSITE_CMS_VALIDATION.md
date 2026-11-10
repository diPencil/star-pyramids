# Website CMS validation - 2026-10-14

## Central CMS Batch: Overview and Homepage Sections

- Implemented Overview, Pages & Sections, expandable Administration navigation,
  a protected homepage visual editor, and actual published homepage consumption.
  This is a working batch, not completion of the remaining website-wide phases.
- Route inventory: 56 entries / 53 actual public route-file patterns. Registered
  section inventory: 141 blocks (35 CMS, 23 original business modules, 49 fixed
  functional, 34 uncovered). Eleven shared-source blocks are tracked separately;
  three are uncovered. Twenty-four section inventories are explicitly partial.
- All 14 actual homepage sections are registered. Hero media stays in its existing
  authoritative editor; 13 other sections use private `cms.page.homepage.v1`.
  Search/planning/enquiry functionality is mandatory. No business data is copied.
- Per-page section content/order/SEO publication uses one existing SiteSetting
  CAS write. Drafts stay private; protected previews use real components inside
  inert content. Optional unpublish preserves forms. No live CMS data was changed.
- Standalone TypeScript and 260 selected safe tests passed; webpack production
  build passed with 267/267 generated pages. The complete Vitest suite was not run.
- Exact remaining page/shared integrations are listed in WEBSITE_CMS_PROGRESS.md.
  Authenticated browser editing was not exercised. No isolated database is needed
  to continue ordinary development; automated database writes remain prohibited.
- Public browser comparison matched the previous build's 14 section tags/classes,
  headings, tabs and help form after asynchronous gallery loading. EN/ES/IT,
  375/768/1440 widths and the three search modes were checked without submitting
  bookings/enquiries. Guest preview/admin routes redirect to login. Diff check
  passed. Authenticated editor interactions are not browser-verified.

## Current information-page delivery

- The former Guide/Accessible placeholders are now complete CMS-backed public
  pages. Inventory is 27 entries / 24 patterns, with 20 CMS identities and seven
  original-editor links. Earlier counts below are historical.
- Hero and page-section content share the existing private SiteSetting document
  and draft/publication lifecycle. No migration/backfill or live content write
  was performed. No separate database is required for ordinary development.
- TypeScript, 75 selected safe tests and webpack production build passed
  (264/264 generated pages). No EPERM occurred in these builds.
- Browser: both pages checked at 375/768/1440, EN/ES/IT content, image loading,
  keyboard accordion expansion and contact navigation. Guest protected preview
  redirects to login. No console errors observed. Authenticated saves/publishing
  were covered with in-memory persistence, not live client-demo mutations.
- Existing demo data, media and .env remain unchanged. No commit/push/deployment.

## Results and limits

- Inventory: 25 entries, 22 route patterns; 18 CMS-managed heroes and 7 dynamic
  groups retain their original content editors. This is integration coverage,
  not certification of authenticated production workflows.
- TypeScript passed. The selected nine database-independent test files passed
  91 tests, including CMS lifecycle/rendering and isolated filesystem uploads.
- Homepage browser checks preserved Make Your Trip, Find Your Trip and Rent Car.
  Selecting One-day tours enabled Search; the planner link and rental controls
  remained present. No request was submitted. No document overflow was observed
  at widths 375, 768 and 1440. This does not verify booking submission.
- Real upload handlers wrote and retrieved exact image/video fixture bytes in a
  unique temporary directory. Database metadata and authentication were mocked.
  Invalid signatures and unauthenticated requests were rejected. The MP4 fixture
  checks transport/signatures, not playable video or browser codec support.
- Fixed video suffix range handling (`bytes=-4`); regression verifies HTTP 206
  and the exact final bytes. Existing media was not touched.
- Real MySQL lifecycle, authenticated browser publication/preview, real video
  playback and production storage persistence remain unverified.

## Build follow-up

The operator reported completing a fresh build after recreating generated output.
Read-only verification found `.next/BUILD_ID` timestamped 2026-10-14T08:55:17Z.
This corroborates fresh build output; this follow-up did not rerun the build or
capture the operator's complete build log. The permission failure below is
historical, not a request to apply further ACL changes.

An additional selected CMS run passed 76 tests in seven files. The first run
failed loading Vitest temporary modules inside the Windows sandbox; the same
selection passed outside that restriction. TEST_DATABASE_URL and the explicit
isolation confirmation remain absent. No database writes were performed.

## Historical Windows build blocker

Direct `next build --webpack` fails before compilation while unlinking:

`D:\Development\star-pyramids-nodejs\web-source\.next\diagnostics\build-diagnostics.json`

The current identity is `MahmOud\mahmo`; the file owner is
`MahmOud\CodexSandboxOffline`. The ordinary Users ACL grants write/read but not
delete. A non-mutating Win32 DELETE-access probe returned error 5 (Access denied).
This confirms a permission blocker on this Next diagnostic artifact, not a
Prisma generation failure. Process/handle inspection was unavailable, so an
additional lock cannot be ruled out. No process was stopped or ACL changed.

Manual operator step, in elevated PowerShell, limited to this exact generated
file (no recursive flag, no ownership changes, no deletion):

```powershell
icacls "D:\Development\star-pyramids-nodejs\web-source\.next\diagnostics\build-diagnostics.json" /grant "MahmOud\mahmo:(M)"
```

Then retry `pnpm build` from the project in the normal user terminal. If another
file fails, inspect that exact file; do not apply a recursive permissions reset.
This step has NOT been executed and does not guarantee the remaining build.

## Disposable MySQL setup (approval required before provisioning)

Neither TEST_DATABASE_URL nor the explicit isolation confirmation was configured
in the inspected environment. No database connection or write was attempted.

1. Have the database operator provision a NEW empty disposable MySQL database
   and a NEW user restricted to that database and the test runner host. Confirm
   disposal authorization explicitly; a name containing `test` is insufficient.
   Do not copy customer data, grant global privileges or reuse application users.
2. Store the new connection URL securely in the runner's TEST_DATABASE_URL.
   Set INTEGRATION_TEST_DATABASE_CONFIRMATION to
   `STAR_PYRAMIDS_ISOLATED_TEST_DB`. Do not edit the existing application .env.
   Keep the application DATABASE_URL available only for the guard's comparison.
   URL-encode credentials. Do not paste credentials into logs or documentation.
3. Verify the actual server/database identity and restricted user grants with
   the operator, including DNS aliases. The code compares parsed host/port/name;
   it cannot prove that two different DNS names are different physical servers.
4. Only after that confirmation, run `pnpm db:test:deploy`. The existing guarded
   script applies existing migrations solely to TEST_DATABASE_URL after checks.
   Do not run migrate reset, broad seeds or application migrations as a shortcut.
5. Add/run explicitly selected CMS integration scenarios against that database:
   draft save, publish, public read, update, restore, revision conflict, EN/ES/IT
   persistence and permission denial. Current mocked lifecycle tests do not
   replace these checks. Use synthetic CMS records only.
6. For authenticated browser tests, launch a separate test application process
   on a different port with DATABASE_URL pointing ONLY to the approved disposable
   database, a separate temporary MEDIA_STORAGE_DIR and approved test accounts.
   Never change the existing application's environment or use real customer data.

## Hostinger storage requirements

`lib/server/media.ts` reads MEDIA_STORAGE_DIR; without it the default is
`<cwd>/storage/media`. Video storage shares that root. Retrieval is through
`/media/...` and `/gallery-videos/...`, not a public_html directory assumption.

The previously reported SSH path is:

`/home/u909646470/domains/starpyramids.com/uploads`

Use that exact value for MEDIA_STORAGE_DIR only after the host/operator confirms
that the runtime can traverse/read/write it and that it is retained independently
of deployment versions. Its existence and surviving one redeploy do not establish
a persistence guarantee. Configure backups and a consistent root for every app
instance; retain matching database media references. Existing uploads must not be
moved or tested destructively. Use an approved isolated directory to verify
upload/retrieval before and after redeployment, including mobile media/posters.

Hostinger documents versioned deployments, not a durable sibling upload-path
guarantee: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/

No production readiness claim is made until build, isolated MySQL/browser checks
and the actual hosting storage behavior have been verified.
# Additional Pages Validation (2026-10-14)

- Five previously uncovered blocks now consume published CMS data: FAQ questions,
  Guide and Accessible contact CTAs, Privacy and Terms owner-authored content.
  The FAQ introduction was discovered and connected as an additional block.
- Same private draft/CAS/RBAC architecture, allowlisted per-page keys, actual
  protected inert page previews, SEO and public rendering. No live DB writes.
- 274 database-independent tests passed across 27 explicitly selected files.
  TypeScript passed; direct Next webpack build passed (267/267); diff check passed.
- Remaining coverage is 29 page blocks and three shared concerns. This batch does
  not establish complete CMS coverage or authenticated browser/Hostinger readiness.
- Original FAQ answers have no ES/IT source; defaults preserve their English
  fallback. Approved full legal copy must be supplied by the owner.

# Final Remaining-Coverage Implementation (2026-10-14)

- Supersedes older partial coverage entries: 56 entries / 53 actual route patterns;
  166 page ownership blocks (81 CMS, 23 original modules, 62 functional) plus
  11 shared entries (3 CMS, 7 original modules, 1 functional). Eligible uncovered: 0.
- All 29 previous blocks accounted for: 16 presentation integrations and 13
  source-evidenced functional classifications. Detailed inspection added 24 actual
  presentation registrations; no business records were copied or reclassified away.
- Reused existing private SiteSetting lifecycle, CAS, auth/origin guards, media
  endpoint and visual editor. Every registered new field has an actual consumer.
- Real-component SSR tests verify published text/media/link/order/visibility,
  repeaters, required Contact form on CMS failure, and original About markup in
  EN/ES/IT. Safe tests cover shared header/mobile navigation/footer/help and
  responsive CSS; no request was submitted to the live database.
- Browser URL-policy rejection prevents live desktop/mobile pixel/interaction
  verification here. No workaround attempted. Authenticated demo-database
  save/publish and Hostinger runtime/storage permissions remain unverified.
- Original legal placeholders and all existing data/media/environment files are
  preserved. Full approved legal text remains an owner-supplied content dependency.
- Final standalone TypeScript passed (`tsc --noEmit --incremental false`).
- Final safe suite passed: 323/323 tests in 31 explicitly selected files; no
  database-writing integration tests were run against the demo database.
- Final direct Next webpack production build passed: 267/267 generated pages,
  exit code 0, including its TypeScript stage; no Prisma regeneration was needed.
- `git diff --check` and explicit new-file whitespace checks passed. Existing
  LF/CRLF notices are warnings, not validation failures.
- No authenticated browser/production readiness claim: direct browser access
  remains blocked by tool URL policy; live persistence and hosting QA are unverified.
