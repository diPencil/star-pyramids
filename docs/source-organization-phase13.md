# Authentication and payment service ownership — Phase 13

Seven whole-module relocations in two batches. Only import/reference literals
change. Authentication, authorization, RBAC, cookie/session lifecycle, preview
ownership, password reset, user/role management and payment behavior are not
redesigned. This supersedes the root-retention decisions for these files in
earlier organization snapshots; those historical reports remain intact.

## Exact moves and structure

| Original path | Destination |
| --- | --- |
| `lib/server/auth.ts` | `lib/server/auth/auth.ts` |
| `lib/server/auth-navigation.ts` | `lib/server/auth/auth-navigation.ts` |
| `lib/server/session.ts` | `lib/server/auth/session.ts` |
| `lib/server/guards.ts` | `lib/server/auth/guards.ts` |
| `lib/server/staff-preview.ts` | `lib/server/auth/staff-preview.ts` |
| `lib/server/users.ts` | `lib/server/auth/users.ts` |
| `lib/server/payments.ts` | `lib/server/payments/payments.ts` |

Direct files: components/ 12 → 12; lib/ 9 → 9; lib/server/ **15 → 8**.
auth/ is a coherent six-module authentication/user authority boundary. The
payment service joins the existing payments/ folder containing FX and proofs.
No compatibility wrapper, index/barrel, duplicate implementation, new abstraction
or module split was introduced.

```text
Before: lib/server/
  auth.ts, auth-navigation.ts, session.ts, guards.ts, staff-preview.ts, users.ts
  payments.ts
  payments/{fx.ts,payment-proofs.ts}
  [eight shared infrastructure files and other existing feature folders]

After: lib/server/
  auth/{auth.ts,auth-navigation.ts,session.ts,guards.ts,staff-preview.ts,users.ts}
  payments/{payments.ts,fx.ts,payment-proofs.ts}
  csrf.ts, db.ts, errors.ts, locale.ts, logging.ts, rate-limit.ts,
  request-json.ts, settings.ts
  [other existing feature folders unchanged]
```

## Retained roots

| File | Reason |
| --- | --- |
| csrf.ts | Shared same-origin mutation protection, independent of a particular session/role consumer. |
| db.ts | Sole Prisma singleton entry and established mock/operational contract. |
| errors.ts | Shared safe API error contract. |
| locale.ts | Global HTML/metadata server language boundary. |
| logging.ts | Shared sanitized operational logging. |
| rate-limit.ts | Cross-feature public/authenticated abuse protection. |
| request-json.ts | Shared bounded JSON body reader. |
| settings.ts | Cross-feature public/secret settings service with mixed validation ownership. |

## Integration preservation

All application, API, server, type-only, dynamic-import and test-mock consumers
are updated. The existing source-reader payment assertions now inspect the moved
service. proxy.ts remains at the Next.js-required root path; its only change in
this phase is the SESSION_COOKIE_NAME import path. Its redirect, consent/privacy,
headers, cache and request-method logic are unchanged. No configuration policy
or runtime selection changed.

The auth service retains the same server-only marker, public exports, query
order, status checks, password validation and transaction boundaries. Session
token generation/hashing, HttpOnly/SameSite/Secure attributes, expiry, renewal
and revocation are unchanged. Staff preview remains bound to the same staff
identity/session and permission checks; preview writes remain denied. User/role
authority and permission resolution stay in the same declarations.

Payment initiation, rounding, authoritative amounts, ownership, idempotency,
refunds, transaction callbacks, payment/event lifecycle and webhook behavior
retain the same declarations and execution order. No real authentication,
session mutation, booking, payment, email or database operation was invoked.

Sixteen external operational source files were inspected for the original paths;
no pinned consumer was found and no operational script was executed or changed.
Prisma and bootstrap/migration inputs remain unchanged. Historical reports keep
their original path descriptions; currentPath in the cumulative manifest gives
the live path. GTM fix 7993c03 and the sidebar release implementation are preserved.

## Verification

TypeScript passed after both batches. Focused checks: auth/session/preview/proxy/
booking security 123 passed across seven files; payment/proof/refund/webhook/
offline presentation 107 passed across eight files. The full default suite ran
once: **3,313 passed, zero failed, one skipped**, across 244 passed test files
and one skipped file (134.27 seconds).

Static inspection covered 950 files and 3,831 local references, including
read-only Prisma-script references: no missing modules, case mismatches, runtime
dependency cycles or detected client/server leaks. Exact source reconstruction
checked 950 baseline code files: 197 changed only in permitted import/reference
literals, including the seven moved modules. No query, callback, export,
transaction, validation or authorization declaration changed.

All 356 live relocation-manifest digests match. All 349 previous move records
retain their historical from/to and before/after digests. Sixty-two actual root
configuration/dependency and Prisma files are byte-identical; proxy.ts matches
the baseline exactly after replacing only the session import. An initial QA
helper overmatched an API directory named configurations/; its classification
was corrected to actual root configuration files, without changing application
code. The API's change was independently verified as import-only. GTM and
sidebar-release implementations, Git HEAD and the empty index are unchanged.
git diff --check passed.

No database connection, Prisma/schema/migration changes, environment/dependency/
deployment configuration changes, production build, browser checks, staging,
commit, push or deployment. Database integration opt-ins remain disabled and
tests use an unreachable process-only database URL. Mocked tests do not prove
deployed session persistence or live payment processing. Builds are not run
because static generation can query the application database; project rules
prohibit browser testing.
