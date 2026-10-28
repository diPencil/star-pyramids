# Rent Cars — Phase 4 and final local verification

Date: 2026-10-27. Local implementation only. No browser navigation, browser tests, production access, commits, pushes, deployments, environment changes, seeds, or business-data writes were performed in this phase.

## Implemented customer lifecycle

- Database locations and published fleet, directional route selection, capacity checks, one-way/round-trip selection and passenger controls.
- Live tier pricing supports FIXED_TOTAL and PER_PERSON. The displayed total is the selected journey's computed total, never a passenger unit rate or an unrelated round-trip amount.
- Manual returns, independently priced reverse legs (including different pricing modes), multiplier fallback and strict currency consistency are supported by the server engine.
- Debounced quote requests are aborted on change; request-key gating immediately removes old amounts during render. Cancelled responses cannot overwrite a newer selection even if fetch ignores abort.
- Loading, empty fleet, location/fleet errors, unavailable pricing, retry and Price on Request states are explicit. Custom addresses remain available for manual enquiries.
- Request submission revalidates the published vehicle, capacity and pricing inside the transaction that writes the snapshot. Client prices are not accepted as authoritative input.
- The customer form synchronously guards duplicate clicks and disables inputs during submission. This is not durable server-side exactly-once idempotency across independent requests/tabs; existing rate limits still apply. No online payment is created by this flow.
- Edits explicitly warn about repricing. No-op edits preserve saved prices; relevant changes reprice under the same transaction. Historical requests are not recalculated on read.
- A shared EN/ES/IT summary renders unit/range/passengers, applicable return provenance and authoritative saved/final total in the form, receipt, account and admin details. Legacy nullable/malformed metadata is handled without inventing pricing information.
- Trip selection uses labelled radio semantics, roving focus and arrow/Home/End support. Responsive styles preserve the existing design; Arabic stays disabled.

## Backend/admin audit and fixes

- Parent configuration owns currency/mode; tiers retain safe transactional overlap/capacity checks. Tier/configuration writes lock the vehicle then parent configuration before validating/writing. Unique constraints alone are not used as overlap protection.
- Request edits/cancellation/status/assignment lock and recheck the current request. Capacity changes also protect confirmed assigned requests, not only pricing tiers.
- Public fleet endpoints hide unpublished vehicles; privileged staff retain access.
- Invalid JSON, arrays, unknown mutation fields, malformed references, invalid booleans and ambiguous capacity are rejected. Owner/permission and same-origin checks remain in place.
- Expected business errors return safe messages; unexpected Rent Cars errors do not expose Prisma SQL, paths or internal error text. Quote responses are private/no-store.
- Existing Locations/Routes tabs and Phase 3 tier UI remain in place. Currency/mode changes require explicit acknowledgement and stale configuration checks.
- No runtime `dailyPrice` usages remain in the reviewed Rent Cars code. Remaining `routeId_carSlug` selectors belong to the NEW parent `carRoutePricing` model; no tier uniqueness assumption was retained.
- Vehicle deletion continues the pre-existing history-preserving behavior: request vehicle strings/snapshots are retained. It is not a request deletion.

## Database/Prisma evidence

- Prisma validate passed.
- Migration status: 43 migrations, database up to date; local `127.0.0.1:3306/star_pyramids` only.
- Read-only migrate diff: **No difference detected**.
- Read-only preflight: 4 cars, 0 routes, 0 price tiers, 1 request; no incompatible capacities. Legacy-field hashes match the pre-implementation baseline:
  - cars: `166ea9ab0e8b770da15b8422c5b83b01f98c096809da4d2a6e0c8aedb9703d4f`
  - routes/prices: `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`
  - requests: `14215bd635453d7fc2521533c3be729f41044339e5ccc762fe7b2e4967df56ce`
- This phase adds no migration. See `RENT_CAR_DUAL_PRICING_PHASE1.md` for reviewed SQL and Phase 1 constraints/backfill.
- Previously identified default Prisma DLL lock: Next.js Node process PID 22840, port 3100. It was not stopped and no generated binary was deleted. Current schema successfully generated Prisma 6.19.3 into `node_modules/.cache/rent-cars-verification-client` using a temporary schema with only generator output changed. Temporary text schema removed afterward. Default-output generation remains subject to that running process's DLL lock.
- Production compilation is run directly with `pnpm exec next build --webpack`, separating Next validation from replacement of the locked default Prisma DLL. This is not a claim that the combined `pnpm build` generation prerequisite is unlocked.

## CMS test discrepancy

The old test asserted 18 CMS heroes. The authoritative registry contains 15 showcase heroes + 4 editorial heroes + Homepage = 20; editorial editors and public consumers exist. The test now compares the actual authoritative ID set and checks uniqueness, rather than blindly increasing a count. No CMS production implementation was changed.

## Automated verification

- TypeScript: passed.
- Rent Cars focused suite: 8 files, **135 tests passed**.
- Full unit suite: 24 files, **263 tests passed**.
- Full safe automated suite: 113 files, **1459 tests passed**.
- Tests cover tier/mode/round-trip/currency validation, transactional behavior with mocked repositories, snapshots, authorization, malformed input, stale responses, pricing summaries and actual form server-rendering/accessibility contracts.
- `git diff --check`: passed (only Git LF/CRLF conversion notices).
- Production build: `pnpm exec next build --webpack` passed, exit 0; **282/282 pages** generated, TypeScript and build traces completed.

## Changed files (cumulative Phase 1/3/4 implementation)

Routes and pages:

- `app/admin/rent-cars/page.tsx`
- `app/admin/car-requests/[id]/content.tsx`
- `app/api/admin/rent-car/configurations/route.ts`
- `app/api/admin/rent-car/locations/route.ts`
- `app/api/admin/rent-car/locations/[slug]/route.ts`
- `app/api/admin/rent-car/routes/route.ts`
- `app/api/admin/rent-car/routes/[id]/route.ts`
- `app/api/admin/rent-car/prices/route.ts`
- `app/api/admin/rent-car/prices/[id]/route.ts`
- `app/api/admin/car-requests/[ref]/route.ts`
- `app/api/account/car-requests/[ref]/route.ts`
- `app/api/car-requests/route.ts`
- `app/api/rent-car/quote/route.ts`
- `app/api/cars/route.ts`
- `app/api/cars/[slug]/route.ts`

Components and libraries:

- `components/admin/car-pricing-manager.tsx` and `.css`
- `components/car-quote-summary.tsx` and `.css`
- `components/extended-pages.tsx`
- `components/account-portal.tsx`
- `lib/car-pricing.ts`
- `lib/car-pricing-admin.ts`
- `lib/car-quote-client.ts`
- `lib/car-request.ts`
- `lib/rent-car-errors.ts`
- `lib/use-car-locale.ts`
- `lib/server/car-pricing.ts`
- `lib/server/car-requests.ts`
- `lib/server/rent-car-errors.ts`
- `lib/server/db.ts`

Schema, scripts, tests and documentation:

- `prisma/schema.prisma`
- `prisma/migrations/20261027170000_car_passenger_pricing/migration.sql`
- `scripts/car-pricing-preflight.cjs`
- `tests/car-pricing.test.ts`
- `tests/car-pricing-admin.test.ts`
- `tests/car-pricing-admin-render.test.ts`
- `tests/car-pricing-migration.test.ts`
- `tests/car-request-integrity.test.ts`
- `tests/car-quote-client.test.ts`
- `tests/car-quote-summary.test.ts`
- `tests/car-request-form.test.ts`
- `tests/showcase-heroes.test.ts` (proven stale-test correction only)
- `RENT_CAR_DUAL_PRICING_PHASE1.md`
- `RENT_CAR_DUAL_PRICING_PHASE3.md`
- `RENT_CAR_FINAL_VERIFICATION.md`

Unrelated existing untracked diagnostics, backups and scratch files were preserved.

## Acceptance boundary and manual checklist

Code review and automated tests passed as above. No visual/browser behavior was verified. No new pricing business rows were created; therefore populated real-database lifecycle and real competing pricing writes have not been exercised end-to-end. Mocked locking/atomicity tests do not replace that acceptance check.

User manual checks, using intentional demo content:

1. In Admin, create directional routes and a vehicle-route configuration; test both modes, adjacent ranges, gaps, overlap rejection, activation and shared currency/mode changes.
2. Request with 1/2/3 passengers and tier boundaries; compare unit, passengers and total in EN/ES/IT on desktop/mobile.
3. Test one-way, manual round-trip, reverse tier using a different mode, multiplier fallback, inactive/missing pricing and mismatched reverse currency.
4. Change inputs rapidly; verify old totals disappear and slow older replies never replace the current selection. Test loading/retry and unpublished/over-capacity vehicles.
5. Submit once, inspect identical saved totals in receipt/account/admin, change pricing, confirm old snapshots remain unchanged; edit a relevant request field and verify explicit repricing.
6. Test ownership/permission rejection, cancellation/status changes, assignment and capacity reduction for confirmed requests.
7. Check keyboard navigation, dialog focus, labels, overflow and actual mobile/tablet layout. No browser acceptance is claimed by this report.

No production readiness/deployment claim is made before that acceptance testing and a separate authorized release.
