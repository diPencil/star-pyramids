# Checkout account enrollment

## Contract

Local implementation; no database writes, real bookings, SMTP delivery, migrations, publishing or deployment during development. Reuse users, CUSTOMER roles, AccountSetupToken, BookingActivity and existing sessions. Do not infer ownership from a submitted email.

Guest checkout requires an explicit terms/privacy/account-enrollment acknowledgement. A successful booking remains a guest request until its owner proves mailbox access. Create a passwordless PENDING customer for a new normalized email, without inventing surname, username or country. Never modify an existing account's identity or password. Only CUSTOMER-only accounts qualify; suspended, staff and unrelated pending accounts are excluded without public enumeration.

Send an email-only, one-hour, 256-bit token. Persist a SHA-256 hash domain-separated by workflow and exact booking reference; do not return the token in checkout responses. Token consumption and linking exactly one booking are transactional and single-use. A new account sets its password and becomes ACTIVE only after proof. An existing account retains its password and requires normal login; mailbox proof must not silently replace a session. Never bulk-claim bookings by email. Revoke the old guest booking tokens after successful linking. A failed email must not roll back a committed booking or invalidate an older delivered onboarding link.

Retain current button/ref guard, intent-bound retry keys, unique booking idempotency key and replay ownership/snapshot checks. Provisioning retries must not duplicate accounts or bookings. Coalesce email requests with a per-booking cooldown under a row lock; preserve generic responses and existing rate limits. Token handling must not weaken password-reset token semantics. No new Prisma migration is required by this design.

Use existing public form styles and EN/ES/IT text. Show an account profile-completion reminder without blocking the first booking or subscribing the customer to marketing. Missing delivery or session creation must have a recoverable path. Verify with mocked persistence and SMTP only: races, expiry/replay, identity changes, staff exclusion, wrong booking/email, consent, password policy, login preservation and existing checkout regressions.


## Implemented flow

1. The existing guest checkout now explicitly acknowledges terms/privacy and account enrollment. Consent is server-validated, removed from the monetary selection contract and recorded transactionally in BookingActivity when the original booking is created. Signed-in customers keep the existing ownership flow.
2. After a valid booking commits, enrollment prepares a PENDING, passwordless CUSTOMER-only user if the normalized email is new. Surname, username and country remain missing rather than being fabricated. Existing customers retain their identity and password. Exact normalized identity is checked even if database collation matches more loosely. Legacy guest bookings without consent are not retrospectively enrolled.
3. A separate transactional email carries a one-hour account-confirmation link. The raw token exists only in that email and the receiving browser's mounted component; its domain-separated hash is stored in AccountSetupToken. The hash binds the workflow and the exact booking reference, so neither a password-reset token nor a token for another booking is usable. Link credentials travel in a URL fragment, are removed from the address on receipt, and are not server-rendered props. Mail scanners may inspect without consuming the token; actual confirmation requires an explicit same-origin POST.
4. New users set their own password using the existing shared policy and password hasher, then become ACTIVE. Existing users retain their password and use normal sign-in; confirming their email does not silently open a session. A different signed-in identity cannot complete the link. Staff, suspended and unrelated pending accounts are not enrolled or modified.
5. Token consumption, activation, linking exactly the referenced booking, and guest-token revocation are one transaction with row locking and compare-and-set checks. Guest token issuance takes the same booking lock, and token resolution also rejects account-linked bookings. No tour price, booking confirmation or payment state changes during activation.
6. The account overview reminds users with missing identity/contact fields to complete their profile. It does not block the saved first booking or opt anyone into marketing. UI and new activity labels support EN/ES/IT; transactional email uses the existing English template architecture.

## Duplicate and abuse protections

- The synchronous client ref and disabled submit button prevent rapid duplicate clicks.
- Persistent intent-bound retry keys and the existing unique booking idempotency key prevent another insert when a response is lost and the same attempt is replayed. Ownership, consent, selections and snapshots must still match.
- Per-booking transaction locks coalesce enrollment email requests inside a one-minute cooldown. A unique normalized user email plus a fresh-transaction retry handles simultaneous different bookings for the same new email.
- Email-only proof is single-use and expires. Token hashes, not raw tokens, are persisted. Role, status, current identity, exact email and booking association are checked again inside confirmation transactions.
- Same-origin checks, bounded JSON, strict request keys, existing booking and IP token-attempt rate limits remain enforced. Successful inspection does not consume the password-submit budget; completion attempts and failed token checks do.
- These protections do not deduplicate deliberately different checkout attempts with different keys across unrelated browsers. Such a business rule would need an agreed definition of a duplicate; identical legitimate repeat bookings must not be silently discarded.

## Failure and recovery behavior

A failure preparing an account or sending mail cannot undo a committed booking or trigger another booking insert. The receipt retains private guest access until verification. The receipt's resend action retries enrollment for matching saved email and consent, alongside existing guest-link recovery, subject to cooldown and rate limits. Mail failure revokes only the new setup token and leaves older delivered setup links usable. Once any valid link claims the booking, other links fail the association check.

If session creation fails after new-account activation commits, normal sign-in remains available. The page also exposes sign-in/password recovery after a lost confirmation response. Full page refresh after fragment removal requires reopening the original email link. SMTP acceptance does not prove inbox delivery; no delivery was attempted in development.

## Files

- `app/api/bookings/route.ts`
- `app/api/bookings/account/route.ts`
- `app/booking-account/page.tsx`
- `components/booking/checkout/checkout-page.tsx`
- `components/booking/booking-account-setup.tsx`
- `components/account/account-portal.tsx`
- `lib/booking/booking.ts`
- `lib/server/booking/checkout/checkout-account.ts`
- `lib/server/booking/access/booking-access.ts`
- `lib/server/booking/access/booking-recovery.ts`
- `lib/server/booking/bookings.ts`
- `lib/server/email.ts`
- `tests/checkout-account-security.test.ts`
- `tests/checkout-account-route.test.ts`
- `tests/checkout-consent-api.test.ts`
- `tests/booking-account-ui.test.ts`
- `tests/checkout-flow-safety.test.ts`
- `tests/guest-booking-access.test.ts`
- this report

## Verification and remaining release checks

**258 tests passed in 21 focused suites**, using mocked database, transactions, requests, SMTP, session creation and React handlers. Covered account uniqueness races, simultaneous token consumption, consent, delayed contact prefilling, double-submit/lost response, rollback on failed linking, staff/suspended exclusion, wrong identity/reference/type/email, expiry/replay, email failure, guest access after linking, CSRF, size limits, account-password preservation and EN/ES/IT. Existing pricing/payment/accounting/cache tests also passed. TypeScript (`tsc --noEmit --incremental false`) passed, exit 0. Next.js webpack compile-only verification passed, exit 0 (24.0-second compilation). Full generation/prerender was intentionally not run. Tracked-file `git diff --check` and new-file whitespace checks passed.

No browser automation was used. Existing project forms, controls and styles were reused following the UI skills and project design rules; a 21st CLI/catalog tool was not available, so no external component installation, generation or CLI review was run. No dependencies or configuration were added.

Before an authorized release:

- Verify the identified target schema already has users, CUSTOMER role, AccountSetupToken, BookingActivity and booking access tokens. The existing auth migration `20260930032758_init_p0_auth_settings` already defines account setup tokens; no new migration was introduced, but the deployed schema was not queried.
- Deploy matching frontend/backend code together. An older open guest checkout without the new consent checkbox must be refreshed; accepting enrollment silently for older clients is intentionally disallowed.
- On an approved isolated environment, test a new email, an old account, multiple clicks, delayed mail, failed SMTP, resend after cooldown, opening on another device, expired/consumed links, different signed-in identities, missing profile fields and mobile/desktop forms in all supported locales. Never use production records as test fixtures.
- Verify real HTTPS origin, SMTP settings, delivery/spam behavior and cookie/session creation. No full prerender or production booking was used in this task.
- Rollback should stop issuing new enrollment links while retaining their completion handler for the one-hour lifetime where possible. Activated accounts and linked bookings remain compatible with existing schema/login. Pending users and unused tokens should not be destructively removed; a full rollback can leave unactivated customers needing a later verified setup flow. No database reset or blanket cleanup is appropriate.

No commits, pushes, deployment, migrations, database records, real sessions or emails were created as part of this implementation task. Existing unrelated work was preserved.
