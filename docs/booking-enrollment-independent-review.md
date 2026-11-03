# Independent booking and account enrollment review

Date: 2026-11-03. Scope: current local working tree, not a deployed production certification.

## Assessment and execution boundary

Five confirmed defects were fixed locally. The focused verification passes **275 tests in 21 suites**, TypeScript passes, and Next.js compile-mode verification passes. The workflow is ready for isolated integration testing, **not unconditional production approval**.

No database was connected to for this review. No records, schema, migrations, connection settings, dependencies, production services or existing tours were changed. No browser automation, deployment, commit or push was performed. Existing unrelated working-tree changes were preserved. Some enrollment files were already untracked/local before this review; their pre-existing implementation must be included in any eventual release alongside these corrections.

The two requested reports were read first: `booking-cart-safety-review.md` and `checkout-account-enrollment.md`. Their claims were then checked against current source and new regression cases. Earlier successful tests were not treated as evidence of real database isolation or SMTP delivery.

## 1. Actual implementation and evidence

| Flow | Current source and behavior | Verification and qualification |
| --- | --- | --- |
| Published tour to cart | `components/day-tour-detail.tsx`, `components/tour-detail.tsx`, `lib/cart.ts`, `lib/cart-catalogue.ts`, `lib/tours-client.ts`: current published catalogue, canonical selections, no static catalogue fallback while loading | Mocked catalogue/loading/storage tests. Shore excursion public CTA remains an enquiry flow; it was not converted into direct checkout. |
| Checkout and signed-in customer | `components/checkout-page.tsx`, `app/api/bookings/route.ts`: untouched fields can receive late account autofill; explicit edits remain; ownership comes from server session CUSTOMER identity | UI/service mocks. Submitted email or user IDs cannot select a different account owner. |
| First guest booking | Booking is committed as guest; explicit consent is required. `prepareCheckoutAccount` creates only a PENDING, passwordless CUSTOMER when appropriate | No pre-verification session or booking ownership. Consent is a server-owned booking activity with timestamp, not a client-supplied ownership flag. |
| Account email proof | `lib/server/checkout-account.ts`, `app/api/bookings/account/route.ts`, `components/booking-account-setup.tsx`, `app/booking-account/page.tsx` | New user sets password after proof, then ACTIVE; only this booking is linked. Existing user password/profile preserved and normal login retained. |
| Recovery | `lib/server/booking-recovery.ts`, `app/api/bookings/recover/route.ts`, `lib/server/booking-access.ts` | Generic recovery acknowledgement, matching reference/email checked internally; private links sent through email, not returned by recovery. Response-body non-enumeration is covered; constant-time delivery is not asserted. |
| Customer dashboard | `components/account-portal.tsx`, account booking APIs, `listCustomerBookings` / `getCustomerBooking` in `lib/server/bookings.ts` | Queries scope to authenticated user ID. Profile-completion reminder exists in EN/ES/IT and does not block the first booking or subscribe to marketing. |
| Staff preview | `lib/server/staff-preview.ts`, auth and signed preview-token helpers | Read preview requires staff role, permission and session-bound signed token; preview mode cannot use account write identity. This is distinct from claiming an account by email. |
| Money and publication | `validateBookingDraft` / `resolveLine`, `lib/server/tours.ts`, `lib/booking-selection.ts`, `lib/booking.ts`, existing pricing engine | Actual tour lookups and server calculation; rejects unpublished/missing tours and client commercial/status overrides. Integer-cent limits and duplicate canonical selections checked. |
| Email and sessions | `lib/server/email.ts`, `lib/server/email-smtp.ts`, `lib/server/session.ts`, `lib/server/auth.ts`, core password/token utilities | Provider/session mocks, no real mail or cookies exercised. Sender failures are not proof that a booking failed. |

### Critical requirement conclusions

| Requirement | Source-level conclusion |
| --- | --- |
| Double click cannot duplicate the same booking attempt | Client synchronous pending guard plus stable attempt key; server unique idempotency key and P2002 winner lookup. Mocked races/retries pass. This is per attempt, not global deduplication of independently generated keys. |
| Lost response retry is idempotent | Same matching payload/key resolves original record, without minting a new private guest credential. Selection, contact, consent, notes, owner and financial snapshots must match. Changed catalogue/price or publication can fail closed before replay lookup; see limitations. |
| Concurrent guest enrollment cannot create two users for the normalized email | Unique email/emailNormalized constraints; P2002 retry in fresh transaction. Mock uniqueness failures are covered; actual MySQL contention still requires integration testing. |
| Submitted email does not grant ownership | No bulk attachment by contact email. New accounts stay inactive/unlinked until bearer email proof; signed-in ownership uses session ID. |
| Old passwords and profile data remain intact | Existing ACTIVE CUSTOMER receives no replacement password or overwritten name/phone; email verification timestamp and this booking's ownership can change. |
| Staff/suspended accounts cannot be claimed | Eligibility rejects non-customer-only roles and inactive status; completion now repeats authorization in a conditional write after locking. Stale snapshot regressions cover activation, suspension and staff elevation. |
| Verification token security | 32 random bytes, 43-character base64url token; one-hour expiry; persisted SHA-256 hash of namespace + exact booking reference + raw token; PASSWORD_SETUP type; conditional single-use consumption. |
| Only the verified booking links | Conditional update by booking ID, prior null userId and saved contact email. No email-wide booking update. Second same-email booking remains guest in regression. |
| Invalid/expired/replayed proofs | Generic failure, no session; token/account/link updates roll back together on failed link. Inspection does not consume proof. |
| Activation does not confirm/pay a booking | Linking update contains only userId. No booking confirmation, price or payment transition in activation. |
| Email failure preserves committed booking | Booking commit precedes enrollment/delivery. Delivery wrappers and API handling preserve the record. Failed account email invalidates its newly issued setup token; recovery remains possible. |
| Guest privacy | Reference is not a credential. Guest bearer token is hashed, expiring and revocable; both token resolver and booking read reject account-linked records. Existing guest links cease authorizing access after linking. |
| Consent | Explicit unchecked EN/ES/IT consent names terms, privacy and account creation/linking after verification. Server rejects absent/false/nonboolean guest consent and records an activity. This is not marketing opt-in or a versioned legal consent ledger. |
| CSRF/rate limits | Same-origin guard, bounded JSON and existing rate-limit checks remain. Shared limiter is count-then-record, not a strict atomic distributed quota. Forwarded headers require a trusted deployment proxy. |
| EN/ES/IT | Checkout, setup UI, new capacity/service messages and activity labels covered at code/mock level. Transactional email remains the existing English template architecture. |

Guest receipt tokens and account setup tokens have different contracts: guest access can be reused until expiry/revocation (default 90 days, configurable); setup proof is single-use and expires after one hour. Neither is a booking reference alone. New-account activation may create a fresh session; existing-account verification never silently replaces normal login with a new session. Session-creation failure after successful activation returns the normal login path instead of undoing the committed account/link.

## 2. Confirmed defects and fixes

### F1 — High: stale account authorization could overwrite activation or link an ineligible user

**Root cause:** `completeCheckoutAccount` read eligibility inside a transaction before taking the user row lock, then performed a non-locking re-read and unconditional user update by ID. Under MySQL REPEATABLE READ, the later consistent read can retain the earlier snapshot even after waiting on a lock. Two different guest bookings sharing a pending user could therefore race through activation; the later write could replace the password chosen by the first. Concurrent suspension/staff changes were similarly not guarded at the write boundary. The existing transaction mock serialized whole callbacks, masking this distinction.

**Fix:** `lib/server/checkout-account.ts` uses transaction-scoped READ COMMITTED for completion and conditional `user.updateMany` predicates on identity, normalized email, eligible status, expected password state, customer-only roles and the pending checkout-registration marker. A non-one result rejects and rolls back token consumption and linking. Booking/user locks and conditional booking update remain. No global isolation or database connection configuration was changed.

**Evidence:** three regression cases supply a stale read while current stored state is already activated, suspended or staff. Reconstructing the original write behavior makes all three incorrectly succeed; the fixed implementation rejects without overwriting password, linking booking or consuming token. An additional test checks the explicit transaction isolation option. This models the dangerous stale-read boundary; it does not simulate InnoDB itself.

MySQL's distinction between consistent snapshot reads and current locking operations is documented in its [transaction isolation reference](https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html) and [consistent-read reference](https://dev.mysql.com/doc/refman/8.0/en/innodb-consistent-read.html). Actual engine/version, role constraints and transaction behavior must still be verified in an approved isolated database.

### F2 — High: mail-provider errors could persist private bearer credentials

**Root cause:** `summarizeEmailError` in `lib/server/email.ts` redacted SMTP credential syntax but retained an echoed private booking/setup URL or bare opaque token. Its result was used in delivery errorSummary and structured console errors.

**Fix:** remove HTTP(S) URLs and long opaque base64url-like strings before existing credential redaction, truncation, persistence and logging. Delivery status behavior is unchanged. The scrubber deliberately also removes long diagnostic identifiers; privacy takes precedence there.

**Evidence:** injected provider error containing a setup URL and a separate 43-character token. Reconstructing the original scrubber exposes both; neither survives in the delivery summary or error log with the fix. Existing SMTP error/status tests pass. This verifies those concrete secret shapes, not arbitrary provider re-encoding or external provider log retention. Historical delivery rows/logs were not inspected or modified.

### F3 — Important: billed extra could differ from the displayed extra

**Root cause:** cart/server preferred `detail.addOns` before `dayDetail.addOns`; the one-day widget displayed `dayDetail.addOns`. A legacy record with both blobs and the same extra title at different prices could display 12.34 and bill 999.

**Fix:** shared `bookingAddonCatalog` in `lib/booking-selection.ts` follows the actual category-specific widget owner: dayDetail/global day fallback for one-day tours; detail for other categories. Both client estimate and server validator use it. An explicit empty list stays empty; catalogs are not merged.

**Evidence:** conflicting-blob regression reproduces 99900 cents with original precedence; client and server now agree on 12.34. All four category owners and explicit empty day extras are separately tested. Pricing tables, discounts and existing tour JSON were not rewritten.

### F4 — Important: a twenty-first cart selection could be lost on reload

**Root cause:** localStorage reader capped at 20, but addToCart could persist 21. Checkout already rejects more than 20 lines; reload could silently omit the last added selection.

**Fix:** capacity check before mutation/persistence, allowing replacement of the same selection. Both public booking widgets catch the failure and show an existing inline alert with EN/ES/IT copy. No layout redesign or increased server limit.

**Evidence:** overflow regression reproduces the missing rejection with original behavior. With the fix, original snapshot/disk stay at 20 and replacing an existing selection succeeds; all three capacity translations are checked. This prevents new overflows; it does not repair previously oversized user storage or make localStorage cross-tab writes atomic.

### F5 — Important: checkout exposed Prisma diagnostics

**Root cause:** both validation and creation catches in `app/api/bookings/route.ts` sent any Error.message to the public client, including ORM errors describing internal persistence failures.

**Fix:** Prisma known/unknown request, initialization, validation and panic errors return a generic no-store 503. Existing business validation errors retain their current 400 messages. New service-unavailable copy is supplied in EN/ES/IT.

**Evidence:** mocked Prisma P2010 failures in both validation and creation returned 400/internal text before the fix; now return generic 503 without injected SQL/host diagnostics. Existing consent and booking validation tests still pass. Account-linking/recovery already use generic failures and did not need this change.

## 3. Database compatibility and transaction findings

Inspected `prisma/schema.prisma`, existing auth, booking, guest-access and payment migration definitions, Prisma client usage and transaction boundaries. **No migration was executed and no deployed schema was queried.**

| Existing contract | Why it supports this flow |
| --- | --- |
| User unique email/emailNormalized; nullable passwordHash; status; role relation | Supports normalized unique pending enrollment, no initial password and controlled activation. CUSTOMER role must already exist in deployment. |
| AccountSetupToken unique tokenHash, user FK, PASSWORD_SETUP, expiresAt/usedAt indexes | Supports namespaced booking-bound proofs without adding columns. Binding is cryptographic/application-enforced, not a new booking FK on this table. |
| Booking unique reference and nullable unique idempotencyKey; nullable user FK | Public checkout requires a valid key even though schema accommodates legacy null keys. Supports atomic winner lookup and single-booking ownership. |
| Booking items/activities and Decimal(10,2) totals | Nested creation commits booking snapshots and initial consent/history together; cent bounds match available storage. Items snapshot tour slug/data rather than FK to mutable current tour. |
| BookingAccessToken unique hash, booking-reference FK, expiry/revocation fields | Private guest receipt and recovery; account linking revokes guest access without deleting the booking. |
| Existing sessions and attempt/delivery tables | Reused by enrollment; no new connection or pricing architecture needed. |

Completion transaction locks booking then user, conditionally consumes token, updates eligible user, links one booking, revokes guest access and records activity atomically. Password hashing happens before holding those locks. Enrollment token issuance is separate from committed booking creation, and SMTP is outside transactions. Unique-user contention retries P2002; other transaction/deadlock failures can still fail safely and require retry. They are not guaranteed automatic retries.

The source schema supports these changes without a new migration. That is **not** confirmation that Hostinger or either local database has matching migrations/indexes/roles. READ COMMITTED support and deployment binary-log/isolation compatibility must be checked before release. The conditional role/password update also requires a real SQL integration test, including an existing already-verified account.

## 4. Incomplete behavior, limitations and release gates

1. **Important — real persistence validation is outstanding.** Need approved isolated MySQL/MariaDB instance with deployed-equivalent schema, unique indexes, CUSTOMER role and engine settings. Exercise user-creation collisions, different-booking activation contention, role/status changes, token replay and rollback. Mocks cannot prove locking, isolation or deadlock behavior.
2. **Important — lost-response replay has a boundary.** API revalidates live selection/price/publication before idempotent lookup, and compares stored money. A changed/unpublished tour can block receipt replay even though the original booking exists. No second booking is created with that key, but the customer may need recovery/email. No unauthenticated receipt-only replay endpoint was introduced.
3. **Important — no atomic inventory/publication reservation.** Tour publication/rates are checked during server validation, before booking insertion; rows are not locked through commit. A concurrent catalogue change can fall between these operations. Dates are preferences and Date Pricing is not capacity inventory. Product must decide whether current request-booking snapshot semantics are sufficient or strict publication-at-commit is required before broad release.
4. **Important — abuse controls are bounded, not absolute.** Existing count/record limiter can overshoot with simultaneous requests; forwarded IP/host values must be overwritten by the trusted proxy. No strict distributed quota, timing-uniform recovery guarantee or proxy spoofing certification is claimed. Confirm deployment protections; stronger atomic quotas are a separate implementation decision.
5. **Important — real SMTP/session/browser checks remain.** Mock provider acceptance is not inbox delivery, and fake cookie/session calls do not verify actual HTTPS attributes, account navigation, mobile keyboard or fragment handling. Verify configured HTTPS canonical URL, real templates, safe redirects and recovery after send/session failures.
6. **Important — account-link UI conflates some failures.** Setup currently uses a generic invalid/expired-link message for failed fetches, including rate limiting. The account endpoint returns 429 but does not expose Retry-After there. Safe failure, but recovery guidance can be misleading; no unrelated form redesign was made.
7. **Optional — language scope.** EN/ES/IT forms/activity labels exist, while transactional mail is English. Full localized transactional templates require a locale persistence/template decision; they were not silently claimed complete.
8. **Optional — stronger intent/consent tracking.** Different independent keys represent different booking attempts, including different browsers. No global email/trip duplicate prohibition or versioned policy-consent ledger exists. Client storage is not an atomic multi-tab datastore.
9. **Important — inherited password policy.** Setup reuses the existing six-to-64-character shared policy. This review does not strengthen that policy only for enrollment. Security/product should explicitly accept it or approve consistent strengthening across registration, setup and reset.

No remaining confirmed ownership bypass was found in the reviewed paths after these fixes. That conclusion is limited to inspected source and the explicit test coverage; it is not a penetration-test or production guarantee.

## 5. Verification performed

| Check | Result | Boundary |
| --- | --- | --- |
| Focused Vitest run, 21 suites | **275/275 passed** | Mock persistence, SMTP adapters, session functions and UI harnesses; no real database/email/browser |
| New regressions | **17 added cases** | Eight failure cases across five defects demonstrated against original behavior; additional owner/empty-list/localization/isolation-option cases |
| TypeScript: `node node_modules/typescript/bin/tsc --noEmit --incremental false` | **Passed**, exit 0 | Configured project type check |
| Next.js: `node node_modules/next/dist/bin/next build --webpack --experimental-build-mode compile` | **Passed**, exit 0; compilation 10.7 s | Compile mode only; no prerender/generate completion, deployment or runtime certification |

Vitest emits an existing non-failing Vite configuration warning about future native config loading. No dependency/configuration changes were made to suppress it.

Failure reproduction was explicit: a temporary test-only Vite transform reconstructed the original F1–F4 behavior in memory and produced six failed regression cases (three stale-account cases, one pricing case, one cart case, one email case). Actual source was not rolled back. The temporary replay configuration was removed. F5's two regression cases were run against the original route and failed before its edit. The final normal configuration passes all 275 tests.

Executed suites:

```text
booking-account-ui.test.ts                 checkout-account-security.test.ts
checkout-account-route.test.ts             checkout-consent-api.test.ts
guest-booking-access.test.ts               booking-selection-safety.test.ts
booking-recovery-safety.test.ts            booking-recovery-template.test.ts
checkout-attempt-safety.test.ts            checkout-flow-safety.test.ts
cart-live-catalogue.test.ts                cart-storage-resilience.test.ts
booking-api-security.test.ts               accounting-security.test.ts
payments/checkout.test.ts                  tours-cache-lifecycle.test.ts
tours-cache-refresh.test.ts                tour-cache-race.test.ts
guest-booking-email.test.ts                email-delivery.test.ts
email-smtp.test.ts
```

Neighboring checks cover server unit-cent pricing, removed/unpriced extras, canonical aliases, publication/cache races, bounded traveler counts, attempt-key persistence, guest-token ownership, consent, CSRF, mock rate limits, accounting/payment ownership and safe outbound booking links. Passing payment tests do not mean a real payment provider was contacted or a payment made.

## 6. Exact files changed by this review

Paths below are relative to `D:/Development/star-pyramids-nodejs/web-source/`.

| File | Review change |
| --- | --- |
| `lib/server/checkout-account.ts` | Scoped isolation and conditional account authorization/write |
| `lib/server/email.ts` | Private URL/opaque credential error redaction |
| `lib/booking-selection.ts` | Shared category-owned add-on catalog |
| `lib/booking.ts` | Client estimate delegates to shared catalog |
| `lib/server/bookings.ts` | Server calculation delegates to shared catalog |
| `lib/cart.ts` | Pre-mutation cart capacity enforcement |
| `components/day-tour-detail.tsx` | Catch/show cart capacity error |
| `components/tour-detail.tsx` | Catch/show cart capacity error |
| `lib/customer-error-copy.ts` | EN/ES/IT capacity/service failure copy |
| `app/api/bookings/route.ts` | Generic persistence failure responses |
| `tests/checkout-account-security.test.ts` | Stale state/write guards and isolation option |
| `tests/booking-selection-safety.test.ts` | Conflicting catalog prices/category/empty owner cases |
| `tests/cart-storage-resilience.test.ts` | Capacity/no mutation/replacement/localization cases |
| `tests/email-delivery.test.ts` | Provider-echo credential redaction case |
| `tests/checkout-consent-api.test.ts` | Validation/creation diagnostic suppression cases |
| `docs/booking-enrollment-independent-review.md` | This review report |

This list describes this review's edits, not the complete pre-existing dirty enrollment feature or unrelated working tree. No tour, payment, customer, SEO or schema records were modified.

## 7. Manual end-to-end release checklist

Use a separately approved isolated environment and disposable test accounts/SMTP sandbox; these steps were **not** executed against live data.

- [ ] Match deployed-equivalent schema/migrations/indexes and CUSTOMER role; verify engine/isolation/binlog compatibility without altering production connections.
- [ ] Published day/multi-day/cruise selections reach cart; unpublished/missing records fail closed. Confirm shore enquiry CTA remains intentional.
- [ ] Price tampering, aliases, duplicate selections, removed extras and conflicting legacy detail blobs are safely rejected or priced from the displayed owner.
- [ ] Add 20 different selections, reject the twenty-first visibly; same-selection replacement works. Reload and denied-storage behavior preserve accepted selections.
- [ ] Signed-in autofill works after late session loading without replacing edits; booking is visible only to its correct customer.
- [ ] Guest consent must be explicit; one committed guest booking and one inactive pending identity are created. No account login/ownership before proof.
- [ ] Double-click, retry after lost response, two tabs with the same key and simultaneous server requests create one booking per key; conflict payload cannot reuse it.
- [ ] Two different guest bookings for a new normalized email create one pending account under actual unique-index contention.
- [ ] Activate those two booking links concurrently with different passwords. The completed activation's password must not be overwritten; retry remaining booking through existing-account verification; only specifically verified bookings link.
- [ ] Change user to suspended/staff while activation waits; no claim/link. Different signed-in identity is refused. Repeat for already-verified ACTIVE account without altering its password/profile.
- [ ] Wrong reference, changed email, wrong token type, malformed/expired/replayed token fail; failed booking link rolls back token and user activation.
- [ ] New password session uses real HttpOnly/Secure/SameSite cookie and ACTIVE user checks. Existing user uses normal login; simulated session failure preserves completed enrollment/link.
- [ ] Guest links work before linking and fail afterward; another customer's dashboard/reference cannot reveal it. Recovery responses remain generic for missing/mismatched/linked records.
- [ ] SMTP rejection/outage preserves booking, revokes only failed new credentials as intended, emits no bearer link/token in local logs, and offers recovery after cooldown. Check real inbox/spam, URL origin/fragment behavior and private URL handling in proxy/access logs.
- [ ] Price/publication change between validation/commit and lost-response retry follows the accepted product policy; no duplicate or accidental payment/confirmation is produced.
- [ ] Check EN/ES/IT setup, errors, consent, profile reminder and account history on real desktop/mobile; verify keyboard, modal/scroll and email-link reload behavior.
- [ ] Test missing/cross-origin headers, JSON limits, trusted proxy header rewriting and concurrent rate-limit behavior with the deployment team.

## 8. Release and rollback

Keep local pending enrollment implementation and these corrections together when preparing an authorized release. Do not ship only one tracked patch while omitting its already-untracked dependencies. No dependency install or schema migration is required by this review's fixes. Use compile verification plus the above isolated integration run before any production approval.

Rollback is a reviewed source release change; do not delete bookings, users, tokens or history to roll back UI/API code. Reverting security fixes can restore the defects documented above. Any operational investigation of historical error logs, cleanup, database test writes, commit, push or deployment requires separate authorization under this task's boundary.
