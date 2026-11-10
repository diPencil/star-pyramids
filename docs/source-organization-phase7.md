# Source ownership and import-tool contracts — Phase 7

Eight feature-owned root modules relocated into existing tours/ and trip-builder/ directories. No wrappers, barrels, new dependencies, UI or business changes. lib/ direct file count: **32 → 24**, including README.md. components/ remains 16; lib/server/ remains 23.

| Original | Destination |
| --- | --- |
| `lib/tour-json.ts` | `lib/tours/tour-json.ts` |
| `lib/tour-translations.ts` | `lib/tours/tour-translations.ts` |
| `lib/tour-publish.ts` | `lib/tours/tour-publish.ts` |
| `lib/tour-write.ts` | `lib/tours/tour-write.ts` |
| `lib/tour-public-locale.ts` | `lib/tours/tour-public-locale.ts` |
| `lib/tours-client.ts` | `lib/tours/tours-client.ts` |
| `lib/trip-builder-preview.ts` | `lib/trip-builder/trip-builder-preview.ts` |
| `lib/trip-builder-destinations.ts` | `lib/trip-builder/trip-builder-destinations.ts` |

## External source contracts

The following nine code-only tools retain their names, execution locations, data paths, safety checks and algorithms. Only literal references to relocated app source were updated. Source path existence, syntax parsing and required top-level declaration names were checked without running their operational entry points. Reversing path updates reproduces every original script SHA-256 byte-for-byte.

- `D:/Development/star-pyramids-nodejs/REAL_TOURS_IMPORT_PACKAGE_V2_GROUP_SIZE/validate-group-size.cjs`
- `D:/Development/star-pyramids-nodejs/REAL_TOURS_DATABASE_IMPORT/import-local-drafts.cjs`
- `D:/Development/star-pyramids-nodejs/REAL_TOURS_DATABASE_IMPORT/verify-stored-tours.cjs`
- `D:/Development/star-pyramids-nodejs/REAL_TOURS_EXISTING_DRAFT_UPDATES/apply-existing-draft-fields.cjs`
- `D:/Development/star-pyramids-nodejs/DESTINATIONS_REAL_TOURS_VERIFICATION/validate-v3.cjs`
- `D:/Development/star-pyramids-nodejs/temp/second-trip-preparation/validate-tour-two.cjs`
- `D:/Development/star-pyramids-nodejs/temp/first-trips-preparation/validate-preparation.cjs`
- `D:/Development/star-pyramids-nodejs/temp/first-trips-preparation/import-tour-one.cjs`
- `D:/Development/star-pyramids-nodejs/temp/real-tours-batch/validate_batch.cjs`

All 46 literal source paths and 99 selected declarations exist. No import/update/validation command, database transaction or email was invoked. Existing unit tests import only guarded pure exports of the import boundary; its require.main entry is not called.

## Existing historical-input limitation

The offline batch validator also checks eight protected historical reference paths, including FIRST_TRIP/SECOND_TRIP artifacts and web-source/first-trips.pdf. Those old paths are absent following prior root organization; none was removed by this phase. Their JSON/hash ledger and preserved source data were left unchanged. A complete operational rerun of these historical tools is not verified and requires separately reconciling those inputs; the source-module relocation checks do not claim to validate all historical data dependencies.

## Remaining root files

The following 24 files retain their previous ownership decisions: global settings/auth/locale/money/query/UI infrastructure, shared document/payment contracts, and externally pinned destination/SEO/hero source contracts outside this batch. No need to empty the root. See the [Phase 6 file-by-file decisions](source-organization-phase6.md) for their individual reasons.

- `lib/admin-store.ts`
- `lib/auth-types.ts`
- `lib/brand-settings.ts`
- `lib/catalogue-translations.ts`
- `lib/country-label.ts`
- `lib/currency.ts`
- `lib/date-calendar.ts`
- `lib/destination-builder.ts`
- `lib/destination-write.ts`
- `lib/documents.ts`
- `lib/json-text.ts`
- `lib/locale-config.ts`
- `lib/locale-helpers.ts`
- `lib/payment.ts`
- `lib/phone.ts`
- `lib/query.ts`
- `lib/README.md`
- `lib/record-seo.ts`
- `lib/seo-content.ts`
- `lib/site-copy.ts`
- `lib/staff-preview-client.ts`
- `lib/use-current-user.ts`
- `lib/utils.ts`
- `lib/website-heroes.ts`

## Verification

TypeScript passed after each of three batches. Focused test batch results: **119, 87 and 110 passed**. Before/after reconstruction checks cover all original source files and external scripts, permitting only path literal changes. The full default suite ran once: **3282 passed, 1 failed, 1 skipped** (242 passed files, 1 failed, 1 skipped; 252.39 seconds). The unchanged `tests/booking-confirmation.test.ts:54` randomly replaces two Base64url characters with `zz`; that replacement can decode to identical authentication-tag bytes (for example, suffix `zw` and `zz`). The isolated file rerun passed **9/9**. Both test and confirmation implementation hashes exactly match the pre-move baseline. No production or test change was made to hide this unrelated randomized assertion problem.

Final graph checks resolved **3836 local references** across **934 files**, with no missing paths, case mismatches, runtime import cycles or client/server leaks. Reconstruction checked **947 existing source files**, including **80 path-only changes**, plus all nine external script originals. All **322 live relocation hashes** match. GTM fix 7993c03, previous modularizations, HEAD/index and unrelated files remain preserved. `git diff --check` passed. No production build or browser testing is run. Git staging, commit, push, deployment, Prisma/schema, dependencies, environment files and operational data remain untouched.
