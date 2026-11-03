# Checkout account enrollment verification follow-up

## What has and has not been established

The owner reported a guest booking absent from the registered account directory
and confirmed the submitted email was new. No production database, booking,
email, session or hosting log was accessed in this follow-up. The particular
production booking's cause is **not confirmed**. Do not equate mocked test
success with proof that the hosting instance created that customer's account.

Source review and composed mocked tests establish this current contract:

1. A genuinely new guest booking requires explicit boolean account/terms consent.
2. The booking commits with a consent activity before account preparation.
3. Account preparation rechecks persisted consent and the booking contact email.
   A new eligible email creates one passwordless PENDING CUSTOMER. Its booking
   stays unlinked until mailbox proof and password setup.
4. The CRM selects PENDING as well as ACTIVE CUSTOMER accounts; an unlinked
   booking does not hide the pending account. The guest contact is a separate
   projection, not a duplicate authentication identity.
5. The pending user commits before the setup email is sent. SMTP failure alone
   therefore does not explain an absent pending user in the same database.
   The unsuccessful setup token is invalidated, the user remains PENDING, and
   the original booking is preserved.
6. Verified activation links only the specified booking. Refreshed CRM then
   counts it under its real user relationship and excludes it from guest rows.
7. Legacy bookings lacking recorded consent are not automatically enrolled.
   Staff, suspended and unrelated pending identities remain ineligible. No
   identity is activated or claimed solely because an email was submitted.

## Confirmed defect and fix

`app/api/bookings/route.ts` previously discarded an account-preparation exception
with `.catch(() => undefined)`. This correctly preserved the committed booking,
but left no booking-level operational follow-up explaining a failed preparation.

It now records **Checkout account setup needs recovery** as an internal system
BookingActivity through `recordCheckoutAccountPreparationFailure`. The note is
static: no thrown exception, SQL text, email, password, setup URL or token is
stored in it. If audit persistence is unavailable, a static error code and the
non-bearer booking reference are logged. Audit failure still cannot turn a
committed booking into an error or undo it. Normal SMTP delivery failures retain
their existing EmailDelivery evidence; this audit is for a thrown preparation
failure, not a fabricated claim that no account exists.

The action has EN/ES/IT labels and is internal, so customer-safe booking history
continues excluding it. It does not change pricing, booking/payment status,
consent, eligibility, token binding, activation, retries or account ownership.
Committed replays still do not re-enroll or resend account credentials.

This improves future failure evidence; it does not repair an unknown historical
cause or add missing historical activities retroactively.

## How to diagnose the reported live booking safely

Use the existing authenticated admin screens, with all account statuses selected.
No test booking, resend, activation or production data change is necessary.

1. Open the exact booking in `/admin/bookings/<reference>` and inspect its
   activity timestamps for:
   - Checkout account consent accepted
   - Checkout account email requested
   - Checkout account setup needs recovery (available for future failures after
     this code is released)
   - Booking linked after email verification
2. Search `/admin/customers` by the supplied email with all statuses selected.
   Distinguish account rows from guest contact rows. When only guests exist,
   the earlier local visibility fix now places that section before the large
   empty account directory and puts the guest count first in its KPI caption.
3. Inspect the booking-specific setup delivery through the existing staff API:
   `/api/admin/emails?reference=<reference>&type=booking_account_access&limit=100`.
   It requires an existing admin session and `emails.view`. This server-side
   filter avoids relying on the email page's first 100 global deliveries.
   Share only the reference, activity names and delivery status; do not share
   private links, cookies, passwords or environment credentials.

| Evidence | Interpretation / next step |
| --- | --- |
| No consent activity on a legacy booking | No automatic account is expected. Do not invent consent or insert/activate a user retrospectively. Guest CRM/recovery remains available. |
| Consent + PENDING account + SENT setup email | Provisioning and SMTP acceptance worked. This does not prove inbox delivery or activation; inspect spam or use the existing explicit recovery path. |
| Consent + PENDING account + FAILED email | Investigate safe delivery diagnostics / hosting SMTP configuration. Do not recreate the customer or booking. |
| Consent + no account + no setup email | Preparation may have failed or not completed; inspect the internal follow-up and hosting logs. Before this change, the thrown preparation error had no booking activity. No particular database defect is inferred. |
| Setup email requested but no delivery row | Inspect delivery persistence/configuration and hosting logs; the activity alone is not proof that SMTP accepted mail. |
| Linked activity + missing customer row | Verify the actual FK, CUSTOMER role and that admin/API use the same identified deployed database; do not attach records by email. |

If source-reviewed behavior differs from the deployed instance, an authorized
read-only preflight should confirm deployed revision, database identity, nullable
User.passwordHash, CUSTOMER role, AccountSetupToken/BookingActivity tables and
related email-delivery records. Source schema does not prove deployed schema.
No such production connection or migration was performed here.

## Verification and boundaries

- **413 tests passed across 33 focused suites**, including the retained booking,
  pricing confirmation, idempotency, ownership, recovery, SMTP and CRM suites.
- The new composed cases execute the actual checkout HTTP handler, account
  preparation/verification services, CRM service and directory HTTP handler.
  The booking-commit boundary, Prisma persistence, authentication/rate-limit
  adapters and SMTP provider are mocked. Actual SQL transactions, browser
  sessions, hosting configuration and inbox delivery are not exercised.
- Cases prove pending creation and CRM visibility, SMTP-failure preservation,
  verified FK linking/removal from guest projection, safe failure audit,
  unavailable audit storage, and no re-enrollment on committed replay.
- The new audit expectation failed against the original swallowed-error path
  and passed after the fix. The prior guest-first ordering assertion similarly
  failed before the UI fix and passed afterward.
- TypeScript and Next compile-only verification passed. Compile mode does not
  perform full prerender/generation or establish deployment readiness.
- No actual booking, account, consent, token or email was created or modified
  during this work. No connection strings, credentials or schemas changed.

Commands:

```powershell
node node_modules/vitest/vitest.mjs run tests/checkout-account-security.test.ts tests/checkout-consent-api.test.ts tests/admin-customer-trip-tables.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/next/dist/bin/next build --webpack --experimental-build-mode compile
```

## Release manifest

- `app/api/bookings/route.ts`
- `lib/server/checkout-account.ts`
- `lib/booking.ts`
- `tests/checkout-consent-api.test.ts`
- `tests/checkout-account-security.test.ts`
- `docs/checkout-enrollment-verification.md`
- Earlier local visibility follow-up: `app/admin/customers/page.tsx`,
  `tests/admin-customer-trip-tables.test.ts`,
  `docs/admin-guest-crm-multitrip-reporting.md`.

No migration is required by this change. Code rollback removes the new audit
behavior and display-order fix; it must preserve the earlier enrollment and
booking security implementation. Any deployment and production remediation
remain separate from the owner's authorization to commit and push local code.
