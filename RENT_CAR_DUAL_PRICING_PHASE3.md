# Rent Cars dual pricing: Phase 3 Admin management

## Scope

Implemented the Pricing tab at `/admin/rent-cars`. Locations, Routes, sidebar,
public request pages, stored business records and Phase 1 migrations are preserved.
No Phase 4 customer UI changes, database writes, commits, pushes or deployment.

## Changed files in this phase

- `app/admin/rent-cars/page.tsx`: uses the new manager; old price-only editor removed;
  list loading runs in an effect instead of render-time useMemo; active tier count.
- `components/admin/car-pricing-manager.tsx`: filters, tier table, configuration and
  tier dialogs, localized EN/ES/IT copy, permission-aware actions, loading/error/retry states.
- `components/admin/car-pricing-manager.css`: scoped responsive form and table styling.
- `lib/car-pricing-admin.ts`: typed DTOs, pure form validation, exact decimal payloads.
- `lib/car-pricing.ts`: existing side-effect-free money/range helpers made client-shareable
  by removing the server-only marker. Server repositories remain server-only.
- `lib/server/car-pricing.ts`: configuration list/update operations and optional stale
  mode/currency checks on tier edits; existing tier APIs/calculation engine retained.
- `app/api/admin/rent-car/configurations/route.ts`: minimal authenticated GET/PATCH API.
- `tests/car-pricing.test.ts`: configuration API/RBAC/CSRF/atomicity/stale/overflow tests.
- `tests/car-pricing-admin.test.ts`: validation, payload and integration contracts.
- `tests/car-pricing-admin-render.test.ts`: real dialog SSR rendering and computed examples.

Other dirty Phase 1 files and unrelated untracked artifacts were left intact.

## UI behavior

- Select/filter vehicle and route; show capacities and inactive/hidden resource labels.
- Create multiple tiers individually, edit bounds/amounts, enable/disable or delete.
- Shared mode/currency cannot accidentally be edited as tier-specific fields.
- Group settings can change mode/currency for all tiers atomically, including empty
  configurations left after deleting the last tier. Explicit acknowledgement explains
  that numeric values are not converted and existing request snapshots do not change.
- Tables show route, vehicle, passenger bounds, mode, currency, one-way amount,
  manual return amount or automatic multiplier, status and permitted actions.
- Fixed-total and per-passenger field labels/examples use exact cents, not floats.
- Manual return fields retain the group's monetary semantics. Automatic copy explains
  independently priced reverse legs, multiplier fallback and currency mismatch.
- Client validation blocks incomplete/invalid ranges, disabled-tier overlaps,
  capacity violations, malformed money, invalid multipliers and oversized totals.
  Backend validation errors remain visible; backend is always authoritative.
- Existing SharedSelect, AdminConfirmDialog, table/sort/pagination components,
  icon actions and toaster are reused. Scoped forms collapse to one column on mobile;
  the dense table scrolls in the existing table wrapper. No Arabic activation.

## Backend/API additions

GET `/api/admin/rent-car/configurations`: `{ configurations: [...] }`, including
parents with no tiers; requires `cars.edit`.

PATCH same route accepts `{ id, pricingMode, currency, previousMode,
previousCurrency, acknowledge: true }`. Requires `cars.edit` and same-origin CSRF.
Locks vehicle then parent, checks stale mode/currency, validates every tier under
the new semantics, updates the parent and cascades its currency within one transaction.
Does not modify tier numeric amounts or historical request snapshots.

Existing POST/PATCH/DELETE `/api/admin/rent-car/prices[/id]` remain the tier writers,
with `cars.create`, `cars.edit`, `cars.delete` respectively. Tier PATCH also accepts
optional `expectedPricingMode`/`expectedCurrency` so an open editor cannot save
amounts under a concurrently changed group's semantics. Existing callers remain compatible.

No new migration, schema modification or business-record mutation in this phase.
Read-only preservation checks still match Phase 1 hashes: 4 cars, 0 routes,
0 price tiers and 1 request.

## Verification

- TypeScript: passed.
- Focused pricing/form/render/API/request tests: 115 passed across 6 files.
- `pnpm test:unit`: 263 passed across 24 files.
- `pnpm test`: 1432 passed, 1 unrelated failure, across 110 files.
- `pnpm exec next build --webpack`: passed, 282/282 pages.
- `git diff --check`: passed.

The full-suite failure is the unchanged hard-coded expectation in
`tests/showcase-heroes.test.ts:26`: expects 18 CMS-managed catalogue entries,
whereas the unchanged `lib/hero-catalogue.ts` now supplies 20. It is unrelated to
pricing and was not modified to mask the failure.

## Prisma EPERM investigation

Normal `prisma generate` still fails renaming its temporary engine over
`node_modules/.pnpm/@prisma+client@6.19.3_prism_55d0204f4ec95a4bf17102444b6df5de/node_modules/.prisma/client/query_engine-windows.dll.node`.

Windows Restart Manager identified the holder: Node.js PID 22840, a Next.js
server listening on port 3100, at the time of inspection. No processes were
terminated, permissions changed, or generated files removed. No workaround was
applied to the shared server. To rerun standard generate/build, the user must first
stop that server normally, then run `pnpm exec prisma generate` and `pnpm build`.
The direct Next build validates this phase with the existing compatible engine;
it does not imply the ordinary generate prerequisite succeeded.

## Browser QA: verified versus unverified

Verified: actual React editor output in isolated SSR tests (fixed/per-person
labels, 3 x USD 10.25 = USD 30.75, shared settings lock, unsavable incomplete form),
pure client validation, backend/API behavior using in-memory transactions.

Browser attempt: opened `http://localhost:3100/admin/rent-cars` in the in-app browser;
it redirected to `/login?next=%2Fadmin%2Frent-cars` and displayed Internal Server Error.
The existing native Chrome window was minimized and could not be observed through
the available target. No credentials were entered and no existing records were edited.

Unverified: authenticated live CRUD, actual desktop/mobile visual screenshots,
keyboard/focus behavior and real database configuration/tier writes. These are not
represented as passing browser tests. The local database contains no routes/prices;
no test business records were inserted to manufacture a successful QA result.

Phase 3 implementation stops here. Phase 4 requires separate approval.
