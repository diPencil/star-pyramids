# Shared language ownership — Phase 9

Four existing language/text modules are now grouped in one new lib/i18n/ directory. This is a cohesive cross-feature responsibility, not a catch-all folder. No new abstraction, barrel, wrapper or duplicate implementation. lib/ direct files: **18 → 14**, including README; components/ stays 16 and lib/server/ stays 23.

| Original | Destination |
| --- | --- |
| `lib/locale-helpers.ts` | `lib/i18n/locale-helpers.ts` |
| `lib/country-label.ts` | `lib/i18n/country-label.ts` |
| `lib/site-copy.ts` | `lib/i18n/site-copy.ts` |
| `lib/locale-config.ts` | `lib/i18n/locale-config.ts` |

## Preserved behavior

The LocaleProvider remains in components/locale.tsx with the same state ownership, effects and exports. Enabled EN/ES/IT, disabled Arabic, legacy locale types, English fallback, preference-cookie names/flags/TTL and country ISO identity are unchanged. Existing literal copy was moved intact. locale-config.ts, country-label.ts and site-copy.ts retain identical raw bytes; the remaining module and consumers only change path references. No language was added or enabled.

## External contracts

Only the source path for locale-config changed in these three existing tools; filenames, data paths, extraction symbols and operational guards remain unchanged. Syntax and source-symbol/path checks were performed without invoking operational entry points.

- `D:/Development/star-pyramids-nodejs/temp/first-trips-preparation/validate-preparation.cjs`
- `D:/Development/star-pyramids-nodejs/temp/second-trip-preparation/validate-tour-two.cjs`
- `D:/Development/star-pyramids-nodejs/temp/real-tours-batch/validate_batch.cjs`

The protected historical-input limitations from Phase 7 remain separate and unchanged; no historical payloads, hashes, backup contents or data records were rewritten.

## Remaining root files — KEEP

| File under lib/ | Reason |
| --- | --- |
| `admin-store.ts` | Cross-feature public/admin settings, branding, preview and catalogue facade; moving without splitting would obscure ownership. |
| `auth-types.ts` | Stable auth contracts shared by public/account/admin client and server code. |
| `brand-settings.ts` | Global brand defaults/validation used by root layout, public and admin. |
| `currency.ts` | Shared financial denomination and formatting contract spanning booking, cars and payments. |
| `date-calendar.ts` | Shared date/calendar algorithms used by unrelated forms and dashboard. |
| `documents.ts` | Stable cross-feature commercial-document contract. |
| `json-text.ts` | Shared JSON/LONGTEXT helper; external source-extraction dependency remains stable. |
| `payment.ts` | Established financial contract shared by UI, services and gateways. |
| `phone.ts` | Shared country-aware phone validation and formatting infrastructure. |
| `query.ts` | Established cross-feature query parsing contract for catalogue/search/forms. |
| `README.md` | Library directory guide. |
| `staff-preview-client.ts` | Shared security/preview integration; keep its established boundary stable. |
| `use-current-user.ts` | Sitewide authenticated-user hook used by public/account/admin UI. |
| `utils.ts` | Shared cn primitive pinned by components.json alias; configuration is untouched. |

## Verification

TypeScript passed after both batches; focused test counts were **71 and 106 passed**. The full default suite ran once: **3283 passed, 0 failed, 1 skipped**, across **243 passed files and 1 skipped file**, in 427.37 seconds. Graph verification resolved **3836 local references across 934 files**, with zero missing references, case mismatches, runtime cycles or client/server leaks. Source reconstruction checked 947 original files, including 103 path-only changes. All 332 live relocation hashes match. Three external tools passed syntax-only and source contract checks (29 literal source paths and 99 selected declarations), without operational execution. Git HEAD/index and protected source/configuration files remain unchanged; git diff --check passed. The previously identified randomized booking-confirmation tamper assertion was not modified or claimed to be repaired. Reconstruction verifies that source changes are path-only, and reversing external path updates restores their original SHA-256 values. GTM fix 7993c03 and all previous modularizations remain preserved. No database, Prisma, environment, dependency, browser, production build, staging, commit, push or deployment operations were performed.
