# Phase 10 — Centralized currency system

## Findings and implementation
Currency lists/types/selector options were duplicated between locale, admin, customer, Settings and Rent Cars. Events accepted arbitrary strings and their public labels defaulted unspecified historical denominations to USD while discarding cents. Native accounting DTOs substituted USD for stored currencies; payment creation and balance aggregation lacked complete stored-currency checks. Currency settings/client display used hardcoded fallback exchange rates.

`lib/currency.ts` is the isomorphic authority for USD/EUR/EGP, Currency/SupportedCurrency types, strict canonical validation, safe input normalization, selector options, localized currency names, native formatting and the USD tour-booking constant. It imports neither React nor server-only code. Existing imports from car-pricing and components/locale remain compatible through re-exports.

Native `formatCurrency` does not convert amounts. Historical unknown codes stay explicit; missing denominations stay unassigned. EN/ES/IT formatting preserves cents. Dormant Arabic is not enabled. `formatPrice` remains the existing USD display-conversion boundary, using only configured valid exchange rates. If no rate exists it displays the original USD amount with USD formatting. No historical amounts or records are converted. No live FX service is invented.

## Behavior by module
- **Events:** existing SharedSelect replaces free text. Server normalizes valid input and rejects unsupported nonempty codes. Omitted update values preserve existing currency, including null/legacy codes. Explicit null stays null. Native public/event add-on labels preserve denomination and cents.
- **Rent Cars:** shared code list/validation used through compatibility exports, shared selector options, canonical quote-response validation, native quote formatting. Existing tier selection, integer cents, FIXED_TOTAL/PER_PERSON, manual return, reverse-leg matching/currency rejection, multiplier fallback remain in place.
- **Tours / Trip Builder / Offers:** amounts remain USD-based; no per-tour selector introduced. Existing booking totals/preview remain authoritative. Tour and offer display conversion requires a configured rate.
- **Bookings / Payments:** stored native denominations are preserved in read DTOs and corresponding customer/admin views. New payment/receipt/refund accounting remains USD-only, checked under transaction locks; mixed-currency balances are rejected for financial review, not summed or converted. Accounting dialog limits use native USD. Historical records are not rewritten.
- **Settings / language / customer preferences:** shared supported options/type/validation. Missing rates are unconfigured rather than fabricated. Settings previews identify missing rates. Reset display currency preserves configured rates.
- **Documents:** existing USD-only accounting guards preserved. No new currencies enabled for accounting adapters.

## Phase 10 files
Shared and client configuration:
- lib/currency.ts (new)
- components/locale.tsx
- components/language-selector.tsx
- components/admin/admin-shell.tsx
- components/admin/admin-currency.tsx
- lib/storefront-settings.ts
- lib/server/settings.ts
- app/admin/settings/page.tsx

Pricing and request consumers:
- lib/car-pricing.ts
- lib/car-request.ts
- lib/car-quote-client.ts
- components/admin/car-pricing-manager.tsx
- lib/trip-request.ts
- lib/server/trip-requests.ts
- app/make-your-trip/trip-request-planner.tsx

Events:
- app/admin/events/new/page.tsx
- app/api/events/route.ts
- app/api/events/[slug]/route.ts
- lib/events.ts
- components/extended-pages.tsx (event currency labels only)

Accounting:
- lib/booking.ts
- lib/payment.ts
- lib/server/bookings.ts
- lib/server/payments.ts
- app/admin/bookings/page.tsx
- app/admin/bookings/[ref]/content.tsx
- app/admin/payments/page.tsx
- app/admin/payments/[ref]/content.tsx
- components/account-portal.tsx
- components/booking-payment.tsx
- components/booking-print-document.tsx

Tests:
- tests/currency.test.ts (new)
- tests/currency-storefront.test.ts (new)
- tests/event-currency-api.test.ts (new)
- tests/accounting-currency.test.ts (new)
- tests/payments/offline-payments.test.ts (mock currency columns)
- tests/payments/offline-refunds.test.ts (mock currency columns)

## Data and safety
No database writes, data inspection, migrations, reset, seed or backfill performed for this phase. No env/media/production changes, browser tests, commit, push or deployment. Existing uncommitted work from earlier phases preserved. No changes to web-source-recovery. Existing schema currency fields are adequate; no schema changes were required for Phase10. Data integrity confirmation is by absence of database-writing operations and mocked regression tests, not a live row-by-row verification.

## Verification
Results finalized below. The first full run exposed outdated payment mocks missing newly selected currency columns; fixtures were corrected without weakening production checks. The initial build caught client-directive/import ordering; corrected before final build. Safe suite uses existing exclusions for database-writing integration tests. Production validation uses `pnpm exec next build --webpack`, avoiding replacement of the pre-existing locked Prisma DLL; combined prisma-generate build is not claimed.

## Limitations / acceptance
No browser checks or live database mutation tests, per request. No external exchange-rate feed. Configure actual rates through Settings if converted USD display is needed. Existing foreign/mixed accounting records, if any, require financial review before new accounting writes; no such records were modified or assumed to exist.

Manual checklist:
1. Check USD/EUR/EGP choices in public/account/admin and Settings.
2. Create/edit Events in each supported currency; confirm cents, localization and saved values. Check a legacy unspecified event remains unspecified after unrelated edits.
3. Check car fixed/per-person quotes and round-trip totals in each native currency.
4. Check tour/offer display with configured rates; booking/payment accounting must stay USD. Without configured rates, USD prices must remain labeled USD.
5. Check accounting receipt/refund dialog limits and customer/admin native amounts. Do not use existing records for destructive testing.

Final results: focused currency/Event/accounting tests 3 files / 71 passed; safe full suite 127 files / 1659 passed; unit suite 24 files / 264 passed; standalone TypeScript passed; final Next production build passed with exit 0 and 282/282 pages (including build TypeScript); git diff --check passed. No browser verification.

Independent review found stale-rate retention and admin locale context issues; both were corrected with authoritative snapshot replacement and enabled admin preference/event reading. Five added regression cases passed as part of the final full suite.
