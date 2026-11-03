# Customer profile: admin CRM and customer account review

Date: 2026-11-03. Scope: the six profile datasets on both surfaces. Local source review, mocked persistence/API tests and server-rendered markup tests only. No database connection, record writes, live requests, emails, browser automation, commits or pushes were performed.

## Result and the reported pending account

All six datasets have database-backed services and account-scoped APIs. They are not placeholder tables. The admin customer detail service also reads these datasets by the selected customer's internal database ID.

The screenshot shows a **pending verification account**, not proof that its guest booking has already acquired a `Booking.userId` relationship. Creating a pending account and committing a guest booking are intentionally separate from proving ownership. Account setup must link only the specifically verified booking. An identical email is not sufficient proof. This review did not query the deployed database and cannot establish the actual ownership fields of SP-BK-VP638A or the displayed customer.

Before verification, an authorized administrator can review the guest booking in Bookings or Customers → Guest booking contacts. The account profile correctly lists only account-linked bookings. Normal customer login requires an eligible active account; authenticated staff preview can read the selected pending customer without granting that customer login or booking ownership.

## Six-table trace

| Dataset | Admin profile source | Customer source / route | Ownership and behavior |
| --- | --- | --- | --- |
| Bookings history | `getCustomerDetail` → `booking.findMany({where:{userId}})`; preserved item snapshots, counts and titles | `listCustomerBookings` → `/api/account/bookings` → `BookingsSection`, booking detail | Real account FK. Guest bookings do not appear merely because an email matches. One booking can contain multiple trip selections. |
| Trip requests | `tripRequest.findMany({where:{userId}})` | `listCustomerTripRequests` → `/api/account/trip-requests` → `account-custom-trip.tsx` | Account FK. Guest custom requests remain separate; this checkout account enrollment feature does not claim all guest requests. |
| Car requests | `carRequest.findMany({where:{userId}})` | `listCustomerCarRequests` → `/api/account/car-requests` → `CarRequestsSection` | Account FK. Admin currently displays stored vehicle slug; customer view resolves vehicle labels through the existing catalogue. |
| Event requests | `eventRequest.findMany({where:{userId}})` | `listCustomerEventRequests` → `/api/account/event-requests` → `account-event-requests.tsx` | Account FK; stored event title is available as a fallback. |
| Payments | Payments selected only from owned bookings and only with `payments.view` | `listCustomerPayments` → `/api/account/payments`; `where:{booking:{userId}}` → `PaymentsSection` | Actual payment records, not inferred from booking totals. A saved unpaid booking need not have a payment row. Admin permission denial remains distinct from an empty list. |
| Favorites | `favoriteItem.findMany({where:{userId}})` | `listFavoriteSlugs` → `/api/account/favorites` → account favorites hook and `FavoritesSection` | Saved references owned by the account. Account pages now load directly through the verified account/preview context and never substitute browser-local favorites. |

Admin detail links were checked in SSR tests: `/admin/bookings/{reference}`, `/admin/trip-requests/detail?ref=...`, `/admin/car-requests/{reference}`, `/admin/event-requests/detail?ref=...`, `/admin/payments/{reference}`. Support conversation links retain the existing inbox contract.

The account routes use `getAccountReadUser()`, including a server-verified staff-preview target. Their services do not select users based on a submitted email. Preview writes remain denied by `getAccountWriteUser()`; no authorization logic was weakened.

## Confirmed problems fixed

1. **Wrong favorites source in account/staff preview.** The shared favorites hook first checked `/api/auth/me` for a CUSTOMER role. A staff-only session previewing a customer could fail that eligibility check and display browser-local favorites instead. Account API/network failures also silently fell back to local favorites. Added an explicit account-only mode that calls the owner-scoped favorites endpoint directly, validates its response, deduplicates concurrent fetches and distinguishes failure from an empty success. It does not retain a settled account response cache across new account-only mounts. Guest-local behavior on public pages remains available.
2. **Favorites failure looked like a successful empty state.** Account favorites now display localized EN/ES/IT error text and a Retry action. The account overview also distinguishes loading/error from an empty shortlist. No private server error text is rendered.
3. **Favorites could appear editable during staff preview.** Account mini-tour heart buttons are disabled during preview, loading and load failure. Server-side preview write denial remains the backstop.
4. **Overview silently showed zero bookings when loading failed.** It previously discarded the hook's loading/error state. It now displays an unknown/loading metric and an error/loading message rather than claiming no journey exists.
5. **Misleading booking association copy.** Admin empty history now explicitly says no account-linked bookings and explains that guest bookings remain separate until ownership verification. Customer booking empty-state text explains the booking email verification step in EN/ES/IT instead of promising every guest checkout appears automatically.
6. **Duplicate pending label.** Removed `Pending verification · Pending verification` from the admin profile status display.
7. **Unstyled booking status.** Admin profile passed uppercase database status into a component whose style modifiers use lowercase. Normalized only the display input; no stored status changed.
8. **Incorrect admin favorites description.** The table displays saved references, not live titles/prices. Replaced the false claim with an accurate description. The table's existing layout and saved data remain intact.

## Verification

### Focused and neighboring tests: PASS

207 tests passed in 16 suites:

```text
node node_modules/vitest/vitest.mjs run tests/customer-profile-favorites-hook.test.ts tests/customer-profile-favorites.test.ts tests/customer-profile-api-boundaries.test.ts tests/customer-profile-data-scope.test.ts tests/admin-customer-trip-tables.test.ts tests/admin-booking-crm-counts.test.ts tests/staff-preview-access.test.ts tests/staff-preview-security.test.ts tests/account-copy-and-image-loading.test.ts tests/auth-account-security.test.ts tests/car-request-integrity.test.ts tests/checkout-account-security.test.ts tests/checkout-account-route.test.ts tests/guest-booking-access.test.ts tests/booking-account-ui.test.ts tests/payments/offline-ui-regression.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

The four new profile suites cover six API identity/unauthorized boundaries, six real service query predicates for two customer identities, populated admin service projections, restricted payment selection, pending account non-claiming, strict favorites loading/retry/network/malformed responses, concurrent fetch coalescing and the actual hook state transitions. Existing admin SSR tests were extended for all six populated tables, detail links and the pending empty state.

These are **mock-tested query contracts and rendered markup**, not proof that a real MySQL foreign key is present for the screenshot's booking. The service predicate tests use empty mocked lists for customer list serializers; they do not replace live populated serializer/end-to-end tests.

### Broader localization run: two existing failures

The 17-suite run including `tests/customer-localization.test.ts` produced **227 passed / 2 failed**. Its two failures concern unchanged Checkout files:

- The test requires every English error-map value to equal its lookup key; the existing `Invalid price confirmation...` key intentionally has different human-readable English copy.
- The test expects the exact old Checkout source string `customerErrorText(locale, data.error, sendFailed)`.

`lib/customer-error-copy.ts`, `components/checkout-page.tsx` and `tests/customer-localization.test.ts` are unchanged from HEAD. The existing differing error copy was also confirmed in the HEAD Git object. These failures were not hidden by altering their assertions or rewriting Checkout during a profile task. A full release verification is therefore not green.

Initial sandboxed Vitest execution failed to read its own temporary transform files; the same focused tests passed outside that filesystem isolation. Vitest also reports the existing native-config-loader warning. TypeScript passed without incremental output.

### Compile verification

**PASS**, exit code 0: `node node_modules/next/dist/bin/next build --webpack --experimental-build-mode compile`. Webpack compiled successfully in 40 seconds and completed page-data collection and build traces in compile mode. Initial sandbox run hit EPERM creating `.next/server/app/api/account`; the same compile-only command passed outside isolation. This is not a full prerender/production deployment test.

## Remaining limits and deployment checks

- No deployed database, session cookie, SMTP delivery or real browser flow was tested. Do not describe this as live verification or guaranteed 100% production readiness.
- Favorites in admin intentionally show stored slugs. Customer cards depend on the public catalogue; unpublished/deleted/legacy alias references may not resolve to a visible card. No tour was published or historical favorite rewritten in this task.
- Anonymous trip/car/event requests are not automatically claimed by a later matching-email account. Their dedicated ownership/recovery contracts would need a separate product decision before expanding enrollment beyond checkout bookings.
- The six detail lists are not currently all paginated in the admin profile; this review preserves their existing layout. Large-history performance was not load-tested.
- Two unchanged localization tests remain a release-check blocker and need separate reconciliation with current Checkout behavior.

## Manual end-to-end checklist (not executed)

Use an explicitly authorized isolated database and test mail provider before creating test records:

1. Customer A: create one multi-trip booking, one custom trip request, one car request, one event request, one actual test payment and one favorite. Verify all six appear in A's admin detail and A's customer account, with correct references and counts.
2. Customer B: confirm none of A's rows appear. Direct detail URLs for A must fail safely for B.
3. Guest checkout with consent: booking remains a guest request, pending customer appears in CRM, profile explains no linked booking. Find the original guest booking under guest contacts without claiming by email.
4. Consume the specific verification link; verify only that booking becomes owned and appears in both profiles. Other same-email guest bookings stay separate. Expired/replayed links fail.
5. Staff preview A: all six datasets belong to A, especially Favorites; preview heart buttons and all server-side writes remain disabled. Exit preview and verify normal staff context is restored.
6. Deny `payments.view`: admin cannot see payment rows and sees an explicit restricted state.
7. Simulate API/network failure: bookings/favorites distinguish failure from empty data; favorites retry restores the account set. Guest-local favorites never replace account favorites.
8. Repeat EN/ES/IT on desktop/mobile; check loading/error/empty text, long titles, scroll, filters, links, pagination and profile-completion messaging.

## Changed files and release/rollback

Source:

- `app/admin/customers/[key]/content.tsx`
- `components/account-portal.tsx`
- `lib/customer-account.ts`

Tests:

- `tests/admin-customer-trip-tables.test.ts`
- `tests/customer-profile-api-boundaries.test.ts` (new)
- `tests/customer-profile-data-scope.test.ts` (new)
- `tests/customer-profile-favorites.test.ts` (new)
- `tests/customer-profile-favorites-hook.test.ts` (new)

Documentation: `docs/customer-profile-dual-surface-review.md` (new).

No dependency, schema, migration, connection or environment changes. Preserve the four new tests and this report when preparing a separately approved release. Rollback is a code-only reversal of this task's patch; no database rollback is required. Do not discard unrelated untracked files. Nothing was staged, committed, pushed or deployed.
