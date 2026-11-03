# Booking and cart safety review — 2026-11-03

Local implementation only. No database connection, database writes, migration, actual booking, SMTP delivery, browser automation, commit, push or deployment was performed. Existing unrelated working-tree changes were preserved.

## Problems and repairs

| Problem | Resulting behavior |
| --- | --- |
| Cart/checkout used the static bootstrap catalogue, classifying real database-only tours as removed. | Both pages and the account cart metric use the existing published catalogue API, with loading/error/retry states. Canonical slugs and aliases resolve; real Draft/deleted tours remain unavailable. Saved money is ignored. |
| Unpriced extras were selectable but rejected by authoritative checkout. | A genuinely unpriced catalogue extra becomes an explicitly unconfirmed request in existing booking notes. It is excluded from purchased add-on snapshots and the monetary total. Priced extras retain the existing once-per-line calculation. No quote/pricing-pending architecture was added. |
| Removed extras could be mistaken for unpriced requests. | Unknown titles block checkout. An explicit action removes only those extras and preserves the rest of the selection. Duplicate extras are counted once. |
| Individual traveler counters permitted a combined total exceeding the API limit. | Both detail widgets stop at 60 travelers combined and 50 of each type. Adults remain at least one. Existing over-limit carts show a correction link and cannot submit. The server rejects fractional, negative or incorrectly typed supplied counts instead of defaulting them to zero. |
| Client money estimates and original-price savings could disagree with server unit-cent rounding. | Shared strict cent validation; client and server independently derive totals from canonical rates and integer unit cents. Negative/non-finite/out-of-storage-range amounts fail closed. Invalid preferred-date types and malformed extras also fail validation. |
| Duplicate add-on names could select the wrong catalogue price. | Ambiguous selected titles fail closed until staff give them unique names. No price is guessed. |
| Alias and canonical URLs could represent the same configuration as two separate cart lines. | The cart flags the duplicate for explicit removal; the backend rejects duplicate canonical configurations without creating a booking. |
| Add-on delimiters/order could collide or produce duplicate cart configurations. | JSON tuple keys use unique sorted titles. Existing stored lines are normalized on read; booking IDs/references are not changed. |
| One key was reused for changed requests; returning to an unresolved request could create a duplicate with a new key. | SHA-256 fingerprints bind selections, normalized contact details and notes to CSPRNG request keys. Up to 20 unresolved intents retain their own retry keys; returning to an earlier intent reuses its key. Only fingerprints/keys are stored, not raw contact data. Legacy keys are bound once on upgrade. No unresolved attempt is silently evicted. |
| Account replays could return an unrelated old booking under the same key. | Existing server replay equality checks now apply to account and guest requests. Different ownership, contact, selections or authoritative financial snapshots are rejected. Identical replays do not create another booking or return a guest credential. |
| Double-clicks could race a React state update. | A synchronous ref prevents overlapping checkout submissions before the asynchronous work starts. |
| Successful submission cleared the entire current cart. | Only the submitted configuration keys are removed; fresh storage is consulted so new selections added while a request is pending remain in the cart. In-memory fallback remains available if storage is denied. |
| Missing/malformed responses could clear selections or display an unsafe link. | Reference/total are checked; private links must match the local opaque-token route. Failed/malformed responses preserve selections and retry identity. Server-returned account ownership avoids an unnecessary failure-prone follow-up account read. |
| A committed booking could appear failed when token generation, notifications or final rate bookkeeping failed. | A valid committed receipt survives these secondary failures. A guest never receives an account-only fallback URL. Existing best-effort email behavior remains; delivery is not claimed as guaranteed. |
| A guest retry deliberately has no new browser credential and lacked a recovery action. | Checkout offers email-only recovery after a guest receipt without its original private URL. The endpoint validates same origin, bounded JSON, reference/email and the existing rate limit. Its public response does not disclose booking data, matching identity, email delivery or tokens. Only the saved guest email can receive a link; account bookings are excluded. |
| Recovery requests could race, spam email or revoke a usable link when mail failed. | A short transaction locks the booking row and checks a one-minute token cooldown. Only hashes are stored. Mail runs outside the transaction with an idempotent delivery key. After SMTP acceptance, older tokens are revoked; on delivery failure only the new token is revoked. Raw credentials never appear in the API response or delivery log data. |
| Unbounded public JSON and generic/localization failures obscured errors. | Streaming body limits are applied before JSON parsing (128 KiB checkout, 2 KiB recovery). Added actionable EN/ES/IT feedback; unknown errors use safe localized fallbacks. Notes plus auto-generated requests are checked against the existing 1,000-character limit without truncation. |

## Unchanged contracts and operational limits

- No schema, connection, existing tour/booking, payment lifecycle, booking status, availability architecture or page layout was changed.
- Date Pricing is not a trip availability gate. Its travel-period rows are informational; the existing traveler pricing engine remains authoritative (including its legacy child-rate fallback). Preferred dates do not guarantee capacity. This work does not implement seasonal-date selection or real-time inventory.
- Public catalogue data may be briefly cached. The server reloads publication and current rates before creating a booking. A tour unpublished after adding it to the cart remains blocked.
- If authoritative prices or the original request change between a committed request and replay, existing snapshot equality fails closed. Staff assistance is preferable to silently issuing another booking. Clearing browser storage or using a different browser cannot preserve a lost client-side attempt key.
- Recovery uses the existing SMTP configuration and booking-attempt budget. SMTP acceptance is not proof of inbox delivery. A recovery request during the one-minute cooldown does not enqueue a later email; wait and retry or contact staff.
- Notes preserve requested extras as operational text, not guaranteed services. Long combinations must be reduced explicitly. There is no silent truncation or invented add-on price.
- Local storage is best-effort browser state, not a transactional reservation system. Database request-key uniqueness remains the final duplicate protection for identical keys.

## Files in this repair series

Runtime:

- `app/api/bookings/route.ts`
- `app/api/bookings/request-access/route.ts`
- `components/account-portal.tsx`
- `components/cart-page.tsx`
- `components/checkout-page.tsx`
- `components/cart-catalogue-status.tsx`
- `components/cart-line-issues.tsx`
- `components/day-tour-detail.tsx`
- `components/tour-detail.tsx`
- `lib/booking.ts`
- `lib/cart.ts`
- `lib/cart-catalogue.ts`
- `lib/booking-selection.ts`
- `lib/checkout-attempt.ts`
- `lib/customer-error-copy.ts`
- `lib/server/bookings.ts`
- `lib/server/booking-recovery.ts`
- `lib/server/email.ts`
- `lib/server/request-json.ts`

Tests added/adjusted:

- `tests/booking-api-security.test.ts`
- `tests/cart-live-catalogue.test.ts`
- `tests/booking-selection-safety.test.ts`
- `tests/booking-recovery-safety.test.ts`
- `tests/booking-recovery-template.test.ts`
- `tests/checkout-attempt-safety.test.ts`
- `tests/checkout-flow-safety.test.ts`

Documentation: this report and `docs/cart-live-catalogue.md` (earlier catalogue repair).

## Verification

- **179 tests passed in 15 focused suites**, including actual cart/checkout static rendering, mocked React submission/retry flows, server selection validation, account/guest replay ownership, payment checkout/accounting regressions, catalogue cache/races, recovery serialization/hash-only persistence, malicious input, private-link rendering and email/SMTP mocks.
- TypeScript: `tsc --noEmit --incremental false` passed (exit 0).
- Next.js compile-only verification passed (exit 0, webpack compilation 10.5 seconds): `next build --webpack --experimental-build-mode compile`. The first sandboxed attempt hit an EPERM writing `.next`; the authorized elevated retry succeeded. Full prerender/generation was intentionally not run because it can query the configured database. This is compile verification, not a deployed or fully generated release build.
- `git diff --check` passed for the edited tracked files. No dependencies were added.
- All exercised persistence, SMTP transports and checkout request handlers were mocked. No production/test database was used. Browser and real keyboard/device behavior remain unverified.

## Before release, on an approved isolated test environment

1. Published database-only tours of all four categories: detail → cart → checkout. Verify empty Date Pricing does not block them; verify Draft and deleted tours do.
2. EN/ES/IT; network loading/failure/retry; canonical alias and edited titles/prices; mixed valid/unavailable carts.
3. Priced, unpriced and deleted extras; duplicates; requested notes in the staff booking view; monetary totals exclude requests. Exercise the 1,000-character limit.
4. Counter limits, old over-limit carts, original-price/discount cents and server rejection of tampered monetary fields.
5. Rapid double-click, dropped response after commit, retry, A → B → A intent changes, simultaneous cart edits, denied session/local storage and account login/session expiry. Confirm only one booking for an identical key.
6. Guest private-link receipt, email-only recovery, saved-address mismatch, account-owned references, rate/cooldown handling, expired/revoked links, SMTP failure and inbox/spam delivery. Do not use real production bookings as test fixtures.
7. Existing payment proof, outstanding balance, cancellation and account/staff permissions. No payment status may change merely because a request, notification or email was sent.

## Release / rollback

Deployment and pushing are not authorized by this task. Review only the listed patches while preserving unrelated dirty files. No migration or data rewrite is required. If a later authorized release needs rollback, revert only this reviewed repair; do not reset the repository or databases. Booking notes and priced add-on snapshots remain readable by the previous schema. Private links already issued continue using the existing hashed-token model. Disabling the new recovery endpoint must not delete existing tokens/bookings.


## Second review — additional fixes (2026-11-03)

This follow-up proved three further failures with red tests before changing the owning implementation:

1. **Email links lacked the public origin.** `sendTemplatedEmail` forwarded `/booking/...` and account/staff paths straight into mail HTML/text. Outgoing booking and payment templates that actually use `detailUrl` now resolve it against the existing trusted `resolveSiteUrl` owner. External origins, protocol-relative paths, credentials, backslashes and control characters fail closed. Browser-relative URLs and pure template preview output remain unchanged. Refund receipts that intentionally contain no detail link still send without one. No SMTP settings or SEO configuration were changed.
2. **Identical request objects could hash differently.** Spreading caller objects preserved insertion order when generating fingerprints. Explicit canonical field order now makes the same selections reuse the same retry key even when their object properties arrive in a different order. The normal checkout field order is preserved for existing pending attempts.
3. **Writable-looking storage could discard in-memory selections.** When storage reads succeeded but writes failed (quota/private restrictions), the next cart action reloaded stale disk data. A pending-write flag now keeps the current tab's unsaved cart authoritative until a later successful persistence. Storage notifications do not erase that unsaved state. Tests cover adding multiple selections, removing only submitted lines, and saving the complete cart when writes recover. This remains best-effort browser storage, not atomic cross-tab persistence; browser reload can still lose data that the browser refused to save.

Follow-up files: `lib/server/email.ts`, `lib/checkout-attempt.ts`, `lib/cart.ts`, `tests/email-delivery.test.ts`, `tests/checkout-attempt-safety.test.ts`, new `tests/cart-storage-resilience.test.ts`, and this report. No UI files, prices, database connection or schema were changed in this follow-up.

Verification: **200 tests passed in 16 focused suites**; TypeScript (`--noEmit --incremental false`) passed. Next.js compile-only webpack verification passed (exit 0, compilation 9.7 seconds); full generation/prerender was not run. All persistence, SMTP and external calls in tests remained mocked. No real bookings, messages, database writes, browser automation, commits, push or deployment occurred.

Before release, still verify actual email delivery and links on an approved isolated environment, plus mobile/desktop cart and checkout behavior. Automated tests do not establish inbox delivery or full production readiness.
