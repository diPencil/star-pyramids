# Root-level ownership cleanup — Phase 6

Inspected all 75 direct files across components/, lib/ and lib/server/, including static/dynamic imports, test mocks/readers and the previously identified external import/verification contracts. Four feature-owned files moved into existing folders. No new folder, wrapper, barrel or duplicate implementation was introduced.

## Before/after direct file counts

Counts include README, paired CSS and the protected user backup. These are snapshots for this phase, not historical Phase 3/4 counts.

| Root | Before | After | Moves |
| --- | ---: | ---: | ---: |
| components/ | 16 | 16 | 0 |
| lib/ | 34 | 32 | 2 |
| lib/server/ | 25 | 23 | 2 |

## Exact moves

| Original | Destination |
| --- | --- |
| `lib/auth-page-metadata.ts` | `lib/seo/auth-page-metadata.ts` |
| `lib/destination-public.ts` | `lib/catalogue/destination-public.ts` |
| `lib/server/payment-proofs.ts` | `lib/server/payments/payment-proofs.ts` |
| `lib/server/journey-video-storage.ts` | `lib/server/gallery/journey-video-storage.ts` |

The video service still delegates its storage root to mediaRootDir(); persistent files, keys and /gallery-videos URLs are unchanged. The payment-proof service still imports the existing central payments.ts orchestration entry. No stored data or uploads were read or written.

## File-by-file decisions

Paths below are relative to the app root. Consumer counts cover unique source/test/script imports and re-exports, including literal dynamic imports. They do not imply that a file with zero imports is disposable. External pins and protected backup ownership are recorded separately.

### components/

| Original file | Decision | Ownership | Consumers (examples) | Reason |
| --- | --- | --- | --- | --- |
| `auth-pages.tsx` | KEEP | Public compatibility entry | 2; `app/login/page.tsx`, `app/register/page.tsx` | Established login/register composition entry used by both auth routes; keep the public entry stable. |
| `authenticated-user.tsx` | KEEP | Shared infrastructure | 4; `app/account/layout.tsx`, `components/account/account-custom-trip.tsx` | Sitewide authenticated-user provider shared by layouts, account pages and header. |
| `brand-context.tsx` | KEEP | Shared infrastructure | 3; `app/layout.tsx`, `lib/admin-store.ts` | Root-layout-seeded branding provider shared by public and admin consumers. |
| `brand-favicon.tsx` | KEEP | Shared infrastructure | 2; `app/layout.tsx`, `tests/brand-settings-integration.test.ts` | Global document/favicon integration attached to the branding provider. |
| `brand-icons.tsx` | KEEP | Shared infrastructure | 2; `app/admin/settings/page.tsx`, `components/auth-pages.tsx` | Brand/social primitives shared by authentication and admin settings. |
| `brand-mark.tsx` | KEEP | Shared infrastructure | 10; `components/account/account-portal.tsx`, `components/account/shared/account-shell.tsx` | Shared brand identity primitive used by account, admin and public UI. |
| `consent-manager.module.css` | KEEP | Shared infrastructure | 1; `components/consent-manager.tsx` | Paired CSS for the stable sitewide consent entry; keep the pair together. |
| `consent-manager.tsx` | KEEP | Shared infrastructure | 2; `app/layout.tsx`, `tests/consent-manager.test.ts` | Sitewide consent/security integration mounted on both public and protected routes. |
| `extended-pages.tsx` | KEEP | Public compatibility entry | 28; `app/about/page.tsx`, `app/blogs/page.tsx` | Public compatibility export entry preserved through Phase 5B; implementations already feature-owned. |
| `homepage_backup.txt` | KEEP | Externally pinned / protected | 0; no code consumer required | Unique pre-existing user backup; protected and retained without reading its contents. |
| `impersonation-banner.tsx` | KEEP | Shared infrastructure | 1; `components/account/legacy-account-page.tsx` | Staff-preview integration shared with legacy account presentation; preserve security entry. |
| `locale.tsx` | KEEP | Shared infrastructure | 118; `app/admin/emails/page.tsx`, `app/admin/inbox/page.tsx` | Global locale/currency context and formatting API used across most features. |
| `README.md` | KEEP | Shared infrastructure | 0; no code consumer required | Directory ownership entry guide. |
| `site-measurement.tsx` | KEEP | Shared infrastructure | 2; `app/layout.tsx`, `tests/site-measurement.test.ts` | Global tracking lifecycle entry; retain approved consent/URL boundary and GTM mount. |
| `site.tsx` | KEEP | Public compatibility entry | 47; `app/egypt-tours/multi-days-tours/page.tsx`, `app/egypt-tours/multi-days-tours/[category]/page.tsx` | Public compatibility entry and remaining cross-feature page compositions; no additional wrapper. |
| `staff-preview-bootstrap.tsx` | KEEP | Shared infrastructure | 1; `app/account/layout.tsx` | Protected account-layout preview initialization; stable security integration. |

### lib/

| Original file | Decision | Ownership | Consumers (examples) | Reason |
| --- | --- | --- | --- | --- |
| `admin-store.ts` | KEEP | Shared infrastructure | 30; `app/admin/blogs/new/page.tsx`, `app/admin/customers/[key]/content.tsx` | Mixed settings/brand/preview/catalogue facade shared by public and admin; no single feature owner. |
| `auth-page-metadata.ts` | MOVE | Feature-owned | 5; `app/forgot-password/page.tsx`, `app/login/page.tsx` | Pure metadata for four authentication routes, with five current consumers; fits existing SEO metadata helpers. Destination: `lib/seo/auth-page-metadata.ts`. |
| `auth-types.ts` | KEEP | Shared infrastructure | 7; `app/admin/profile/page.tsx`, `components/authenticated-user.tsx` | Shared authentication contracts across client/server and account/admin boundaries. |
| `brand-settings.ts` | KEEP | Shared infrastructure | 4; `components/brand-context.tsx`, `lib/admin-store.ts` | Shared public/admin branding validation and defaults. |
| `catalogue-translations.ts` | KEEP | Externally pinned / protected | 44; `app/admin/blogs/new/page.tsx`, `app/admin/destinations/new/page.tsx` | DESTINATIONS_REAL_TOURS_VERIFICATION/validate-v3.cjs consumes this exact module path. |
| `country-label.ts` | KEEP | Shared infrastructure | 3; `components/shared/forms/country-select.tsx`, `components/shared/forms/international-phone-input.tsx` | Shared localized country labels for multiple controls and features. |
| `currency.ts` | KEEP | Shared infrastructure | 36; `app/admin/bookings/page.tsx`, `app/admin/bookings/[ref]/content.tsx` | Shared currency/money contracts used by booking, car, payment and display code. |
| `date-calendar.ts` | KEEP | Shared infrastructure | 4; `app/admin/dashboard/page.tsx`, `components/account/account-custom-trip.tsx` | Shared calendar/date utility for dashboard and unrelated request/date controls. |
| `destination-builder.ts` | KEEP | Externally pinned / protected | 5; `app/admin/destinations/new/page.tsx`, `components/admin/destinations/destination-builder-preview.tsx` | External destination verification imports this exact module path; only its dependency import is updated. |
| `destination-public.ts` | MOVE | Feature-owned | 5; `app/destinations/[slug]/page.tsx`, `components/content/destination-pages.tsx` | Destination visibility/association read helpers; belongs beside existing catalogue clients; no direct external pin found. Destination: `lib/catalogue/destination-public.ts`. |
| `destination-write.ts` | KEEP | Externally pinned / protected | 8; `app/admin/destinations/new/page.tsx`, `app/api/destinations/route.ts` | External destination verification imports its validation API at this exact path. |
| `documents.ts` | KEEP | Public compatibility entry | 4; `app/admin/bookings/[ref]/content.tsx`, `components/account/bookings/booking-sections.tsx` | Shared commercial-document contract used by booking UI and financial/document services; stable contract entry. |
| `json-text.ts` | KEEP | Externally pinned / protected | 24; `app/api/blogs/route.ts`, `app/api/blogs/[slug]/route.ts` | External REAL_TOURS batch tooling reads this exact source/symbol path. |
| `locale-config.ts` | KEEP | Externally pinned / protected | 98; `app/admin/inbox/page.tsx`, `app/admin/settings/page.tsx` | Global language contract plus externally extracted source path; preserve both. |
| `locale-helpers.ts` | KEEP | Shared infrastructure | 1; `components/auth-pages.tsx` | Generic locale fallback API; one current consumer does not make it auth business logic. |
| `payment.ts` | KEEP | Public compatibility entry | 16; `app/account/payments/detail/page.tsx`, `app/admin/bookings/[ref]/content.tsx` | Established financial/payment contract entry used by UI, services and gateways. |
| `phone.ts` | KEEP | Shared infrastructure | 9; `app/admin/event-requests/detail/content.tsx`, `app/admin/settings/page.tsx` | Cross-feature phone parsing, normalization and display infrastructure. |
| `query.ts` | KEEP | Shared infrastructure | 5; `app/make-your-trip/trip-request-planner.tsx`, `components/cars/car-pages.tsx` | Shared URL/query parsing contracts spanning catalogue, search and forms. |
| `README.md` | KEEP | Shared infrastructure | 0; no code consumer required | Library ownership and server/client boundary guide. |
| `record-seo.ts` | KEEP | Externally pinned / protected | 28; `app/api/admin/website-cms/seo/records/[kind]/[slug]/preview/route.ts`, `app/api/admin/website-cms/seo/records/[kind]/[slug]/route.ts` | External REAL_TOURS tooling reads exact source/symbol path; preserve despite clear SEO ownership. |
| `seo-content.ts` | KEEP | Externally pinned / protected | 11; `app/api/admin/website-cms/seo/[pageKey]/route.ts`, `components/admin/seo/seo-manager.tsx` | External REAL_TOURS tooling reads exact source/symbol path; preserve despite clear SEO ownership. |
| `site-copy.ts` | KEEP | Shared infrastructure | 7; `components/layout/site-header.tsx`, `components/shared/shared-help-cta.tsx` | Cross-feature navigation/footer/form/search copy facade. |
| `staff-preview-client.ts` | KEEP | Shared infrastructure | 1; `components/impersonation-banner.tsx` | Shared preview/security state and account hooks; stable boundary. |
| `tour-json.ts` | KEEP | Externally pinned / protected | 13; `app/admin/destinations/new/page.tsx`, `app/api/tours/route.ts` | REAL_TOURS import/update tools consume exact module path. |
| `tour-public-locale.ts` | KEEP | Externally pinned / protected | 5; `components/tours/detail/day-tour-detail.tsx`, `components/tours/detail/tour-detail.tsx` | REAL_TOURS and destination verification consume exact source/module path. |
| `tour-publish.ts` | KEEP | Externally pinned / protected | 18; `app/admin/trips/page.tsx`, `app/api/tours/route.ts` | External import/batch tools consume exact source/module path. |
| `tour-translations.ts` | KEEP | Externally pinned / protected | 7; `components/admin/trip-builder.tsx`, `components/tours/detail/tour-detail.tsx` | External batch validator extracts exact source/symbol path. |
| `tour-write.ts` | KEEP | Externally pinned / protected | 7; `app/api/tours/route.ts`, `app/api/tours/[slug]/route.ts` | REAL_TOURS import/update tools consume exact validation/write contract path. |
| `tours-client.ts` | KEEP | Externally pinned / protected | 29; `app/admin/destinations/new/page.tsx`, `app/admin/multi-day-categories/new/page.tsx` | External batch tooling extracts resolveTours from this exact source path. |
| `trip-builder-destinations.ts` | KEEP | Externally pinned / protected | 3; `components/admin/trip-builder.tsx`, `tests/trip-builder-destinations-portable.test.ts` | External destination verification imports exact module path. |
| `trip-builder-preview.ts` | KEEP | Externally pinned / protected | 7; `components/admin/tours/trip-builder-preview.tsx`, `components/admin/trip-builder.tsx` | External batch tooling extracts preview declarations from this exact source path. |
| `use-current-user.ts` | KEEP | Shared infrastructure | 15; `app/admin/bookings/[ref]/content.tsx`, `app/admin/destinations/new/page.tsx` | Shared public/account/admin authentication hook. |
| `utils.ts` | KEEP | Externally pinned / protected | 7; `app/admin/inbox/page.tsx`, `app/admin/settings/page.tsx` | Shared cn utility and components.json alias target. |
| `website-heroes.ts` | KEEP | Externally pinned / protected | 35; `app/admin/website-cms/hero-sections/homepage/page.tsx`, `app/admin/website-cms/hero-sections/page.tsx` | External batch tooling extracts hero validation declarations from this exact source path. |

### lib/server/

| Original file | Decision | Ownership | Consumers (examples) | Reason |
| --- | --- | --- | --- | --- |
| `auth-navigation.ts` | KEEP | Shared infrastructure | 2; `app/api/auth/login/route.ts`, `app/api/auth/register/route.ts` | Central post-auth redirect policy used by login/register handlers. |
| `auth.ts` | KEEP | Shared infrastructure | 110; `app/admin/notifications/page.tsx`, `app/admin/website-cms/layout.tsx` | Central authentication/RBAC entry shared by more than one feature. |
| `brand-settings.ts` | KEEP | Shared infrastructure | 2; `app/layout.tsx`, `tests/brand-server.test.ts` | Global server-seeded branding service for root/public/admin initialization. |
| `csrf.ts` | KEEP | Shared infrastructure | 86; `app/api/account/bookings/[ref]/proof/route.ts`, `app/api/account/bookings/[ref]/route.ts` | Shared request-origin security boundary. |
| `db.ts` | KEEP | Shared infrastructure | 112; `app/api/account/bookings/[ref]/documents/route.ts`, `app/api/admin/bookings/[ref]/documents/route.ts` | Central Prisma singleton; do not relocate or initialize for this task. |
| `document-pdf.ts` | KEEP | Public compatibility entry | 5; `app/api/account/bookings/[ref]/documents/[documentId]/pdf/route.ts`, `app/api/admin/bookings/[ref]/documents/[documentId]/pdf/route.ts` | Established document/PDF service entry with runtime public/font asset assumptions; renderer is already in pdf/. |
| `documents.ts` | KEEP | Public compatibility entry | 13; `app/api/account/bookings/[ref]/documents/route.ts`, `app/api/admin/bookings/[ref]/documents/route.ts` | Established commercial-document orchestration/public service contract; preserve issuance/access boundary. |
| `email-smtp.ts` | KEEP | Shared infrastructure | 3; `app/api/admin/emails/route.ts`, `lib/server/email.ts` | Cross-feature SMTP transport and credentials boundary. |
| `email.ts` | KEEP | Shared infrastructure | 20; `app/api/admin/emails/route.ts`, `app/api/auth/forgot-password/route.ts` | Cross-feature transactional mail/templates/delivery orchestration. |
| `errors.ts` | KEEP | Shared infrastructure | 3; `lib/server/payments/checkout.ts`, `lib/server/webhooks/handler.ts` | Shared server/gateway error contract. |
| `fx.ts` | KEEP | Shared infrastructure | 1; `lib/server/settings.ts` | Shared exchange-rate infrastructure used by central financial settings. |
| `guards.ts` | KEEP | Shared infrastructure | 9; `app/account/layout.tsx`, `app/admin/layout.tsx` | Central authentication/RBAC and preview guards. |
| `journey-video-storage.ts` | MOVE | Feature-owned | 3; `app/api/admin/website-cms/hero-media/route.ts`, `app/api/media/route.ts` | Gallery-specific MP4/WebM storage service; fits existing gallery service folder; media root and URL/key algorithms unchanged. Destination: `lib/server/gallery/journey-video-storage.ts`. |
| `locale.ts` | KEEP | Shared infrastructure | 9; `app/egypt-tours/[slug]/page.tsx`, `app/forgot-password/page.tsx` | Shared request locale resolver for root layout and public/auth pages. |
| `logging.ts` | KEEP | Shared infrastructure | 1; `lib/server/webhooks/handler.ts` | Shared server/security logging boundary, including payment/webhook callers. |
| `media.ts` | KEEP | Shared infrastructure | 6; `app/api/admin/website-cms/hero-media/route.ts`, `app/api/avatar/route.ts` | Shared image/upload storage service for avatars and CMS/catalogue media; runtime paths stable. |
| `payment-proofs.ts` | MOVE | Feature-owned | 5; `app/api/account/bookings/[ref]/proof/route.ts`, `app/api/admin/bookings/[ref]/route.ts` | Payment-proof validation and authorization service; fits existing server/payments/ beside checkout. Destination: `lib/server/payments/payment-proofs.ts`. |
| `payments.ts` | KEEP | Public compatibility entry | 22; `app/api/account/payments/route.ts`, `app/api/account/payments/[ref]/route.ts` | Public financial orchestration entry shared by bookings, documents and gateway services; preserve stable contract. |
| `rate-limit.ts` | KEEP | Shared infrastructure | 13; `app/api/account/payments/route.ts`, `app/api/auth/change-password/route.ts` | Cross-feature abuse protection across auth, bookings, enquiries and payments. |
| `request-json.ts` | KEEP | Shared infrastructure | 5; `app/api/bookings/account/route.ts`, `app/api/bookings/confirmation/route.ts` | Shared bounded request-body parser. |
| `session.ts` | KEEP | Shared infrastructure | 10; `app/api/auth/change-password/route.ts`, `app/api/auth/login/route.ts` | Central HttpOnly session lifecycle/security entry. |
| `settings.ts` | KEEP | Shared infrastructure | 10; `app/api/admin/settings/route.ts`, `app/api/admin/tracking-health/route.ts` | Shared CMS/runtime/secret settings persistence boundary. |
| `staff-preview.ts` | KEEP | Shared infrastructure | 23; `app/api/account/bookings/route.ts`, `app/api/account/bookings/[ref]/documents/route.ts` | Server preview authorization shared by public, account and admin flows. |
| `upload-form.ts` | KEEP | Shared infrastructure | 3; `app/api/admin/website-cms/hero-media/route.ts`, `app/api/media/route.ts` | Shared bounded multipart parser for image and video upload endpoints. |
| `users.ts` | KEEP | Shared infrastructure | 20; `app/account/layout.tsx`, `app/api/account/profile/route.ts` | Central user/role/account lifecycle and public-user projections. |

## Boundaries and verification

- components/ is intentionally unchanged: remaining direct files are global providers/security mounts, established public entries, directory guidance or the protected user backup.
- External REAL_TOURS and destination tooling module/symbol paths remain in place; no operational script was executed. The retained destination-builder import now resolves its relocated dependency normally.
- The source manifest preserves every prior relocation record and appends four Phase 6 operations with before/after SHA-256 values. Import rewrites necessarily change raw hashes; reversing only approved path literals reconstructs the original source hashes exactly.
- Automated reconstruction checked 947 existing source files: 24 files changed only in references, with zero non-path source changes. Both verification batches passed TypeScript and focused tests (81 and 109 tests).
- GTM commit 7993c03, loader bytes, consent boundaries and all earlier modularized declarations remain preserved.
- Final default full suite ran once: **3283 passed, 0 failed, 1 skipped**, across **243 passed test files and 1 skipped file** (387.66 seconds). Import/cycle/case checks covered **3836 references across 934 source/test/script files**, with no broken imports, casing mismatches, runtime cycles or client-to-server leaks. All **314 live relocation hashes** match. Git HEAD/index, unrelated work, GTM loader bytes, previous modularizations, central security/booking services, Prisma and configuration are preserved. `git diff --check` passed. Browser checks, database integration tests and production builds were not run.
