# Admin booking and customer counts

## Confirmed causes and changes

- The registered customer directory selects CUSTOMER-role User records. An old
  booking with `userId = null` is not a registered account and was invisible in
  that directory. No live database inspection was performed for this change.
- Customers now has a separate **Guest booking contacts** table projected from
  those existing bookings. Each row represents a booking contact snapshot, not
  a unique verified person. It includes contact details, booking reference, trip
  count, original-currency total, status and a booking-detail action.
- Guest contact reads require both `customers.view` and `bookings.view`. The API
  returns an explicit capability for the UI, including permission-bypass roles,
  and `Cache-Control: no-store`. No password, token or private access link is
  selected. Guest rows have no account editing or activation actions.
- No legacy account is created, activated, or linked. Matching emails do not
  confer identity or account access. Existing consent, enrollment and verified
  booking-linking flows are unchanged.
- The booking table previously displayed `lines[0].title`. It now displays all
  titles, searches them all, and has a sortable **Trips** column.
- Customer account directory and profile booking history also have **Trips**
  columns. Counts follow actual `userId` relationships and booking items.
- Dashboard **Trips Sold** is relabeled **Booked trips**: the existing analytics
  counts selections in non-cancelled bookings, including Pending requests. It
  is not a confirmed-sale or unique-booking count. Analytics queries are intact.
- Customer-directory Bookings includes linked account bookings and permitted
  guest booking rows. Account counts and confirmed-account metrics remain
  explicitly scoped to accounts, avoiding fictitious registered customers.

## Example semantics

One booking containing two tour selections, each for two adults, means:

| Metric | Value |
| --- | --- |
| Booking requests | 1 |
| Booked trip selections | 2 |
| Traveler participations across selections | 4 |

The participation count cannot establish four distinct people: the same two
people might attend both tours. No traveler-count or pricing behavior changed.
Directory trip counts cover their booking history, including cancelled records;
dashboard Booked trips retains its non-cancelled and date-range filters.

## Owning files

- `app/admin/bookings/page.tsx`
- `app/admin/customers/page.tsx`
- `app/admin/customers/[key]/content.tsx`
- `app/admin/dashboard/page.tsx`
- `app/api/admin/customers/route.ts`
- `lib/admin-booking-row.ts` (new projection helper)
- `lib/admin-customers-client.ts`
- `lib/server/customers.ts`
- `tests/admin-booking-crm-counts.test.ts` (new)
- `tests/admin-customer-trip-tables.test.ts` (new)
- This document.

## Verification

- 384 tests passed across 30 focused admin, booking, pricing, account enrollment,
  recovery, email, catalogue and SEO suites using Vitest with mocked persistence
  and providers.
- New tests verify 1 booking / 2 trips, guest visibility with zero accounts,
  actual linked-account aggregation, same-email guest separation, permission
  denial, explicit capability handling, and SSR table/profile rendering.
- TypeScript: `node node_modules/typescript/bin/tsc --noEmit --incremental false`
  passed.
- Next compile-only verification:
  `node node_modules/next/dist/bin/next build --webpack --experimental-build-mode compile`
  passed. This is compilation, not a complete prerender/deployment verification.
- No browser automation, real database test, account backfill, live booking,
  real email, migration, commit, push or deployment was performed for this fix.

## Manual release verification still required

Check an authorized admin session with an existing unlinked guest booking and
with a linked customer booking containing multiple selections. Verify both
titles, counts, search, sort, pagination and horizontal table scrolling on mobile.
Check a role without `bookings.view` sees no guest contacts. Verify a subsequent
legitimate verified link moves the booking out of the guest projection on
refresh, without creating a second booking. Check dashboard date filters and
Pending versus Confirmed labels. Browser testing remains prohibited in this task.

Local source changes require a separately authorized release to affect the live
site. Rollback is code-only; no schema or stored data changed.
