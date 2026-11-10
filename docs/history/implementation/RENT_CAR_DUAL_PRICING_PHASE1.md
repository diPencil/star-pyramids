# Rent Cars: passenger pricing schema and backend compatibility

## Scope and status

Implemented schema plus the approved minimum backend compatibility layer.
Migration `20261027170000_car_passenger_pricing` was reviewed and applied only
to the verified loopback datasource `127.0.0.1:3306/star_pyramids`.
Actual local engine: MariaDB 10.4.32, InnoDB, REPEATABLE-READ.
No production access, reset, seed, environment edits, commit, push or deployment.
Full Admin/Customer UI enhancements remain outside this phase.

## SQL and preservation

Exact SQL: `prisma/migrations/20261027170000_car_passenger_pricing/migration.sql`.

1. Temporary CHECK guard rejects incompatible legacy capacity before persistent DDL.
2. Create `car_route_pricing`: unique vehicle/route, FIXED_TOTAL or PER_PERSON,
   currency, car/route foreign keys.
3. Copy each original price's ID into its parent's ID; preserve original tier ID.
   Existing configurations default to FIXED_TOTAL.
4. Add passenger ranges, backfill 1 through the strictly parsed vehicle capacity.
   No guessing, fallback capacity or clipping of ambiguous values.
5. Add range CHECK, exact-range uniqueness and a composite currency FK.
   Remove obsolete one-price-per-pair unique index only after its replacement exists.
6. Add nullable LONGTEXT `quotePricingMetadata` to requests. No historical rewrite.

All original price amounts, currency, status, timestamps and round-trip settings
are retained. Existing car/route foreign keys are preserved. Currency is owned by
the parent and enforced on tiers by `(routeId, carSlug, currency)` foreign key;
the tier currency field remains for existing API consumers.

Before/after full legacy-column SHA256 checks matched for:

| Table | Before | After |
| --- | ---: | ---: |
| cars | 4 | 4 |
| car_routes | 0 | 0 |
| car_route_prices | 0 | 0 |
| car_requests | 1 | 1 |

No price records existed, so populated-data backfill was not exercised against
the business database. SQL parsing was checked with synthetic SELECT values;
legacy IDs/amounts and snapshot behavior are covered by isolated fixtures.
All historical metadata remains NULL. Migration status: 43 applied.
Read-only Prisma schema comparison before and after: empty (no drift).

## Locking and integrity

Every price create/update/delete uses an interactive Prisma transaction:

1. Lock the vehicle row with SELECT FOR UPDATE (also serializes first-parent creation).
2. Create/find the unique vehicle-route parent, then lock its ID FOR UPDATE.
3. Read all sibling tiers and reject inclusive overlaps, including disabled tiers.
4. Validate integer boundaries and parsed capacity; validate money limits.
5. Write or delete within the same transaction; failures roll back.

Vehicle edits lock the same vehicle row and reject ambiguous/reduced capacities
that invalidate any existing tier, including disabled tiers. Publication cannot
bypass pricing/capacity validation.

SQL range constraints and exact-range uniqueness do NOT alone prevent overlap.
The parent transaction protocol is mandatory for writers. Direct DBA SQL that
bypasses the backend is not an approved tier-writing path.

Concurrent overlap rejection is tested using serialized in-memory transactions.
A real two-connection SELECT FOR UPDATE probe on an existing vehicle confirmed
blocking until release, without business writes. Real concurrent parent/tier
inserts were not exercised: no parent rows exist and no test data was inserted.

## Monetary semantics and API compatibility

- FIXED_TOTAL: configured tier amount is the entire vehicle price.
- PER_PERSON: configured tier amount times passenger count, using integer cents.
- MANUAL return: configured round-trip tier amount uses the same mode.
- AUTOMATIC: calculate outbound and matching reverse tier independently; sum totals.
- Missing reverse tier: apply multiplier to computed outbound total; half-up rounding.
- Different reverse currency: round-trip Price on Request; never sum currencies.
- Missing/disabled/uncovered outbound tier: Price on Request.
- Invalid/over-capacity public quote: validation error; inquiry-first request
  submission can still proceed, but receives no unsafe monetary snapshot.
- Quotes use a consistent transaction snapshot and never accept client amounts.
- Oversized computed totals/configurations are rejected, not truncated.

Existing `oneWayCents`, `roundTripCents`, `amount`, `currency`, `roundTripMode`,
and `roundTripBasis` response fields remain computed vehicle totals.
`pricingMetadata` is additive and captures version, passengers, outbound tier
bounds/ID/unit/mode/currency and return-leg or multiplier provenance.
Requests store this separately as immutable snapshot text, returned in account
and staff projections. Reading a request never recalculates its saved quote.
An intentional eligible customer edit continues to re-quote, as before.

Existing price APIs retain their routes, auth/permissions and same-origin checks.
POST additionally accepts `pricingMode`, `minPassengers`, `maxPassengers`.
Legacy POST without ranges creates a full-capacity tier. Missing mode inherits
an existing parent or defaults a new parent to FIXED_TOTAL. Existing incompatible
mode/currency is rejected; PER_PERSON never becomes FIXED_TOTAL implicitly.
PATCH can edit ranges and, for a single-tier parent, explicitly change mode/currency.
Mode/currency changes through one tier of a multi-tier configuration are rejected
to avoid silently changing its siblings. Dedicated group-level editing is future UI work.
DELETE removes only the tier and preserves its parent configuration.
Admin list responses retain original fields and add ranges/configuration/pricingMode.

The Prisma singleton checks the new delegate so dev hot reload cannot reuse an
old client without `carRoutePricing` after regeneration.

## Changed owners

- `prisma/schema.prisma`, migration SQL: models, constraints, additive metadata.
- `lib/car-pricing.ts`: tier/mode types, integer amount and capacity-range helpers.
- `lib/server/car-pricing.ts`: locking CRUD, validation, quote resolution.
- `lib/server/car-requests.ts`, `lib/car-request.ts`: stored snapshot contracts/projections.
- `lib/server/db.ts`: regenerated-client hot-reload compatibility.
- `app/api/cars/[slug]/route.ts`: transactional capacity-change validation.
- `scripts/car-pricing-preflight.cjs`: loopback-only, read-only checks and hashes.
- `tests/car-pricing.test.ts`, `tests/car-request-integrity.test.ts`:
  updated mocks, tier/mode/currency/lock/snapshot/capacity regression coverage.
- `tests/car-pricing-migration.test.ts`: SQL/schema preservation assertions.

## Validation

- Prisma validate: passed.
- Prisma generate to isolated ignored `.next/car-pricing-validation-client`: passed.
- Normal in-place generate: EPERM replacing `query_engine-windows.dll.node`.
  No processes were stopped and no permissions were changed. Updated application
  client delegates work with the existing same-version engine; verified by reads
  and production build. Standard `pnpm build` remains subject to this generate step.
- Pricing/request/migration/booking regression subset: 105 passed.
- Full safe suite: 1422 passed, 1 failed (108 files).
  Unrelated unchanged `tests/showcase-heroes.test.ts:26` expects 18 CMS heroes,
  while unchanged `lib/hero-catalogue.ts` contains 20. Not modified here.
- TypeScript: passed.
- Next production build (`pnpm exec next build --webpack`): 281/281 pages passed.
- `git diff --check`: passed.
- No authenticated browser CRUD or populated real-database pricing lifecycle test.

## Rollback and deployment cautions

MySQL/MariaDB DDL is not generally transactional. Review SQL and preflight before
any future deployment; take an approved backup first and ensure writers are paused
through application/schema transition. Production engine/version has not been verified.
CHECK enforcement requires a supporting MySQL/MariaDB version.

Do not roll back to the old application after enabling multiple tiers/PER_PERSON:
its unique lookup and fixed-total arithmetic are incompatible. Prefer a forward
fix or a rollback release that understands this schema and keeps existing rows.
Do not drop new tables/metadata or collapse tiers to manufacture old compatibility.

## Remaining UI work

Admin: explicit grouped mode/currency controls, repeatable tier/range forms and
mode-aware amount labels. Existing CRUD remains usable, but is not a redesigned
tier-management experience. Multi-tier mode/currency switching needs explicit
group-level confirmation/endpoint design, not an implicit sibling update.
Customer: render per-person breakdown/provenance; existing quote total remains
correct and refreshes with passenger count. Mobile/browser QA and EN/ES/IT labels
remain for the later UI phases. No Arabic enablement was introduced.
