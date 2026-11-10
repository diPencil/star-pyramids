# Booking backend modularization — Phase 5D

The existing `lib/server/booking/bookings.ts` entry point remains. Application routes, checkout callers and existing mocks still import that entry point. No wrappers, new services or business rules were introduced.

## Extracted modules

| Module under `lib/server/booking/` | Responsibility | Lines |
| --- | --- | ---: |
| `booking-values.ts` | Existing status mappings, cents/decimal conversions and shared note validation primitives | 36 |
| `booking-validation.ts` | Strict selection/contact validation, authoritative tour lookup and unchanged price calculation | 228 |
| `booking-read-models.ts` | Prisma row/include types and shapes; customer/staff projections, activity filtering and payment summaries | 152 |
| `booking-queries.ts` | Account-scoped lists/details, token-authorized guest reads and staff reads | 67 |
| `booking-replay.ts` | Checkout fingerprint/legacy replay checks, captured consent proofs and deterministic booking lead receipts | 70 |

Line counts use the same newline-split method before and after. The entry point decreased from **1065 to 527 lines**, a reduction of 538 lines. Across the six modules, all **57 original named declarations** retain their original declaration text, allowing only the `export` modifier needed for internal module access. Forty-four declarations moved and thirteen remain.

## Preserved public contract

Runtime exports: `BOOKING_FINANCIAL_REVIEW_CODE`, `BookingFinancialReviewError`, `addStaffBookingNote`, `cancelCustomerBooking`, `createBookingRecord`, `findCheckoutReplay`, `getCustomerBooking`, `getGuestBooking`, `getStaffBooking`, `listCustomerBookings`, `listStaffBookings`, `toCustomerView`, `toStaffView`, `transitionStaffBooking`, `validateBookingDraft`.

Public types: `ValidatedBookingLine`, `ValidatedBookingDraft`.

Extracted public functions are direct re-exports with identical function identity. Module-specific helpers and types are not added to the original public entry point. Every new module retains `import 'server-only'`.

## Security and transaction ownership

- Creation, collision retries, unique-reference issuance, the existing cancellation financial guard, customer cancellation, staff transitions and internal-note transactions remain in `bookings.ts`.
- Transaction callbacks, conditional updates, payment locks and audits, exception classes/messages, notification/email ordering and guest-link rotation are unchanged.
- Read queries retain their original filters, includes, sorting and projection calls. Guest reads resolve the reference from the token before querying and reject bookings linked to accounts. Customer detail reads retain their ownership checks. Staff route RBAC remains in the existing route handlers.
- Validation retains sequential catalogue lookup and the shared pricing timestamp. Replay handling retains its original database query, fingerprint/owner verification and captured-consent comparison. Pending bookings remain leads, never purchases.
- No new extracted module imports the entry point; dependency checks found no cycles involving the extracted modules. Unrelated existing type-only relationships, such as the email adapter's type import from its owner, are outside this change.

## Verification

Each extraction was followed by TypeScript, local import checks and focused existing tests. Batch test counts: **124, 139, 97, 86, 189**. After import pruning, **110** focused tests passed.

`tests/booking-module-compatibility.test.ts` adds 21 isolated tests covering the exact export surface, direct function identity, financial error contract, query shapes, customer ownership, guest authorization order, private activity filtering, staff reads and replay consent/ownership. Database, catalogue, email and notification boundaries are mocked. An initial new replay fixture had no tour items; the fixture was corrected to represent a real booking without changing production code or assertions.

No database-dependent build, browser test, migration or real transaction was performed. Operational database behavior has not been exercised; verification covers source preservation and mocked execution only. The final full suite ran once: **3271 passed, 0 failed, 1 skipped** across **242 passed test files and 1 skipped file** (137.39 seconds). TypeScript passed after every extraction and after import pruning. Final import/asset resolution covered **3778 references across 922 source/test/script files**, including 13 consumers of the original entry point; no unresolved paths or cycles involving the extracted modules were found. `git diff --check` passed. A byte-hash comparison confirmed that unrelated existing files were unchanged; Git HEAD and index were unchanged.

## Intentionally retained responsibilities

The remaining creation/status workflows are still sizeable. Separating their side effects, nested replay ownership checks or money-guard calls further would broaden this phase's transaction/security review, so they remain intact. The pre-existing unused `toCents` helper is retained; this phase does not perform dead-code cleanup.
