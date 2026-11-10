# Account portal modularization — Phase 5C

The original `components/account/account-portal.tsx` entry point and all **13 runtime exports** remain. Its `AccountSection` type and retained owner components keep their original declarations. No application consumer imports change.

## Extracted modules

| Module | Responsibility | Lines |
| --- | --- | ---: |
| `components/account/shared/account-hooks.tsx` | Existing per-call impersonation/inquiry/profile hooks; no new state owner or provider | 64 |
| `components/account/shared/account-ui.tsx` | Avatar, metrics, support/actions, empty state and pagination presentation | 79 |
| `components/account/shared/account-notifications.tsx` | Existing customer notification mapping/dropdown | 55 |
| `components/account/bookings/booking-sections.tsx` | Booking API helpers/hooks, list/cards, documents, owner and guest detail sections | 579 |
| `components/account/cars/car-request-sections.tsx` | Existing car-request list/detail/cancel presentation and helpers | 345 |
| `components/account/favorites/favorites-section.tsx` | Saved-trip list and shared compact tour card | 43 |
| `components/account/overview/overview-section.tsx` | Overview composition and enrollment-completion notice | 75 |
| `components/account/payments/payment-sections.tsx` | Payment list/detail loading and presentation | 163 |
| `components/account/support/messages-section.tsx` | Existing customer support/message composition and drafts | 135 |
| `components/account/profile/profile-settings.tsx` | Profile, preferences and password-change forms | 274 |

**51 declarations** moved unchanged; **10 declarations** deliberately remain at the entry point. All 61 original declaration texts compare exactly, including props, type annotations, hook calls/dependencies, callback bodies, JSX, URLs, validation, status/permission logic and translations. There are no duplicate implementations or wrappers. Internal feature exports support existing owner components without extending the public portal export surface.

## Size

- Before: **1902 lines**.
- After: **293 lines**.
- Reduction: **1609 lines (84.60%)**.
- Counts include the final empty line consistently. New-module counts include necessary imports/client directives; this is not a bundled-code-size claim.

## Preserved public surface

`AccountShell`, `BookingDetailPage`, `CarRequestDetailPage`, `CustomerAccountPage`, `CustomerConfirmDialog`, `CustomerPagination`, `EmptyState`, `GuestBookingPage`, `PaymentDetailPage`, `useCustomerBookings`, `useImpersonated`, `useVisibleBookings`, `useVisibleInquiries`.

`AccountSection` remains the same exported union type in the original file. Existing hook and shared-UI exports forward the identical feature-module functions. The confirmation-dialog re-export remains the existing implementation. Public booking, guest booking, car-request and payment detail page wrappers stay at the entry point unchanged.

## State/provider and security boundaries

- `AccountShell` remains at its original ownership level, with exactly the same auth checks, hooks, drawer/session/logout behavior and JSX. Navigation data (`sectionLinks`, `sectionHeadings`) stays with it. Extracting navigation markup into new prop-driven components was deliberately not attempted.
- `CustomerAccountPage` remains the original section dispatcher, including dedicated trip/event request wiring, profile/settings/password behavior and provider tree. No section mapping or fallback changes.
- `BookingDetailPage`, `GuestBookingPage`, `CarRequestDetailPage`/`CarRequestDetailHeader` and `PaymentDetailPage` retain their original provider/layout ownership. No client credential is moved into a server prop. The guest section still reads its credential from the client router exactly as before.
- Hook **definitions** move, but every caller, hook ordering, state initializer and dependency array remains unchanged. Each existing component/hook call still creates its own same state; no state is lifted, shared in a new singleton, or moved into a new provider/context. `useAccountProfile` keeps its memoized identity behavior.
- All feature sections retain their existing props and internal state. No new prop plumbing, callbacks, reducers or data flow is introduced.
- API request bodies, credentials, owner-reference/token handling, financial-review/cancel/error behavior and booking/payment rules remain unchanged. Server authentication, authorization, ownership services, routes and database code are untouched.
- All new component modules retain `use client`. No feature module imports the portal entry point directly or transitively. Existing mutual compatibility wiring with dedicated trip/event request pages is unchanged, rather than restructured in this task.

## Intentionally retained/large sections

The entry point retains AccountSection, navigation data/headings, AccountShell, CustomerAccountPage and public detail-page wrappers plus the car detail header. AccountShell remains about 137 lines. The booking feature (579 lines), car-request feature (345 lines) and profile/settings forms (274 lines) deliberately keep their original detailed callbacks and per-component state intact. Further splitting of those forms/services requires a separate reviewed change; it is not required to preserve the current architecture boundaries.

## Regression and source-reader checks

- The new compatibility suite checks the complete public export set, dialog and extracted public-function identity, and exact feature identity beneath the original LocaleProvider/AccountShell for all nine account sections.
- Existing account route/detail/navigation, booking ownership/guest access, car, favorites, payment proof/offline payment, notification, support and localization tests remain in use. No security assertion is weakened.
- Negative account-copy and offline-payment source guards inspect the entire original-plus-extracted source set. Error-localization and essential EN/ES/IT copy coverage similarly follows all extracted implementations; assertions are retained.
- Focused tests passed after every extraction: **146, 119, 61, 217, 198, 65, 79, 167, 114, 136** in stage order. TypeScript passed after every extraction, using a temporary incremental cache inside the ignored QA directory.
- The full configured suite ran once after all extractions: **3250 passed, zero failed, one skipped**, across 241 passed test files and one skipped file (93.91 seconds). This includes 14 new compatibility/provider/section-identity regression tests.

## Metadata and safety

The source-organization manifest keeps all historical relocation paths/checksums. Only the live currentSha256 for the modified portal entry is refreshed, with a separate Phase 5C modularization note; declaration extractions do not add file-move history.

No database operation/connection, Prisma/schema/migration, environment/dependency/deployment configuration change, browser test, production build, commit, push or deployment. Test processes use the existing isolated mocks and an unusable database URL. Existing tracked/untracked work, prior modularizations and Git HEAD/index are preserved. Live browser/production database behavior was not exercised.

Final verification resolved 3763 local import edges without missing modules. Extracted modules have no direct/transitive dependency on account-portal.tsx. All 61 original named declarations match exactly (51 extracted, 10 retained). Existing baseline work remains preserved; git diff --check passes and Git HEAD/index are unchanged.
