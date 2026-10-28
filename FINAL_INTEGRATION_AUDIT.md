# Final integration audit — local code completion

Audit concluded 2026-10-28. This report distinguishes source review, automated tests, read-only database evidence and unverified runtime scenarios. No browser testing, production operations, staging, commits, pushes, deployments, migrations, seeds or resets were performed. Previous phase changes and unrelated scratch/untracked files were preserved.

## 1. Modules audited

| Area | Evidence / boundary |
| --- | --- |
| Trip Builder and tours | Editor initialization/state/serialization; category-specific detail; gallery/media references; optional clears; translations/SEO preservation; draft/publication; tour APIs/read repository/cache; pricing projection and authoritative booking engine |
| Rent Cars | Fleet/location/route APIs; parent configuration/tiers; parent row locking; capacity changes; FIXED_TOTAL/PER_PERSON; manual/automatic returns; quote/request snapshots; admin and account quote display |
| Accounting | Customer ownership; booking/payment/document idempotency; transaction lock order; receipt balance; refund deduplication; stored currencies; immutable snapshots |
| CMS and public content | Page/hero drafts, preview guards and publication; sustainability badge; gallery/lightbox; reviews/moderation/provider secret boundary; destination visibility; media uploads/retrieval; SEO publication/sitemap |
| Authentication / frontend | Opaque server sessions, active-user/permission guards, admin layout, same-origin mutations, public/private caches; Base UI dialog and shared form controls; code-only mobile/keyboard/empty/error-state review |
| Database / Git | Prisma validation, local migration status, read-only schema drift and referential checks; business-table fingerprints; cumulative dirty working-tree review |

Detailed CMS path inventory is in `CMS_PUBLIC_CONTENT_INTEGRATION_AUDIT.md`. This was a risk-focused source audit, not a proof that every possible application state is correct.

## 2. Confirmed defects and fixes

### Trip Builder / tour lifecycle
- Optional scalar clears were omitted by JSON serialization and Prisma consequently retained old titleAr/groupSize/travelStyle/cruise/port/discount fields. `tourWritePayload` now sends explicit nulls while preserving arrays and active category content.
- Save & Publish inherited a draft record's status instead of explicitly publishing. Saves now choose the target status explicitly; new/unpublished records can use Save Draft, while existing published records are not silently unpublished through that action.
- Status-only publication could bypass the editor's required category content. The merged server record must pass title/duration/cover/base-price and destination/multi-day category/cruise/port requirements.
- APIs lacked consistent validation for finite nonnegative prices, passenger counts, duplicate tiers, supported categories/status, malformed JSON and image URL compatibility. Validation now rejects invalid supplied values before persistence. Tour image sources match the existing Next image loader (local/uploaded paths or configured Unsplash/Wikimedia HTTPS hosts); no broad image-proxy allowlist was introduced.
- Stale builder saves lacked a client revision token and update races surfaced as unhandled Prisma failures. Updated-at tokens now reject stale saves; unique/update races return 409. Reserved SEO is preserved by the existing atomic update guard.
- Successful saves now invalidate the public tour cache. Cache invalidation rejects stale in-flight responses and notifies warm consumers. Published-only APIs omit hidden/deleted rows, so client lists no longer resurrect static bootstrap copies, including when the published catalogue is unavailable.
- Saves wait for tracked image uploads. Preview remains read-only/local; dirty-state snapshots still exclude preview counts/language/device controls.

### Rent Cars / Events
- Fleet partial updates now merge from the locked row, preventing concurrent capacity/publication changes from being overwritten.
- Location activation rejects non-boolean input.
- Public Events endpoints hide unpublished events; editor reads retain authorization.
- Event requests require a published canonical target and snapshot its server-owned details. Cancellation/staff transitions guard stale state, and public errors conceal database diagnostics.
- Existing tier locking, currency consistency, round-trip calculation and quote snapshot behavior was retained and regression-tested.

### Bookings / payments / receipts / refunds
- Global payment or booking idempotency keys could replay another customer's/booking's result. Replays and conflict winners now verify the original owner and target before returning data.
- Payment initiation checks active attempts under the booking lock, preventing concurrent keys from creating duplicate active attempts.
- Offline receipt replay checks include amount, method and reference evidence. Refund deduplication uses immutable payment evidence rather than a mutable free-text note, while distinct valid evidence remains distinguishable.
- Financial transitions follow booking → payment lock order and recheck locked identity/currency/state/amount. Unsafe cent arithmetic is rejected; mixed currencies are not combined or relabeled.
- Document issuance replays check document type, booking/payment target and accounting currency; an unrelated key cannot select an existing document.
- Financial/customer histories and stored records were not rewritten.

### CMS / public boundaries
- Unpublished destinations are excluded from anonymous APIs; authorized editor reads use a separate no-store cache.
- Catalogue generation guards prevent stale responses from restoring invalidated content.
- Upload streams are byte-bounded before multipart parsing, even without a truthful Content-Length. Existing permission, signature and file-size checks remain.
- Page/hero preview authorization, draft privacy, sustainability media fallback, gallery publication, review moderation/scopes and SEO/sitemap publication filtering were reviewed with their existing and extended safe test coverage.

## 3. Files changed in this audit (earlier phase files remain dirty separately)

Tours:
- `lib/tour-write.ts` (new)
- `components/admin/trip-builder.tsx`
- `app/api/tours/route.ts`
- `app/api/tours/[slug]/route.ts`
- `lib/tours-client.ts`
- `tests/tour-write-integration.test.ts` (new)
- `tests/tour-cache-race.test.ts` (new)
- `tests/tour-publish-sync.test.ts`
- `tests/record-seo-storage.test.ts` (schema-accurate Tour fixture)

Rent Cars / Events:
- `lib/server/car-pricing.ts`
- `app/api/admin/rent-car/locations/[slug]/route.ts`
- `app/api/events/route.ts`
- `app/api/events/[slug]/route.ts`
- `lib/events-cars-client.ts`
- `lib/server/event-requests.ts`
- `app/api/event-requests/route.ts`
- `tests/car-pricing.test.ts`
- `tests/event-currency-security.test.ts` (new)

Accounting:
- `lib/server/bookings.ts`
- `lib/server/payments.ts`
- `lib/server/documents.ts`
- `tests/accounting-security.test.ts` (new)
- `tests/accounting-document-security.test.ts` (new)
- `tests/accounting-currency.test.ts` (mock adjustments)
- `tests/payments/financial-transactions.test.ts` (locked-query fixtures now include actual id/currency)

CMS/media/publication:
- `app/api/destinations/route.ts`
- `app/api/destinations/[slug]/route.ts`
- `lib/catalogue-client.ts`
- `app/api/media/route.ts`
- `app/api/admin/website-cms/hero-media/route.ts`
- `lib/server/upload-form.ts` (new)
- `tests/destination-publication-api.test.ts` (new)
- `tests/destination-cache-boundary.test.ts` (new)
- `tests/upload-form-boundary.test.ts` (new)
- `tests/gallery-api.test.ts`
- `tests/website-hero-media.test.ts`
- `BACKEND_SETUP.md`

Verification/reporting:
- `scripts/verify-final-integration-readonly.cjs` (new, SELECT-only)
- `CMS_PUBLIC_CONTENT_INTEGRATION_AUDIT.md`
- `FINAL_INTEGRATION_AUDIT.md`

## 4. Trip Builder code-level end-to-end verification

Mocked actual-handler tests create a draft, deny anonymous draft access, reopen into editorData, project unsaved edits without persistence, publish, and check public detail/list responses. They verify explicit clears, invalid monetary/category input, status-only publish prerequisites, stale revisions/races and authorization/origin boundaries. Existing preview tests cover category content, pricing matrices, translations, media and linked-offer provenance. Booking tests use authoritative server pricing and snapshots rather than trusting submitted totals.

This does not mean a real save/upload/booking was performed in the current demo database. Draft saving still requires the editor's valid core/pricing structure; it is not a new partial autosave/versioning architecture. Existing published content is edited directly through the existing Tour model.

## 5. Database evidence

- `prisma validate`: passed.
- `prisma migrate status`: 43 applied migrations; database up to date.
- Read-only `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code`: no difference, exit 0.
- Local target confirmed as MariaDB/MySQL datasource `127.0.0.1:3306/star_pyramids`. No production target used.
- SELECT-only fingerprints across 20 business tables match before/after: `fa35848c0a6b06ef678eda5c434b34389795617ed01d5eddc478641bd1e62336`.
- Counts include 59 tours, 7 offers, 4 cars, 10 destinations, 3 events, 8 bookings/8 lines, 3 payments/4 payment events, 1 review. Car route/config/tier tables are empty locally: real configured-tier behavior is covered by mocked tests rather than invented live results.
- All 40 declared foreign-key relationships checked with read-only orphan queries: zero orphan rows.
- Initial sandbox migration-status connection failed with an empty schema-engine error; the read-only rerun outside the network restriction passed. No repair/migration was required.

## 6. Automated verification and build

Final results on the completed audit source:

- TypeScript: passed (standalone and production-build TypeScript).
- Full configured safe suite: **135 files / 1737 tests passed**.
- Official unit subset: **24 files / 264 tests passed**.
- Final affected tour/preview/SEO-cache suite: **4 files / 93 tests passed**.
- Production Next build: **passed, exit 0, 282/282 pages**, including build traces. Command: `pnpm exec next build --webpack`. Prisma generation was not rerun because no audit schema change requires it and an existing Windows DLL lock was documented in earlier phases; no unrelated process was stopped or binary deleted.
- `git diff --check`: passed.
- Staging area: empty; no staging, commit or push performed.

 Earlier failing runs exposed incomplete old fixtures (missing actual locked-query id/currency and required Tour fields), corrected without weakening the production guards.

Excluded database-writing integration files (existing suite configuration):
- `tests/documents/commercial-access.test.ts`
- `tests/documents/commercial-issuance.test.ts`
- `tests/documents/commercial-pdf.test.ts`
- `tests/documents/document-access.test.ts`
- `tests/documents/document-issuance.test.ts`
- `tests/documents/document-lists.test.ts`
- `tests/documents/document-numbering.test.ts`
- `tests/documents/pdf-download.test.ts`
- `tests/payments/payment-proofs-concurrency.test.ts`

These were not run against the demo DB and are not counted as verified. No TEST_DATABASE_URL was required to continue the audit.

## 7. UI/security review limits

Used the repository's `21st-ui-review` instructions and existing design context for static review. The 21st CLI was unavailable; no CLI audit or browser results are claimed. Existing Base UI dialogs, focus/keyboard lifecycle, responsive CSS and shared controls were inspected. No broad visual redesign or Arabic enablement was performed.

Independent review found save-cache invalidation, warm-cache subscription and missing server category publication requirements; all were addressed with affected checks rerun. Accounting/CMS/Cars boundaries were reviewed in separate work scopes, then integrated and tested. No live database concurrency stress test was performed.

## 8. Remaining owner acceptance (not browser-verified / not live-write-verified)

1. Create a new trip in every category, add valid pricing/media, save draft, reopen, preview EN/ES/IT, publish and verify public detail/list/category placement.
2. Clear optional fields/discount/gallery-related content, save and reopen. Keep two editors open and confirm stale-save conflict rather than silent overwrite.
3. Verify file upload progress blocks saving, valid uploaded/local/approved remote images render, and preview never triggers booking/save.
4. Exercise car FIXED_TOTAL/PER_PERSON and one-way/manual/automatic round-trip quotes; submit a request and verify saved snapshot and staff display.
5. Exercise a USD booking/payment/partial receipt/refund using owner-approved test records; repeat a submission and confirm no duplicate money/document. Verify native event/car currency remains unchanged by display preferences.
6. Hide/publish destinations/events/tours and verify public omission, including same-tab cache refresh. Confirm a read-only staff account cannot mutate.
7. Check CMS draft vs public publication, sustainability image replace/remove/fallback, gallery media/lightbox, review approval and SEO/sitemap output.
8. Check narrow mobile widths, long labels, keyboard focus/Escape, dropdowns and empty/error states.

This report does not declare production readiness or 100% correctness. Await owner acceptance before any staging/commit/push/deployment.
