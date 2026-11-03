# Guest CRM visibility and multi-trip booking reporting

## Outcome and evidence boundary

Implemented locally, extending the earlier uncommitted CRM/count fixes. This
report supersedes the behavior summary in `admin-booking-customer-counts.md`.
Source inspection confirms display/query problems; screenshots alone do not
prove database corruption, missing records or duplicate booking creation.
No live database was queried, and no stored records were changed.

### Guest-first visibility follow-up

An owner screenshot after the initial push showed one guest booking counted in
the KPI while the large empty account directory occupied the first viewport.
The guest table was rendered below it. When there are guest contacts but zero
account records, the guest section now renders first. With account records,
the original account-first order remains. The KPI caption puts the guest count
first, and the empty account message says **No registered accounts yet** rather
than implying no CRM contacts exist. No query, identity or account data changed.
The SSR ordering assertion failed before this fix and passed afterward; all
37 relevant CRM/customer/date-range tests and TypeScript passed. Browser and
actual production-record visibility remain unverified.

The reported example is one PENDING booking worth USD 620 containing two tour
items. It is correctly counted as one booking and two requested trip selections.
Two adults in each item mean four traveler participations, potentially the same
two people attending both tours. This does not establish four distinct travelers.

## Root causes and fixes

1. `listCustomers` selects CUSTOMER-role User records and follows their actual
   booking `userId` relationships. A historical unlinked guest booking is not a
   User account, so zero accounts is possible while a guest booking exists.
2. The admin booking table previously projected only `lines[0].title`. It now
   retains one row per booking, exposes a sortable Trips count and shows the
   first title with **+N more**. Native `details`/`summary` reveals every title;
   each title and the existing view action open authorized booking detail.
   Search still covers every title, including collapsed ones.
3. Dashboard `tripsSold` counts BookingItem rows in non-cancelled bookings,
   including Pending requests. UI copy now says **Trips Booked** (or Booked trips
   in supporting displays), and **Confirmed trips** is reported separately.
   The existing API key is retained for compatibility.
4. Customer reporting previously summed booking values without selecting their
   currencies and labeled the result as USD. New reports group stored amounts
   by currency in integer cents. No rates are fabricated. The legacy scalar
   `totalSpent`/`confirmedSpent` fields now contain USD only; current UI uses
   `bookedValue`/`confirmedValue` arrays instead.
5. Requested/confirmed booked value is distinct from collected money. New CRM
   collection summaries use qualifying Payment rows net of refunds, with the
   same status rule as existing analytics. No payment lifecycle calculation,
   stored amount, transition, status or booking price is changed.

## Guest CRM identity and query model

- A Guest CRM row is the contact snapshot for exactly one Booking whose
  `userId` is NULL, keyed by its unique public booking reference. It is not an
  authentication identity, a unique-person count, a User or a new stored entity.
- Two bookings with equal names or emails remain separate guest rows. There is
  insufficient evidence to group historical bookings into a verified person.
- Registered/pending account rows remain keyed by User publicId. Account labels
  distinguish **Registered** from **Pending verification** using persisted status
  and email verification facts. Active/suspended status controls are preserved.
- Customers has separate account and guest sections. Guest rows show contact,
  reference, one-booking scope, all tour titles through disclosure, trip count,
  booked/confirmed value, collected net where permitted, and booking status.
  Account directory and detail also show trip counts and currency-safe values.
- `listCrmDirectory` reads both lists in one Prisma interactive transaction with
  `RepeatableRead`. This is a read-only query composition: no insert, update,
  delete, locking SQL or migration. It requests one consistent snapshot so a
  concurrent verified FK link cannot be counted in both projections within
  that snapshot. Actual MySQL isolation/concurrency must still be integration
  tested; mocks verify query composition and the requested isolation level.
- After a verified link is visible to a refreshed snapshot, the booking no
  longer satisfies `userId: null`; its history belongs only to the owning
  account. Linking other same-email bookings is never inferred.
- One nested Prisma read per list selects counts/items and optionally payments.
  There is no application query inside a loop over contacts. Booking totals
  are aggregated once per booking, independently of item/payment collections.

## Permissions, privacy and historical recovery

The directory still requires `customers.view`. Guest contact reads additionally
require `bookings.view`. Payment records and net collection summaries are queried
only with `payments.view`; otherwise summaries are `null` and UI says Restricted,
including the profile payment-history panel. Missing data is Not available,
distinct from a permitted but empty ledger. Responses use `Cache-Control:
no-store`. No password hash, setup token, guest bearer token or private link is
selected or returned by the new CRM projection.

Historical guests are not retroactively enrolled. An explicit **Email recovery
link** action is exposed to CRM viewers with the additional `bookings.edit`
capability. It uses the existing confirm dialog and existing
`POST /api/bookings/request-access` flow with only reference and stored contact
email. It does not submit account consent or obtain access credentials. The
message says *if eligible*; an accepted request does not prove delivery or email
ownership. The CRM capability controls presentation; the existing public
recovery endpoint retains its own independent security rules.

That existing endpoint checks origin, bounded JSON, reference/email validation
and throttling, then returns the same non-sensitive acknowledgement for missing,
mismatched, already-linked and eligible bookings. Actual access requires the
private email bearer proof. Account enrollment additionally requires the
already-recorded checkout consent; legacy records without it stay unenrolled.
No staff click grants browser access, activates an account, confirms a booking
or changes payment status. No real recovery request or email was sent here.

Public/customer booking access, account setup, signed quotes, idempotent replay,
guest token revocation, staff/suspended restrictions and session handling are
unchanged. Their existing mocked regression suites remain passing.

## Metric and date definitions

| Display | Exact scope | Time basis |
| --- | --- | --- |
| Total Bookings | Booking records, all statuses including cancelled | Booking.createdAt in selected range |
| Trips Booked | BookingItem count where parent is PENDING, CONFIRMED or COMPLETED; excludes CANCELLED | Parent Booking.createdAt in range |
| Confirmed trips | Items whose parent is currently exactly CONFIRMED; excludes pending, cancelled and completed | Parent Booking.createdAt in range |
| Collected Revenue | PAID/PARTIALLY_REFUNDED/REFUNDED Payment amountPaid minus amountRefunded, grouped by currency | Payment.paidAt, falling back to Payment.createdAt if absent |
| Customer accounts | CUSTOMER-role User rows, including pending accounts; guest contact count is separate | All-time directory |
| CRM Bookings / Trips | Actual linked booking records/items plus separately visible guest booking records/items; includes historical cancelled records | All-time history |
| CRM Booked value | Stored booking total once per history record, including cancelled history | All-time, per stored currency |
| CRM Confirmed value | Totals of currently CONFIRMED history records | All-time, per stored currency |
| CRM Collected net | Qualifying payments on the entry's actual bookings, net of refunds | All-time, per Payment currency |

The selected dashboard range uses the existing inclusive UTC calendar start and
exclusive next-day end. It is not a travel-date filter. Collection dates differ
from booking dates intentionally; a newly paid older booking can contribute
revenue without adding a new booking. Existing revenue trend and outstanding
balance panels retain their independently labeled historical/current scopes.

Directory KPIs are explicitly all-time totals. Account and guest table search,
status filters and pagination affect displayed rows, not those headline totals.
Guest rows have a separate booking-status selector; existing account-status
filtering remains intact. Mixed-currency account value sorting groups by currency
and then cents rather than implying a cross-currency converted monetary order.

## Booking detail and customer history

The existing staff booking detail already maps every stored line and renders
its title, preferred date or Open date, adult/child/infant breakdown, stored unit
prices, selected extras, line subtotal and booking grand total. It is preserved.
Customer history keeps every title, native-currency booking total and payment/
booking status, adding a separate item count. Guest history is scoped to its one
booking, accessible through the existing authorized staff booking endpoint/page;
there is no new public guest profile or account-access route.

## Pagination and architecture findings

The actual existing booking/customer list APIs return complete lists; sorting
and pagination are client-side (`useAdminTableSort`, `usePagination`). There was
no server-side pagination contract to preserve. This work preserves those APIs
and controls rather than inventing a claim that server pagination exists.
Per-entry database reads were not added. Large-directory server-side pagination
with separate aggregate queries remains a scalability follow-up, not a schema
requirement for this fix. No new dependency, configuration or schema was needed.

## Verification

**PASS: 405 tests across 33 focused suites**, including all 26 previously used
booking/enrollment/cart/pricing/email/catalogue/SEO suites, the existing customer
conversation/date-range tests, and the five CRM suites below. Persistence,
providers and network calls were mocked. React table tests use server-side
rendering, not a browser or real DOM interaction test.

| Requested regression | Coverage |
| --- | --- |
| Guest visibility without account ownership | `admin-booking-crm-counts`, `admin-customer-trip-tables` |
| One booking / two trips; multiple linked bookings | `admin-booking-crm-counts` |
| Linked booking excluded from guest list; no name/email merge | `admin-booking-crm-counts`; requested read isolation asserted |
| Different identity/permission denial; staff record rejection | `admin-booking-crm-counts`, existing guest/account security suites |
| No item-join multiplication; cents and multi-currency correctness | `admin-crm-money-summary`, `admin-crm-dashboard-metrics` |
| Pending demand versus confirmed trips/collection | `admin-crm-dashboard-metrics` |
| Booking/collection date windows and financial restriction | `admin-crm-dashboard-metrics`, `dashboard-date-range` |
| Pagination total remains 12 while showing 10 rows | `admin-customer-trip-tables` |
| Explicit recovery payload, no consent fabrication, safe errors | `admin-crm-recovery-client`, existing recovery/enrollment suites |
| Existing enrollment, ownership and quote protections | Existing 26 booking/security regression suites |

Focused command (passed):

```powershell
node node_modules/vitest/vitest.mjs run tests/admin-booking-crm-counts.test.ts tests/admin-customer-trip-tables.test.ts tests/admin-crm-money-summary.test.ts tests/admin-crm-recovery-client.test.ts tests/admin-crm-dashboard-metrics.test.ts
```

TypeScript and safe compile commands:

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/next/dist/bin/next build --webpack --experimental-build-mode compile
```

TypeScript passed. Next compile-only verification passed; this excludes full
prerender/generation and is not a deployment or live integration test. Git diff
whitespace checks passed. Vitest emits an existing configuration-loader warning;
no config/dependency was changed to suppress it.

## Remaining verification and release risks

1. No actual database/schema/data preflight was performed. Existing source
   relations/columns support the projection without a migration. Confirm the
   deployed schema and MySQL RepeatableRead behavior in an explicitly approved
   isolated environment, including a link committed between the two list reads.
2. Browser QA is prohibited here. Manually verify disclosure with keyboard and
   touch, customer-status and guest-status filters, search for a collapsed title,
   pagination, mobile horizontal table scrolling, long currency summaries and
   modal focus/close behavior after an authorized release/test phase.
3. Test payment-restricted roles and email recovery against isolated sessions/
   SMTP capture. Verify no account is created for a legacy booking without
   consent, no private credential reaches the CRM response, and verified linking
   removes the guest projection on refresh. Do not use real SMTP/customer data.
4. The dashboard analytics service retains its existing multiple independent
   reads. Concurrent status/payment changes can temporarily yield differing
   metrics; this change does not claim a global analytics transaction snapshot.
5. Admin chrome currently uses English; public and editable content remain
   EN/ES/IT with Arabic disabled. No public locale architecture was changed.
6. Earlier production booking/enrollment release approvals and environment/
   integration prerequisites remain separate. This change authorizes none of
   them. No live database, booking, email, push, commit or deployment occurred.

Release requires the complete source/test manifest below. Rollback is code-only:
there is no new CRM table, backfill or stored data change to reverse. Do not use
rollback as a reason to remove unrelated booking security work.

## Changed-file manifest (including earlier local CRM work)

Tracked modifications:

- `app/admin/bookings/page.tsx`
- `app/admin/customers/page.tsx`
- `app/admin/customers/[key]/content.tsx`
- `app/admin/dashboard/page.tsx`
- `app/api/admin/customers/route.ts`
- `app/api/admin/customers/[publicId]/route.ts`
- `lib/admin-customers-client.ts`
- `lib/analytics.ts`
- `lib/server/analytics.ts`
- `lib/server/customers.ts`

New local files:

- `components/admin/booking-tours-summary.tsx`
- `lib/admin-booking-row.ts`
- `lib/admin-crm-reporting.ts`
- `tests/admin-booking-crm-counts.test.ts`
- `tests/admin-customer-trip-tables.test.ts`
- `tests/admin-crm-money-summary.test.ts`
- `tests/admin-crm-dashboard-metrics.test.ts`
- `tests/admin-crm-recovery-client.test.ts`
- `docs/admin-booking-customer-counts.md` (earlier local report, preserved)
- `docs/admin-guest-crm-multitrip-reporting.md` (this report)

All unrelated pre-existing untracked SQL, source documents, scripts, backups and
debug artifacts were preserved and are not part of this release manifest.
