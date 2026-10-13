# EN / ES / IT localization implementation

## Verified batch 1: language controls and customer authentication errors

- Existing owners remain `components/locale.tsx`, `lib/locale-config.ts`,
  `tx` / `pickLocaleText`; no second locale provider or translation framework.
- `components/language-selector.tsx`: localized currency/region names and
  open/close accessible names. Currency codes and language self-names retained.
- `lib/customer-error-copy.ts`: EN/ES/IT presentation of 27 known customer API
  errors using the existing picker. Unknown ES/IT errors use the caller's
  translated safe fallback; API responses and validation rules are unchanged.
- Consumers: login, registration, password recovery/reset, account password
  changes and notification-loading error. No auth, notification-cache, database
  or delivery behavior changed.
- `tests/customer-localization.test.ts`: eight database-independent checks for
  nonempty values, placeholder consistency, literal auth API error coverage,
  unknown-response fallback, language control rendering and disabled Arabic.

Browser: anonymous `/login`, EN -> ES -> IT -> EN. Italian preference survived
refresh after hydration. Italian language modal fits 375/768/1440px without page
overflow. No credentials entered and no authentication form submitted.

Validation: TypeScript passed; five relevant test files passed (39 tests),
including eight new tests. Existing `test:unit` passed (23 files, 257 tests).
The full `pnpm build` failed in Prisma generation with Windows EPERM on the
query-engine DLL. Standalone Next Webpack compilation and TypeScript passed and
generated 254/254 pages; final build status is recorded in the task response.

## Verified batch 2: checkout, offline proofs and account failure states

- Extended shared error copy for booking selections, dates, traveler limits,
  contact details, cart limits, offline proof validation/rate limits, booking
  cancellation and account booking/payment/car/event request loading failures.
- Checkout and offline proof API failures now use translated presentation.
  Payment-reference example is localized; request payloads, guest-token paths,
  pricing, idempotency, permissions and offline settlement rules are unchanged.
- Account booking/payment/request not-found states, loading failures and support
  message failures use current-locale error presentation. Financial-review
  cancellation handling remains separate and unchanged.
- Login and registration keep API error identity until rendering, so visible
  API errors follow subsequent language changes. Social preview notices and
  the existing Arabic password-mismatch message are retained.
- Browser: Spanish selection persisted across `/login` -> `/register` navigation.
  No form submitted, account created, booking/payment mutated or email sent.
- Validation: relevant selection passed 52 tests; localization file now has 22
  tests. Existing safe unit selection passed 257 tests. TypeScript and diff
  whitespace check passed. Full package build remains blocked by Prisma DLL
  EPERM; standalone Next Webpack compile/TypeScript passed (final status in reply).

## Verified batch 3: country labels, server hydration and auth metadata

- `lib/country-label.ts` uses built-in Intl region display names for ES/IT;
  English/Arabic source names, ISO codes, order and calling codes are retained.
  Shared country picker and international phone accessible names use it.
- `components/locale.tsx` now seeds existing mutable locale providers from the
  server through a read-only initial context in `app/layout.tsx`. It is not a
  second mutable locale store and does not replace the current architecture.
- Explicit choices synchronize localStorage and a host-only SameSite=Lax
  preference cookie (Secure on HTTPS). Existing localStorage choices migrate to
  the cookie after hydration; their first migration request cannot be localized
  server-side because localStorage is not sent to the server. Blocked browser
  storage no longer interrupts preference loading/switching.
- `lib/auth-page-metadata.ts` and login/register/forgot/reset route metadata now
  use the existing server locale. Private noindex/nofollow/nocache is preserved.
- `tests/locale-preferences.test.ts`: 13 checks cover all canonical country
  labels, immutable identities, cookie round trips/rejection, server-rendered
  initial locale and the four auth metadata variants.
- Browser confirmed ES and IT immediately after register-page reload, localized
  titles (`Crear cuenta` / `Crea un account`) and `Egipto` / `Egitto`, including
  the phone control name. Italian 375px registration had no page overflow.
- Validation: 39 relevant tests passed (13 preference, 22 customer-copy and 4
  catalogue-language), 257 existing unit tests passed; TypeScript passed. Full
  package build still fails at the locked Prisma DLL. Standalone Next Webpack
  final status is recorded in the task reply. No forms submitted or data changed.

## Verified batch 4: essential customer-facing UI

- `components/live-chat.tsx`: ES/IT no longer alias English copy or force English
  reply selection. Existing scripted greetings, topics, prices, booking guidance,
  contact actions and fallback replies are localized, with ES/IT keyword matching
  and time formatting. This remains the existing scripted assistant, not a new
  staffed chat/WhatsApp integration. Existing message history is preserved.
- `components/tour-detail.tsx`: translated previously hardcoded itinerary,
  inclusion-confirmation and separately-quoted add-on notices; completed missing
  review-title/example and tailored-experience UI labels. Author-written tour
  content and financial rules are not rewritten.
- Contact enquiry, event submission and custom-trip account loading/editing/
  cancellation errors now use translated presentation. Known contact API errors
  have exact EN/ES/IT copy without changing payloads, validation or retry IDs.
- `tests/essential-localization.test.ts`: 18 tests exercise scripted assistant
  topics in ES/IT, retained EN/AR behavior, price interpolation, contact API error
  coverage and AST checks for EN/ES/IT inline UI copy and literal tour UI lookups.
  The first test run exposed two test-harness mistakes (price detection also
  matched `prenotare`, and quoted property names were not normalized); both were
  corrected without weakening the intended assertions.
- Validation: 53 localization tests and 257 existing safe unit tests passed;
  TypeScript and diff check passed. Full package build remains blocked by the
  Windows Prisma DLL lock; standalone Next Webpack final status is in the reply.
- Browser: Spanish assistant greeting, topic buttons and input/close controls
  displayed correctly; phone viewport 375px had no page overflow and the panel
  stayed within the viewport. No message/contact/event/booking form submitted.

## Confirmed remaining scope, not completed claims

| Area | Evidence | Required next batch |
| --- | --- | --- |
| Admin localization policy | `components/admin/admin-locale.tsx` supports EN/AR and maps ES/IT to EN | Preserve current policy; do not add ES/IT admin UI without a product-policy decision. Content translation tabs are separate from admin UI language. |
| Remaining locale persistence checks | Cookie/client seed synchronization now implemented and verified for ES/IT registration refresh | Verify all route families, late admin defaults, pre-existing localStorage migration, blocked-storage runtime and immediate metadata refresh on live language changes; do not claim every route checked. |
| Customer emails | `lib/server/email.ts` default subjects/bodies are English; `lib/customer-account.ts` stores preferredLanguage only in browser profile JSON; `User` in `prisma/schema.prisma` has no preferred language field | Establish a durable recipient-language source for later staff-triggered events, then localize templates/outbox without overwriting custom content or deduplication. Do not infer language from country or the acting staff member. |
| Booking PDFs | `lib/server/pdf/render.ts` contains English labels; `lib/documents.ts` already translates the six document-type labels | Localize PDF model/render labels without changing commercial snapshots, figures, authorization or document layout. Translated type labels are not translated PDFs. |
| Notifications | `lib/server/notifications.ts` persists supplied title/message; customer panel displays them | Trace each producer and locale preference; the loading error fix does not translate persisted notification content. |
| Remaining customer feedback | `components/account-portal.tsx` profile/avatar feedback, separate trip request components and public request forms still require a full response-code inventory | Continue boundary-specific translation; runtime database-dependent failure paths are not verified by pure copy/source tests. Checkout/proof and some cancellation errors still store translated text at response time, so live-language switching with visible feedback needs further coverage. |
| Auth social notices | Login/registration API errors now follow current locale, but social preview notice strings are still formed when clicked | Verify live switching with social notices; no real OAuth flow is claimed. |
| Other country-name consumers and public metadata | Shared country/phone pickers and four auth metadata routes now fixed; public route-specific metadata and direct country.name consumers are not all inventoried | Complete the remaining public/account metadata and display consumers; current-page metadata updates after server navigation/reload, not necessarily immediately on client locale selection. |
| Catalogue/editorial data | `lib/catalogue-translations.ts`, `lib/server/catalogue-translations.ts` intentionally retain English when author translations are absent | Read-only content completeness report per record/field is still needed; no database translations were fabricated or overwritten. |
| Content editors | Existing tabs in blogs, destinations, events, multi-day categories, offers and `components/admin/vehicle-form.tsx` | Audit all remaining fields, gallery/promotion editors, tour translations and repeatable sections against their models. |
| Other route families | Public, account and admin have not all been individually tested in all three locales | Complete per-route text inventory, accessibility labels, counts/plurals, dates, mobile/desktop and protected journey QA in coherent batches. |

No full-platform or essential-journey 100% claim. No authenticated browser
session available; protected account/admin flows remain visually unverified.
No record-level translation completeness has been asserted without reading
the records. No schema/environment edits, database writes, dependency changes,
commits, pushes or deployments performed in this localization batch.
