# Booking, checkout and account enrollment — final local hardening

Date: 2026-11-03. Application: `D:/Development/star-pyramids-nodejs/web-source`.

## 1. Executive summary

Implemented the approved explicit price-change policy, catalogue-independent committed-attempt recovery, a short transactional final pricing/publication check, differentiated account-setup recovery, and booking-scoped request hardening. Existing account ownership, guest access, cart, pricing and rich-text work was preserved.

**Local verification: 368 tests passed in 26 files; TypeScript passed; Next.js compile-mode build passed.** This is not real MySQL, browser, SMTP, proxy or session-cookie certification. Production readiness remains conditional on the release gates below.

No database connection was opened for integration testing, and no actual records, migrations, connection strings, credentials or production services were modified. No live booking submission, email delivery, browser automation, commit, push or deployment occurred. No package installation, new database table, infrastructure service or unrelated redesign was introduced.

Mandatory reports, project instructions/design documentation and actual working tree were reviewed. Commits `998d2b6` and `08ebdde` were inspected; subsequent tracked and untracked enrollment/security work was retained. Recovery folders were not accessed. The 21st UI skill was used as guidance; its CLI was unavailable, so the existing project confirmation dialog and public form/button styles were reused without external component generation.

## 2. Product policy and customer behavior

- Request Booking accepts the precise rendered financial snapshot, independently recalculated by the server in integer USD cents. Client money is a comparison input, never the persisted price.
- A base, applicable unit, discount context or selected extra change—including a decrease or offsetting components with an unchanged grand total—blocks creation and returns a price-change response.
- Checkout shows previous and updated USD totals, affected tours, rate/discount changes and changed extras in a native confirmation dialog. **Accept Updated Price** explicitly submits the signed updated quote. **Review Cart**, close and Escape dismiss without deleting selections or entered contact fields; cart review remains on Checkout.
- Acceptance is revalidated. A second change or expired quote requires fresh confirmation. Supplied invalid/empty signatures cannot fall back to unsigned initial acceptance.
- The initial price snapshot is captured with the rendered cart estimate. A discount expiring between render and click cannot silently replace the customer's accepted amount with a newly computed amount.
- Unpublished/deleted tours cannot be overridden by a price quote. Localized unavailability feedback offers removal of affected selections and retains others.
- Rejected requests and price dialogs leave the cart and contact fields intact. A successful result removes only the submitted keys, preserving selections added later.
- Dates remain preferred dates. No seats, availability inventory, seasonal pricing engine, payment charge or automatic booking confirmation was introduced. Shore excursions retain their enquiry CTA.

## 3. Confirmed gaps, root causes and corrections

| Finding | Root cause | Correction and evidence |
| --- | --- | --- |
| Price changes could be silently accepted | Old checkout sent selections only; server recalculation had no accepted financial context | Shared cents projection plus `acceptedPrice` comparison; signed update confirmation; increase/decrease/extra/discount/offsetting-component regressions |
| Expired displayed discount could be accepted implicitly | Recomputing accepted prices at click time could differ from the frozen estimate on screen | `ResolvedCartLine.price` captures the same render-time context; expiry-before-submit regression |
| Committed retry could fail after price/publication change | Live validation preceded idempotent lookup and replay compared current money | Verify immutable request before live resolution; recover original snapshot; no guest private fields or new credentials |
| Final validation and insertion used separate catalogue observations | Tours/offers could change after the first authoritative read | Final same-transaction tour/offer lookup and acceptance check under selected-row locks, then nested booking creation |
| Existing setup errors conflated invalid proof, network and service failures | UI used one boolean; endpoint catch treated unrelated errors as expired proof | Typed safe response codes and EN/ES/IT recovery messages; reliable Retry-After; explicit session-recovery success |
| Account `mode` coercion could enter completion without reserving its budget | `String(input.mode)` accepted arrays such as `["inspect"]`, but later strict comparisons took the completion branch | Require an actual string enum. Two tests returned 200 before the fix and now reject 400 before completion/session calls |
| Same-process rate check/record could overshoot | Concurrent requests checked the old count before any recorded a reservation | Bounded process-local serialization of persistent check + reservation, before expensive work. Regression reproduces two old admissions and one corrected admission |
| Booking IP/host handling trusted arbitrary forwarded values | Headers were consumed without an explicit proxy contract | Ignore forwarded headers by default; explicit booking-specific trust opt-in plus IP syntax validation; same-origin protection retained |
| Same-origin comparison omitted the URL scheme | A host-only match accepted HTTP Origin for an HTTPS request | Booking mutations require matching host and protocol; forwarded protocol is used only under the explicit trusted-edge contract; targeted test failed before the fix |
| Unexpected rejection from a supposedly safe mail wrapper could disturb the post-commit result | Booking creation awaited the wrapper after commit without an outer defensive catch | Defensively catch both receipt sends; committed booking remains a successful creation. Regression demonstrated the previous acknowledgement degradation |
| Empty price-confirmation input downgraded to initial acceptance during development | Truthiness check treated an empty provided token as absent | Verify every provided token, including empty strings. Regression first created a mock booking instead of rejecting; now rejects |
| Updating client fingerprints could replace an unresolved old key | Adding consent to the intent hash changed the storage lookup | Claim/migrate the previous fingerprint's existing key once; no raw contact information is persisted in attempt storage |

Source-confirmed missing contracts were covered by new negative tests. Explicit red/green evidence includes mode coercion, empty-token downgrade and unexpected mail rejection; the old count/record race is reconstructed in a targeted mock test. No pre-change production reproduction is claimed.

## 4. Exact code responsibilities

| Owner | Changes in this phase |
| --- | --- |
| `lib/booking-price.ts` | Shared financial projection and bounded cents-only acceptance parser; separates display titles from financial identity |
| `lib/booking.ts` | Captures render-time price context using the existing engine; preserves stale/removed-extra handling |
| `lib/server/booking-quote.ts` | HMAC quote issuance/verification, ten-minute expiry, safe price/unavailability errors |
| `lib/server/booking-checkout.ts` | Stable request parsing, replay-first orchestration, current validation and short transactional persistence |
| `lib/server/bookings.ts` | Hidden attempt fingerprint activity, conservative legacy matching, replay ownership, injectable transactional persistence and defensive mail boundary |
| `lib/server/tours.ts`, `lib/server/special-offers.ts` | Optional transaction client for the existing canonical/alias and linked-offer resolvers; default public behavior retained |
| `app/api/bookings/route.ts` | Structured price/unavailability responses; no enrollment on changed price or replay; limited guest acknowledgements; safe persistence errors retained |
| `components/checkout-page.tsx` | Explicit dialog, preserved fields/cart, frozen-request recovery, targeted unavailable-selection removal |
| `components/customer-confirm-dialog.tsx`, `components/account-portal.tsx` | Extract existing dialog into a reusable owner; preserve existing export/callers; public primary/outline buttons, focus containment and restoration |
| `lib/checkout-attempt.ts` | Consent-bound intent and compatibility migration for unresolved keys |
| `lib/account-setup-feedback.ts`, `components/booking-account-setup.tsx` | Distinct invalid/rate/service/network/password/identity states; safe retry; retained fragment credentials within mount; session fallback guidance |
| `app/api/bookings/account/route.ts` | Strict mode type, reservation before completion, safe failures, actual limiter retry interval and session-recovery response |
| `lib/server/booking-request-security.ts` | Scoped trusted-header policy and bounded in-process reservation queues |
| Booking recovery/access/document/proof route files | Reuse the trusted-IP owner; recovery uses the booking reservation boundary |
| `lib/customer-error-copy.ts` | New public booking errors translated into EN/ES/IT |

No editor, SEO, payment, tour-content or Prisma schema changes were made by this phase. Existing source modifications in those areas remain in the working tree.

## 5. Price-confirmation contract

Checkout still sends the existing selection/contact/notes/currency/key structure and explicit consent. Additional top-level fields:

```text
acceptedPrice: { currency: "USD", lines: [...], subtotal, discount, total }
priceQuote?: string
recoverOnly?: boolean
```

Financial money fields are safe nonnegative integers in cents. Snapshots contain canonical selection tuples (slug, preferred date, counts, selected extras), base price, charged/original traveler units, selected extra prices or null for on-request extras, discount percentage/end context, and original/discount/total amounts. Ordering is canonicalized for financial comparison. Translated/display titles do not authorize money.

The original `validateBookingDraft` remains strict: arbitrary price, status, ownership, payment or line-level monetary fields are rejected. The API removes only the explicitly supported comparison/confirmation/recovery fields before passing selections to it.

### Outcomes

| Response | Meaning |
| --- | --- |
| 201, original booking response | New request saved using authoritative accepted pricing |
| 409, `PRICE_CHANGED`, `price`, `quote` | No new booking/enrollment/guest credential/receipt. Customer must review and explicitly accept |
| 400, `PRICE_CONFIRMATION_INVALID` | Invalid supplied signature, including empty input. No unsigned fallback |
| 409, `TOUR_UNAVAILABLE`, selected slug | Publication/ineligibility rejection; not overridable by price acceptance |
| 503, safe service response | Quote configuration/persistence unavailable; no silent acceptance |
| 200, authorized committed replay | Original snapshot or restricted guest acknowledgement; no repricing or extra credential issuance |

### Quote security and configuration

Quotes use HMAC-SHA-256 with constant-time signature comparison and a **ten-minute** lifetime. Signed payload carries only version, expiry and SHA-256 digests. It binds the normalized request fingerprint, attempt key, server session identity and canonical financial projection. The financial projection binds all selected products/counts/extras and discount context. It is neither an account proof nor guest-booking access token.

`BOOKING_QUOTE_SECRET` must be a cryptographically random, stable server-only secret with at least 32 bytes of material, shared across all application instances. It is never derived from a database password, returned to clients or logged. No `.env` or production secret was set by this task. Tests use a clearly synthetic in-process environment value.

Missing/short secret fails closed when a quote must be issued or verified; unchanged initial requests can still be independently compared. **Provisioning this secret is a release prerequisite.** Key rotation invalidates outstanding quotes safely and requires the customer to request fresh confirmation. There is no process-random fallback that would cause cross-worker quote loops.

A boolean such as `priceAccepted: true` is not accepted as proof. A provided signature cannot authorize a different request/key/session or another commercial snapshot. Changed/expired valid quotes produce fresh confirmation. A matching initial snapshot represents the customer's explicit Request Booking action; it is never used as the stored price.

## 6. Idempotency and committed-attempt recovery

New records atomically include a private `BookingActivity` named `Checkout attempt fingerprint v1`, with `isInternal=true`. Its note stores a hash and original session owner, not raw form content. It uses the existing activity table and is excluded from customer history.

Identity covers normalized contact, preferred dates, selected tour identifiers, counts, normalized selected extras, notes and explicit consent. Financial comparisons/signatures are deliberately excluded from replay identity: a committed booking must not depend on a later quote expiry or catalogue price. A replay cannot change stored money/status. Original authenticated attempts require their session owner. A guest attempt later linked to an account still yields only a guest acknowledgement unless the current session actually owns it.

Replay lookup occurs before current catalogue/pricing validation. New attempts still validate current publication and pricing. Transaction rechecks and unique-key P2002 winner handling retain one booking per matching key, including simultaneous submissions. A guessed/supplied key with mismatched request or ownership fails; no global email/tour/date deduplication was added.

Guest replay returns only:

```json
{"success":true,"existing":true,"reference":"SP-BK-XXXXXX","guest":true,"guestAccessUrl":null}
```

It does not return contact, lines, totals, activity, payment data or private links. A reference alone opens no booking. The customer can use the existing reference/email recovery process; recovery sends credentials through the saved email address. Replays never prepare accounts, issue access/setup tokens or resend receipts merely because they are retried.

`recoverOnly=true` performs the same authorized lookup and cannot create a booking when none exists. The UI can retry the frozen submitted body after a lost response, even when cart eligibility later changes. If all saved products become unavailable, contact/recovery controls remain accessible while new submission stays disabled. After reload, key storage can be reused with matching re-entered contact/selection data; sensitive form contents are not automatically persisted in sessionStorage.

Legacy committed records without the new activity are conservatively matched against stored contact, canonical selection/count/date, priced extras, reconstructed on-request notes and consent history, without consulting live prices. Ambiguous legacy combinations, unreconstructable alias changes or missing identity evidence fail closed and require receipt/email/support recovery. No rows were backfilled. Legacy client fingerprints migrate to their original unresolved key rather than silently generating a replacement.

Rate limits still apply to recovery requests. This is safe recovery per attempt, not an unlimited bypass of abuse controls.

## 7. Transactional consistency and its limits

After an initial accepted-price check, new persistence runs in a short **READ COMMITTED** transaction:

1. Lock selected canonical tour rows using parameterized SQL and ordered slugs.
2. Lock existing offers linked to those tours.
3. Recheck whether a matching attempt has committed while waiting.
4. Resolve selected tours, aliases and offers through the same transaction client.
5. Recheck publication, valid canonical association and the exact accepted financial projection/signature.
6. Atomically create booking/items/initial activities and intent metadata.

The transaction waits at most five seconds for acquisition and has a ten-second timeout. No SMTP, enrollment, password hashing, provider call or quantity reservation occurs inside it. Nested creation remains PENDING booking/PENDING payment. Already committed snapshots are immutable under replay.

The existing Offer-to-Tour foreign key is relevant to concurrent new linked offers; deployed constraints and engine locking must be verified. Ordered inputs/queries reduce inconsistent access patterns but are not a proof that InnoDB cannot deadlock. Failures/timeouts fail safely and can be retried with the same key; no blind transaction retry changes the accepted price.

**Unavoidable/unverified boundary:** the source targets a consistent last authoritative calculation under selected-row locks. Time-based discounts can expire between that calculation and commit, and external code not obeying the same relational/transaction assumptions is not certified. Real locking, FK checks, engine/binlog settings and cross-connection behavior have not been tested. This is not a claim of strict inventory reservation or production-proven publication-at-commit guarantees.

## 8. Account enrollment, email, session and request security

All five independent-review fixes remain intact: conditional account write, provider-error redaction, category-owned extra catalog, 20-selection cap and safe Prisma errors.

- New guest consent is validated before new creation; account preparation follows a committed valid booking only. Pending passwordless CUSTOMER accounts do not own bookings until proof.
- Existing ACTIVE customer passwords/name/phone remain unchanged. Email alone is not ownership. Only the specified verified booking links.
- Activation retains booking/user locks, READ COMMITTED, current eligible role/status/password predicates, conditional single-use proof consumption and rollback on failed linking. Staff/suspended/unrelated pending users are rejected.
- Setup proof remains hashed, reference-bound and one-hour expiring. Linked guest bearer access is revoked and independently rejected on lookup.
- New-account session creation follows successful activation. If session creation fails, account/link remain committed and UI explicitly directs normal login. Existing-account verification retains ordinary login.
- Account setup differentiates invalid/expired/replayed proof, 429, temporary service failure, network failure, password mismatch and different signed-in identity. Retry-After is shown only when actually supplied; no duration is invented. Inspection retry uses retained in-memory fragment credentials; full reload requires reopening the email link.
- Setup `mode` is now a true string enum, closing coercion into the wrong rate-limit branch.
- Canonical email links use the existing HTTPS-only `resolveSiteUrl`, safe origin/redirect handling and existing templates. Passwords are not emailed. Private URL/token error redaction remains. Receipt/wrapper/SMTP failure never deletes a committed booking.
- Session cookies retain HttpOnly, production Secure and SameSite=Lax. Real browser cookie behavior is untested.
- Existing bounded JSON limits remain: booking 128 KiB, setup 4 KiB, email recovery 2 KiB. Unknown fields and malformed token shapes fail closed.

### Rate limits and proxy contract

The old check-then-record race is demonstrable with concurrent async checks even in one process. New bounded queues serialize persistent checks/reservations within each application process and release before expensive work. Setup completion is reserved before hashing; valid inspection remains non-consuming. Queue saturation returns 429 without fabricating a Retry-After interval.

This is **not a distributed atomic quota**. Cross-process/replica overshoot remains possible; actual deployment worker count and edge behavior were not identified or tested. Existing per-booking recovery locking/cooldown remains.

`BOOKING_TRUST_PROXY_HEADERS=1` is permitted only after verifying that the deployment edge overwrites untrusted forwarded IP/host/protocol values. Default behavior ignores forwarded values, uses the direct Host and request URL scheme for same-origin checks, and puts unavailable peer IPs in the shared `unknown` bucket. This prevents spoofed-IP quota evasion but can over-throttle unrelated visitors. **Verify/provision the trusted proxy contract before public release.** No trust flag or connection configuration was changed here.

Transactional emails remain English under the existing template architecture. Full email localization remains a separately approved product enhancement. Generic recovery response bodies do not establish constant-time processing or certify external provider/proxy logs.

## 9. Password policy: unchanged, approval required for changes

Registration, reset, change-password and checkout activation reuse `validatePasswordStrength`: minimum six and maximum 64 JavaScript string units, with no additional composition rule. Setup UI uses the same limits. Existing `bcryptjs` hashing uses cost 12. No shared policy or stored password was changed.

The installed bcryptjs documentation states its 72-byte UTF-8 input boundary; some accepted Unicode passwords can exceed that byte count despite the character limit. Recommendation: approve a consistent shared UTF-8 length guard or a deliberately planned alternative across all creation/reset/setup flows, with accurate client guidance and compatibility review. Do not silently change only checkout or invalidate existing login credentials. **Owner approval is required before implementing this policy change.**

## 10. Database/schema compatibility

Source schema and auth/booking/guest-access/linked-offer migration definitions were inspected. Relevant migrations include `20260930032758_init_p0_auth_settings`, `20261005193959_add_bookings`, `20261010150000_guest_booking_access` and `20261010193000_link_special_offers_to_tours`.

Expected existing contracts: unique normalized user email; CUSTOMER role; PENDING/ACTIVE/SUSPENDED; nullable password hash; hashed account setup tokens/type/expiry/usedAt; unique booking key/reference; nullable booking user ownership; guest-token hash/FK/expiry/revocation; activity note/internal flag; offer-tour foreign key; Decimal(10,2) snapshots and transactional engine support.

All new persistence metadata fits existing BookingActivity. No quote table, migration, data backfill or schema modification is required by this phase. **Source compatibility is not deployed compatibility.** No database was queried to confirm actual migrations, indexes, roles, engine/version, isolation or binlog configuration. Pre-existing schema working-tree changes were preserved and are not evidence of executed migrations.

## 11. Verification and commands

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Focused + neighboring tests | **368 passed, 26 files** | Mock persistence/providers/session functions; client hook harnesses and SSR; no real SQL/browser/SMTP |
| Added regression cases | **46 cases** | Price changes/expiry/tampering, replay/concurrency, legacy compatibility, errors/locales and rate/proxy/mode checks |
| TypeScript | **PASS**, exit 0 | Installed TypeScript, project configuration |
| Next.js webpack compile mode | **PASS**, exit 0 | Compile only, not full production prerender/generate/runtime |
| Browser/real database/real SMTP/session cookies | **NOT RUN** | Restricted; requires approved isolated verification |

Commands used from the application root:

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/next/dist/bin/next build --webpack --experimental-build-mode compile
node node_modules/vitest/vitest.mjs run <the 26 explicit files listed below>
```

```text
tests/booking-final-hardening.test.ts
tests/booking-request-hardening.test.ts
tests/booking-account-ui.test.ts
tests/checkout-account-security.test.ts
tests/checkout-account-route.test.ts
tests/checkout-consent-api.test.ts
tests/guest-booking-access.test.ts
tests/booking-selection-safety.test.ts
tests/booking-recovery-safety.test.ts
tests/booking-recovery-template.test.ts
tests/checkout-attempt-safety.test.ts
tests/checkout-flow-safety.test.ts
tests/cart-live-catalogue.test.ts
tests/cart-storage-resilience.test.ts
tests/booking-api-security.test.ts
tests/accounting-security.test.ts
tests/payments/checkout.test.ts
tests/tours-cache-lifecycle.test.ts
tests/tours-cache-refresh.test.ts
tests/tour-cache-race.test.ts
tests/guest-booking-email.test.ts
tests/email-delivery.test.ts
tests/email-smtp.test.ts
tests/special-offers.test.ts
tests/seo-static-metadata.test.ts
tests/tour-public-locale-render.test.ts
```

The original 21-suite independent-review set had 275 tests. Its set plus the two new suites now has 321 cases; three additional existing neighboring suites add 47, for 368 total. No unrelated full test runner or import script was executed. The existing Vite native-config warning remains non-failing. Rich-text/public EN/ES/IT SSR and SEO/offer regressions passed; this does not enable Arabic or certify browser presentation.

Whitespace inspection found one inherited trailing-space warning in a previously modified comment in `app/api/bookings/access/[token]/proof/route.ts`; it was preserved rather than silently cleaning unrelated work. No database/configuration or generated output was manually edited. Compile-mode verification passed; full generate/prerender remains intentionally unrun.

## 12. Browser/manual QA checklist — not executed

Use an approved isolated environment and a human tester; no live customer booking or real customer email.

- [ ] Desktop/mobile: initial amount unchanged, higher/lower price, same-total component change, extra repricing and discount expiry while page remains open.
- [ ] Dialog shows old/new USD totals and affected components; no auto-accept, toast-only prompt, browser alert or lost form/cart state.
- [ ] Keyboard focus starts at dialog content, Tab/Shift-Tab stay inside, Escape/close/review restore safe focus, long selections scroll at mobile widths.
- [ ] Price changes again after opening/accepting, quote expires, secret rotates, signature/selection/key/session changes: no unauthorized creation.
- [ ] Tour unpublishes/deletes: selected removal retains other items; price acceptance cannot bypass availability.
- [ ] Double click and lost response: same key creates one booking. Frozen read-only recovery and reload with matching contact recover safely after repricing/unpublishing.
- [ ] All products unavailable: new submission stays disabled but verification/recovery controls remain usable.
- [ ] New guest, authenticated customer, existing email, different signed-in identity, staff/suspended user and missing profile information behave correctly.
- [ ] Expired/replayed/wrong-booking proof, HTTP 429 with actual interval, temporary outage, network failure and session-creation failure show distinct EN/ES/IT guidance.
- [ ] Guest links stop authorizing after account linking; another user's dashboard and guessed reference reveal nothing private.
- [ ] Actual HTTPS cookie attributes, safe canonical links, private URL logging and email receipt/spam handling verified with the deployment team.
- [ ] Shore enquiry behavior, totals/discounts/unpriced extras, SEO/rich text and existing account confirm dialogs remain intact.

## 13. Isolated MySQL and SMTP integration plan — authorization required

**Do not run this plan under the current authorization.** It requires test writes and must not use `star_pyramids` or `star_pyramids_production`.

1. Owner approves an exact disposable database host/name such as `star_pyramids_booking_hardening_test_<run>` and a restricted test-only user. Keep existing application connection strings untouched; use a separate explicitly identified test process/configuration.
2. Owner separately authorizes creation of that disposable schema from reviewed existing definitions. Inspect every setup script; no production dump/customer data, seeds or silent migration against current databases. Verify constraints/roles/engine/binlog/isolation first.
3. Use synthetic accounts and fixture tours/extras/offers only. Verify actual shared-tour/offer locks, alias changes, absent/new offer FK contention, publication updates before/while waiting and timeout/deadlock rollback.
4. Exercise two separate database clients and application workers for duplicate keys, changed intents, legacy matching, pending-user unique-email contention, different-booking activation, concurrent suspension/staff assignment, proof replay and failed-link rollback.
5. Check original committed snapshots after price/discount/publication changes and failed responses. Verify one creation/receipt path, no replay token issuance and no payment/status transition from activation.
6. Explicitly test cross-worker rate overshoot and trusted edge header rewriting. Accept a documented soft-limit policy or authorize a separate distributed improvement; do not represent process-local reservations as global serialization.
7. Owner authorizes a sandbox SMTP sink or provider sandbox and test-only credentials. Block external delivery, use synthetic recipients, verify accepted/rejected/timeout outcomes, private URL correctness, no password delivery and credential redaction. No real SMTP was enabled here.
8. Validate real sessions/cookies and customer dashboard ownership through the approved manual browser checklist. Cleanup may remove only the explicitly approved disposable namespace after confirming its resolved target; never reset either existing application database.

## 14. Release gates, readiness and rollback

**Implemented and mock-tested:** explicit financial confirmation; independent replay; restricted guest acknowledgement; final transactional revalidation; preserved enrollment ownership; differentiated setup recovery; strict mode enum; scoped proxy behavior; process-local race reduction.

**Not integration-tested:** MySQL locks/unique indexes/FKs/isolation/deadlocks/binlog, real SMTP, actual browser/session cookies and production proxy topology. No independent external security sign-off is claimed. Self-review and regressions are complete; independent human release review remains appropriate for this sensitive change.

Required before production approval:

1. Provision/approve stable `BOOKING_QUOTE_SECRET` across instances; verify correct canonical HTTPS origin and clock synchronization.
2. Verify the edge contract before enabling `BOOKING_TRUST_PROXY_HEADERS=1`; otherwise the shared unknown-IP bucket can over-throttle users. Decide acceptable cross-worker rate-limit semantics.
3. Authorize and pass the isolated SQL/SMTP/manual plan. The code's transaction guarantees must not be advertised as real-engine proven yet.
4. Decide the shared password-policy recommendation. No unilateral policy change was made.
5. Review and include the full pending source dependency set below. Refresh older open checkout clients; missing acceptance context must not silently book. Release matching frontend/backend together.

Rollback is a reviewed code release, not data deletion. Retain completion/recovery support for already sent one-hour account links where feasible. Existing bookings, activation/link history, pending users and snapshots remain valid in the existing schema and must not be reset or blanket-cleaned. Do not remove security fixes merely to simplify rollback. Quote key rotation/release rollback may require a fresh customer price confirmation; committed-attempt recovery must remain available.

## 15. Release file manifest and preserved working tree

All paths are relative to `web-source`. This is the booking/enrollment dependency set, not permission to stage all dirty files. No files were staged. Review complete diffs because some listed files already contained earlier uncommitted work.

### Tracked source changes required from the combined pending work

```text
app/api/bookings/route.ts
app/api/bookings/request-access/route.ts
app/api/bookings/access/[token]/route.ts
app/api/bookings/access/[token]/proof/route.ts
app/api/bookings/access/[token]/documents/route.ts
app/api/bookings/access/[token]/documents/[documentId]/pdf/route.ts
app/booking/layout.tsx
components/account-portal.tsx
components/checkout-page.tsx
components/day-tour-detail.tsx
components/tour-detail.tsx
lib/booking.ts
lib/booking-selection.ts
lib/checkout-attempt.ts
lib/cart.ts
lib/customer-error-copy.ts
lib/server/booking-access.ts
lib/server/booking-recovery.ts
lib/server/bookings.ts
lib/server/email.ts
lib/server/special-offers.ts
lib/server/tours.ts
```

The day/tour capacity handling, guest access/recovery, email redaction and booking layout include retained previous work; they were not all newly edited in this phase.

### Required currently untracked source — do not omit

```text
app/api/bookings/account/route.ts
app/booking-account/page.tsx
components/booking-account-setup.tsx
components/customer-confirm-dialog.tsx
lib/account-setup-feedback.ts
lib/booking-price.ts
lib/server/booking-checkout.ts
lib/server/booking-quote.ts
lib/server/booking-request-security.ts
lib/server/checkout-account.ts
```

`checkout-account.ts` and the account route/page/UI existed locally before this phase. Activation predicates were retained; API/UI recovery was hardened. All files above are necessary alongside the new tracked imports.

### Changed regression files and required untracked tests/documentation

```text
tests/booking-selection-safety.test.ts                 tracked previous changes
tests/cart-storage-resilience.test.ts                 tracked previous changes
tests/checkout-attempt-safety.test.ts                  tracked, updated this phase
tests/checkout-flow-safety.test.ts                     tracked, updated this phase
tests/email-delivery.test.ts                          tracked previous changes
tests/guest-booking-access.test.ts                    tracked previous changes
tests/booking-account-ui.test.ts                      untracked, updated this phase
tests/checkout-account-route.test.ts                  untracked, updated this phase
tests/checkout-account-security.test.ts               untracked, retained
tests/checkout-consent-api.test.ts                    untracked, updated this phase
tests/booking-final-hardening.test.ts                 untracked, new
tests/booking-request-hardening.test.ts               untracked, new
docs/checkout-account-enrollment.md                   untracked, retained
docs/booking-enrollment-independent-review.md         untracked, retained
docs/booking-checkout-final-hardening.md              untracked, new
```

The 26 verification suites listed above also depend on existing tracked fixtures/setup. Existing rich-text implementation, unrelated changes, prepared tourism JSON/PDFs, SQL/client-transfer artifacts, backup/log files, local configuration and recovery material are not part of this release selection and were not removed or overwritten. Do not add the entire working tree or any `.env`, secrets, generated build output, database dumps or debug artifacts to a release.
