# Remaining feature-owned contracts — Phase 8

Six root contracts relocated into existing catalogue/, seo/ and cms/heroes/ folders. lib/ direct files: **24 → 18** (including README). components/ stays at 16 and lib/server/ at 23. No new folder, wrapper or barrel.

| Original | Destination |
| --- | --- |
| `lib/catalogue-translations.ts` | `lib/catalogue/catalogue-translations.ts` |
| `lib/destination-builder.ts` | `lib/catalogue/destination-builder.ts` |
| `lib/destination-write.ts` | `lib/catalogue/destination-write.ts` |
| `lib/record-seo.ts` | `lib/seo/record-seo.ts` |
| `lib/seo-content.ts` | `lib/seo/seo-content.ts` |
| `lib/website-heroes.ts` | `lib/cms/heroes/website-heroes.ts` |

## Remaining root files: KEEP

| File under lib/ | Reason |
| --- | --- |
| `admin-store.ts` | Mixed public/admin brand, settings, preview and catalogue facade; splitting is outside a move-only task. |
| `auth-types.ts` | Public auth contracts shared across client/server and account/admin. |
| `brand-settings.ts` | Brand defaults and validation shared by root layout, public UI and admin. |
| `country-label.ts` | Shared localized country labels used by multiple form controls. |
| `currency.ts` | Cross-feature currency/money contract for booking, cars and payments. |
| `date-calendar.ts` | Shared date/calendar logic for dashboard and unrelated request controls. |
| `documents.ts` | Stable document contracts shared by customer UI and financial/document services. |
| `json-text.ts` | Shared JSON/LONGTEXT helpers; also an external source-extraction contract. |
| `locale-config.ts` | Global enabled-language contract plus external source-extraction dependency. |
| `locale-helpers.ts` | Generic typed locale fallback helpers; not auth business logic. |
| `payment.ts` | Stable financial contract shared by UI, payment services and gateways. |
| `phone.ts` | Shared country-aware phone validation, normalization and formatting. |
| `query.ts` | Cross-feature public query contracts for search, catalogue and forms. |
| `README.md` | Directory ownership guide. |
| `site-copy.ts` | Mixed navigation/footer/form/search copy facade. |
| `staff-preview-client.ts` | Shared client preview/security state and account integration. |
| `use-current-user.ts` | Shared authenticated-user hook used by public, account and admin UI. |
| `utils.ts` | Shared cn primitive and components.json alias target. |

## External contracts

Five external code files and scripts/ensure-real-tour-destinations.cjs received source-path literal updates only. Their file names, data locations, operational entry guards, target checks and algorithms remain unchanged. Snapshot/hotfix copies, historical manifests, payloads and SQL were not rewritten. Syntax checking and top-level source-symbol/path verification do not invoke their operational code.

- `D:/Development/star-pyramids-nodejs/LOCAL_MULTI_DAY_CATEGORY_TRANSFER/transfer.cjs`
- `D:/Development/star-pyramids-nodejs/DESTINATIONS_REAL_TOURS_VERIFICATION/validate-v3.cjs`
- `D:/Development/star-pyramids-nodejs/temp/first-trips-preparation/validate-preparation.cjs`
- `D:/Development/star-pyramids-nodejs/temp/second-trip-preparation/validate-tour-two.cjs`
- `D:/Development/star-pyramids-nodejs/temp/real-tours-batch/validate_batch.cjs`

Reversing only the approved source paths reproduces all original code hashes. The eight absent protected historical-reference paths recorded in [Phase 7](source-organization-phase7.md) remain a separate pre-existing prerequisite for rerunning legacy validators; their ledgers were not weakened or rewritten.

## Verification

TypeScript passed after every batch. Focused checks passed: **89 catalogue tests (62 + 27), 206 SEO tests, 60 hero tests**. The full default suite ran once: **3283 passed, 0 failed, 1 skipped**, across **243 passed test files and 1 skipped file**, in 391.01 seconds. Graph checks resolved **3836 local references across 934 files**, with zero unresolved paths, casing mismatches, runtime cycles or client/server leaks. Reconstruction checked 947 original source files, including 107 reference-only changes. All 328 live manifest hashes match. Syntax-only checks passed for five external scripts and one in-app tool; all 37 literal source paths and 99 selected declarations exist. Their operational entry points were not invoked. Git HEAD/index, unrelated files and GTM fix 7993c03 remain preserved; git diff --check passed. The prior randomized Base64url tamper assertion in booking-confirmation.test.ts is intentionally unchanged; no booking behavior or test assertion is modified by this phase.

No database, Prisma, environment, dependency, production build, browser, commit, push or deployment operations are performed.
