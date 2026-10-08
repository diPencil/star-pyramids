# Phase 4F finalization review - 8 October 2026

TypeScript is clean (zero errors). Production build passed. Phase 4F is ready for owner visual/functional review and a scoped commit after approval, with the coverage limits below. Nothing was committed, pushed, reset, reverted, stashed, cleaned, or discarded. Phase 4G was not started.

## Exact files edited during this finalization request

### Final navigation safety fix (subsequent owner request)

Files changed: `lib/enquiry-navigation.ts`, `components/enquiry-history-tracking.tsx`, `app/layout.tsx`, `components/admin/website-enquiries.tsx`, `app/admin/inbox/page.tsx`, `scripts/verify-enquiry-navigation.mjs`, and this report.

- Reload/tab/window close use native `beforeunload` when the draft differs from the saved baseline. This is now explicitly authorized by the owner's final safety request. The browser controls warning text and whether to display it.
- Browser Back/Forward use the existing translated custom dialog for same-document navigation. Cancel retains the draft and original entry; confirm discards the draft and traverses to the original destination. Cross-document navigation uses native unload protection.
- Modern Navigation API traversal is cancelled before Next.js runs. Non-cancelable traversal restores the actual original entry by index before showing the dialog. Older-browser fallback tags existing history entries from document startup; it preserves Next state and tracks native hash entries. No sentinel entries, guessed direction, or forward-search loops are introduced.
- Document-wide fallback bookkeeping renders no UI and never blocks navigation itself. It is required before Inbox mounts to know historical entry positions. Repeated Strict Mode mounting does not stack wrappers. Insecure LAN contexts without `crypto.randomUUID` use a non-security-sensitive marker fallback.
- App links, enquiry switches, Inbox tabs and Refresh retain the custom dialog. One pending action prevents duplicate dialogs. Confirm clears the synchronous dirty guard, preventing a second native warning on approved external navigation. Save success updates the server baseline; failure retains the guard and entered values.

Safety verification on 8 October 2026:

- Authenticated browser: clean Back/Forward navigation; dirty Back and Forward warning; cancellation retains URL/draft; confirmed Back reaches Dashboard and Forward returns to the saved enquiry. A final dirty Forward confirmation reached its intended Bookings destination. Dirty enquiry and Inbox tab switching show the same custom dialog; cancel retains the selected enquiry. Confirmed Inbox tab switch opens Support Conversations and its existing real thread.
- Existing dedicated lifecycle QA enquiry saved temporary notes; save feedback appeared, Save Updates disabled, and clean reload completed normally. A deliberately advanced QA timestamp produced the expected optimistic conflict message; draft, dirty indication and navigation protection remained active after the failed save.
- Dirty reload attempt left the draft intact. The in-app browser did not expose a native `beforeunload` dialog through its dialog API, so no claim is made that native confirmation acceptance or physical tab/window-close was fully exercised. Owner must verify Stay/Leave in a normal browser. The shared unload handler was tested for dirty, clean, failed-save and cleanup states.
- `node --import tsx scripts/verify-enquiry-navigation.mjs`: PASS for modern traversal, non-cancelable restoration, older-browser history fallback, absent randomUUID, native hash entry tracking, cancel/confirm, failed-save protection, saved baseline and listener cleanup. These are deterministic controller tests; older browser engines were not available for live QA.
- All four pre-existing MySQL enquiry rows match exact pre-test snapshots, including timestamps. The dedicated QA row was restored. No QA rows were created/deleted and no owner rows were updated. No schema or migration changes.
- TypeScript: PASS, zero errors. Production build: PASS. `git diff --check`: PASS (existing LF/CRLF notices only). Prisma validation and migration status remain intact.
- Final HTTP regression: `/contact`200 and JSON-null `/api/enquiries`400 with valid JSON error. Independent final navigation code review: no remaining blockers; identified randomUUID/hash fallback issues were repaired and tested.

Browser limitations: `beforeunload` requires prior interaction, uses browser-owned text, and may not fire when a mobile browser is killed by the operating system. No web implementation can guarantee that case. Older-browser fallback requires a fresh document load after deployment; history entries created before tracking was installed (for example during hot replacement) cannot be safely indexed retroactively. Do not infer protection for such untracked entries. Await owner normal-browser QA before commit; no commit/push or Phase 4G work.

- app/api/blogs/[slug]/route.ts
- app/api/blogs/route.ts
- app/api/cars/[slug]/route.ts
- app/api/cars/route.ts
- app/api/offers/[slug]/route.ts
- app/api/offers/route.ts
- lib/json-text.ts
- lib/server/blogs.ts
- lib/server/cars.ts
- lib/server/offers.ts
- lib/server/bookings.ts
- components/admin/website-enquiries.tsx
- components/extended-pages.tsx
- components/site.tsx
- app/admin/bookings/[ref]/content.tsx
- data/content.ts
- docs/phase-4f-inbox-qa.md
- docs/phase-4f-finalization.md

The six API routes and three catalogue mappers share lib/json-text.ts so storage fixes preserve consistent API object payloads and catalogue displays. Existing typography edits in bookings, site and extended-pages were retained.

## Six TypeScript errors repaired

- Blog PUT: decode LONGTEXT content before editorial merge; serialize content on write, preserve unchanged encoded bytes.
- Car PUT: optional credit is SQL null or serialized JSON text, not Prisma.JsonNull/object.
- Car POST (the sixth file omitted from the request's four-path list): same nullable string repair.
- Offer PUT: decode LONGTEXT before media merge, preserve unknown properties, serialize the result.
- Booking nested item create: serialize add-on titles to LONGTEXT; decode to filtered string arrays for clients.
- Booking result projection: fixing nested-create input restores Prisma's inferred included items, activities, payments and user payload, resolving the downstream missing-relations error without a cast.

No ts-ignore, ts-nocheck, unsafe any cast, strictness change, schema change or new dependency was introduced. Existing build config still skips type validation; the separate typecheck passed.

## Verification results

- corepack pnpm exec tsc --noEmit: PASS, zero errors on the final source.
- corepack pnpm build: PASS, final optimized production build.
- git diff --check: PASS; Git only prints LF/CRLF conversion warnings for existing files.
- Prisma validate: PASS. migrate status: all 29 source migrations applied, schema up to date.
- All 29 successfully applied migration checksums match source files. History has 30 entries, including a historical rolled-back 20261008020000_website_enquiries_permissions attempt followed by successful application. No pending migration, reset, deletion or migration file edit.
- Focused Node/tsx assertions: JSON object/array round trips, malformed/null handling, no double encoding, catalogue projections, null car credit, booking add-on projection, and permission matrix passed. MySQL integration writes used a rolled-back transaction; no fixtures retained by that test and no owner rows updated.
- HTTP: contact200, empty/malformed/null/array/missing-field JSON400, unauthenticated enquiry list/detail/staff/PATCH401, existing public request ID replay twice200 with unchanged row count, mismatched replay409.
- Blog/offer/car list and detail GETs200 with decoded object/null payload contracts.
- Authenticated browser available as existing SUPER_ADMIN. Fresh public contact submission saved exactly once in local MySQL with subject custom and raw source /contact. New local QA reference: 97462314-10a5-4ea9-a4f6-2cf592cd6480. It remains New/unassigned for owner review; no deletion.
- Inbox search and status filter passed against real rows. New contact enquiry appears and renders its reference, traveller, message and readable Contact source.
- Dedicated pre-existing lifecycle QA record: status/actual authorized staff/private notes save together; fresh independent MySQL reads and browser refresh matched values. Unassign and restore passed. Final values restored to Resolved/unassigned/previous notes. Original two Phase4F QA records compared field-by-field to snapshot: unchanged.
- Dirty indication appears only for changed fields; revert clears it, clean save disabled. Custom sidebar and enquiry-switch cancellation retains draft. Clean Support tab switch has no warning. Earlier failed-save/conflict/retry browser checks remain documented in phase-4f-inbox-qa.md.
- Support existing real history and workflow buttons loaded; unsent multiline composer enabled Send and clearing disabled it. No customer message, assignment or close action performed.
- EN/ES/IT enquiry fields and Contact source labels checked. Arabic tested through existing admin language control; RTL and translated fields remain compatible, public selector still exposes EN/ES/IT only. Original English locale restored.
- Request Status and Assigned Team Member desktop triggers both y741.125 and height44 in the measured view. Single empty assignment placeholder; no duplicate helper. Desktop1440/tablet768/mobile375 have no horizontal document overflow; mobile list/detail navigation works.
- UI copy scan: presentation em/en dashes and space-separated slash labels removed, including remaining static travel-guide copy and booking per-person labels. Parser patterns/comments and actual URLs/technical paths remain intact. Contact's Spanish breadcrumb copy and location marker encoding fixed without redesign.
- Current authenticated browser console: no error entries.

## Remaining coverage limits and unrelated findings

- Browser navigation safety was added in the subsequent final safety fix documented above. Native reload/close acceptance and mobile/older-engine live behavior remain owner QA; application-controlled navigation retains the custom confirmation UI.
- Only four local enquiries exist, so UI multi-page next/previous navigation could not be exercised. Disabled single-page controls and offset pagination over distinct existing rows were checked. Direct authenticated API navigation was blocked by the in-app browser (ERR_BLOCKED_BY_CLIENT); no claim of an authenticated paginated HTTP test.
- No restricted-role browser session available. Unauthenticated HTTP rejection and permission-function denial/grant cases passed, plus independent server-RBAC review. Live restricted-role403/read-only UI remains owner QA.
- No global lint/unit/E2E framework is configured; focused assertions use existing Node/tsx without installing infrastructure.
- Pre-existing shared public Spanish/Italian navigation/footer mojibake remains outside this scoped fix. Legacy Admin language picker marks ES/IT Soon even though enquiry locale rendering supports them via the public locale setting. Support remains legacy EN/AR. No site-wide localization redesign attempted.
- Substantive unrelated pre-existing change: components/tour-detail.tsx optional locations prop and defensive missing-data access. Preserved.
- Broad existing typography cleanup (dash to hyphen, presentation slash to words/separator), existing AccessStrip encoding cleanup and all other worktree modifications are preserved. Mixed scope must be reviewed before staging an eventual commit.

## Complete pending worktree inventory

This inventory includes pre-existing work, Phase4F, typography and the repairs; it is not a list of files changed solely during this request.

```text
M .21st/design.json
 M app/admin/admin.css
 M app/admin/bookings/[ref]/content.tsx
 M app/admin/bookings/page.tsx
 M app/admin/car-requests/[id]/content.tsx
 M app/admin/cars/[slug]/content.tsx
 M app/admin/customers/[key]/content.tsx
 M app/admin/dashboard/page.tsx
 M app/admin/destinations/page.tsx
 M app/admin/emails/page.tsx
 M app/admin/events/new/page.tsx
 M app/admin/inbox/page.tsx
 M app/admin/offers/new/page.tsx
 M app/admin/payments/[ref]/content.tsx
 M app/admin/payments/page.tsx
 M app/admin/profile/page.tsx
 M app/admin/settings/page.tsx
 M app/admin/trip-requests/detail/content.tsx
 M app/admin/users/page.tsx
 M app/api/auth/login/route.ts
 M app/api/blogs/[slug]/route.ts
 M app/api/blogs/route.ts
 M app/api/cars/[slug]/route.ts
 M app/api/cars/route.ts
 M app/api/offers/[slug]/route.ts
 M app/api/offers/route.ts
 M app/globals.css
 M app/make-your-trip/page.tsx
 M components/account-custom-trip.tsx
 M components/account-portal.tsx
 M components/admin/admin-data.ts
 M components/admin/admin-pagination.tsx
 M components/admin/trip-builder.tsx
 M components/booking-print-document.tsx
 M components/cart-page.tsx
 M components/checkout-page.tsx
 M components/day-tour-detail.tsx
 M components/event-request-form.tsx
 M components/extended-pages.tsx
 M components/live-chat.tsx
 M components/shared-select.tsx
 M components/site.tsx
 M components/tour-detail.tsx
 M components/trips-page.tsx
 M data/content.ts
 M data/tours.ts
 M lib/server/blogs.ts
 M lib/server/bookings.ts
 M lib/server/cars.ts
 M lib/server/customers.ts
 M lib/server/db.ts
 M lib/server/email.ts
 M lib/server/offers.ts
 M lib/server/rate-limit.ts
 M lib/server/settings.ts
 M prisma/schema.prisma
?? app/api/admin/enquiries/[publicId]/route.ts
?? app/api/admin/enquiries/route.ts
?? app/api/admin/enquiries/staff/route.ts
?? app/api/enquiries/route.ts
?? components/admin/website-enquiries.tsx
?? docs/phase-4f-inbox-qa.md
?? lib/json-text.ts
?? lib/server/enquiries.ts
?? prisma/migrations/20261008011738_website_enquiries/migration.sql
?? prisma/migrations/20261008020000_website_enquiries_permissions/migration.sql
?? docs/phase-4f-finalization.md
```

Phase4F untracked implementation: four enquiry API routes, website-enquiries component, enquiry server helper, QA docs, and two migration SQL files. The new json-text helper belongs to the type repair.
