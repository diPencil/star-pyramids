> Latest authentication/payment grouping: [Phase 13](source-organization-phase13.md), following [Phase 12 branding](source-organization-phase12.md), [Phase 11 server grouping](source-organization-phase11.md), [Phase 10 utility/contracts](source-organization-phase10.md), [Phase 9](source-organization-phase9.md), [Phase 8](source-organization-phase8.md), [Phase 7](source-organization-phase7.md) and [Phase 6](source-organization-phase6.md). See also [Phase 4 internal organization](source-organization-phase4.md) and the Phase 5 modularization reports. The Phase 3 report below is a historical snapshot; use currentPath in the cumulative manifest for live paths.

# Feature-based source organization — Phase 3

Phase 3 moved **131 new files** in five verified batches, following the preceding 98 moves. Cumulative total: **229 files**. No previous move was repeated. All paths below are relative to the application root.

## Phase 3 before/after counts

| Root | Before | After | New moves |
| --- | ---: | ---: | ---: |
| `components/` | 52 | 15 | 37 |
| `lib/` | 96 | 33 | 63 |
| `lib/server/` | 56 | 25 | 31 |

Counts above exclude existing directory README files and include the preserved user backup. All-file counts including README are recorded in the manifest and trees.

## Before Phase 3

```text
components/
  account/
  admin/
  booking/
  cms/
  home/
  layout/
  reviews/
  tours/
  ui/
  [root files including README: 53]

lib/
  account/
  booking/
  cms/
  core/
  payments/
  reviews/
  server/
  tracking/
  [root files including README: 97]

lib/server/
  account/
  booking/
  cms/
  payments/
  pdf/
  reviews/
  tracking/
  webhooks/
  [root files including README: 56]
```

## After Phase 3

```text
components/
  account/
  admin/
  booking/
  cars/
  cms/
  content/
  enquiries/
  events/
  home/
  layout/
  notifications/
  offers/
  reviews/
  shared/
  support/
  tours/
  ui/
  [root files including README: 16]

lib/
  account/
  admin/
  analytics/
  booking/
  cars/
  catalogue/
  cms/
  core/
  editorial/
  enquiries/
  events/
  gallery/
  home/
  marketing/
  navigation/
  notifications/
  offers/
  payments/
  reviews/
  seo/
  server/
  support/
  tours/
  tracking/
  trip-builder/
  ui/
  [root files including README: 34]

lib/server/
  account/
  analytics/
  booking/
  cars/
  catalogue/
  cms/
  editorial/
  enquiries/
  events/
  gallery/
  marketing/
  navigation/
  notifications/
  offers/
  payments/
  pdf/
  reviews/
  seo/
  support/
  tracking/
  trip-builder/
  webhooks/
  [root files including README: 25]
```

## Phase 3 exact moves

Original filenames and implementation are preserved. SHA-256 values in [the relocation manifest](source-organization-manifest.json) distinguish initial bytes from necessary import-path updates. Earlier 98 entries retain their original hashes; `currentSha256` records their current bytes after dependency-reference updates.

| Original | Destination |
| --- | --- |
| `components/car-quote-summary.tsx` | `components/cars/car-quote-summary.tsx` |
| `components/car-quote-summary.css` | `components/cars/car-quote-summary.css` |
| `components/empty-fleet-hero.tsx` | `components/cars/empty-fleet-hero.tsx` |
| `lib/car-pricing-admin.ts` | `lib/cars/car-pricing-admin.ts` |
| `lib/car-pricing.ts` | `lib/cars/car-pricing.ts` |
| `lib/car-quote-client.ts` | `lib/cars/car-quote-client.ts` |
| `lib/car-request.ts` | `lib/cars/car-request.ts` |
| `lib/rent-car-errors.ts` | `lib/cars/rent-car-errors.ts` |
| `lib/use-car-locale.ts` | `lib/cars/use-car-locale.ts` |
| `lib/server/car-pricing.ts` | `lib/server/cars/car-pricing.ts` |
| `lib/server/car-requests.ts` | `lib/server/cars/car-requests.ts` |
| `lib/server/cars.ts` | `lib/server/cars/cars.ts` |
| `lib/server/rent-car-errors.ts` | `lib/server/cars/rent-car-errors.ts` |
| `components/event-request-form.tsx` | `components/events/event-request-form.tsx` |
| `lib/events.ts` | `lib/events/events.ts` |
| `lib/event-request.ts` | `lib/events/event-request.ts` |
| `lib/server/events.ts` | `lib/server/events/events.ts` |
| `lib/server/event-requests.ts` | `lib/server/events/event-requests.ts` |
| `components/ask-question.tsx` | `components/enquiries/ask-question.tsx` |
| `components/enquiry-history-tracking.tsx` | `components/enquiries/enquiry-history-tracking.tsx` |
| `lib/enquiry-message.ts` | `lib/enquiries/enquiry-message.ts` |
| `lib/enquiry-navigation.ts` | `lib/enquiries/enquiry-navigation.ts` |
| `lib/server/enquiries.ts` | `lib/server/enquiries/enquiries.ts` |
| `components/offer-campaigns.tsx` | `components/offers/offer-campaigns.tsx` |
| `components/promotion-card.tsx` | `components/offers/promotion-card.tsx` |
| `components/campaigns.css` | `components/offers/campaigns.css` |
| `lib/special-offers.ts` | `lib/offers/special-offers.ts` |
| `lib/server/offers.ts` | `lib/server/offers/offers.ts` |
| `lib/server/special-offers.ts` | `lib/server/offers/special-offers.ts` |
| `lib/marketing-campaigns.ts` | `lib/marketing/marketing-campaigns.ts` |
| `lib/marketing-notifications.ts` | `lib/marketing/marketing-notifications.ts` |
| `lib/marketing-notifications-client.ts` | `lib/marketing/marketing-notifications-client.ts` |
| `lib/server/marketing-notifications.ts` | `lib/server/marketing/marketing-notifications.ts` |
| `components/notification-panel.tsx` | `components/notifications/notification-panel.tsx` |
| `components/notification-panel.module.css` | `components/notifications/notification-panel.module.css` |
| `lib/admin-notifications.ts` | `lib/notifications/admin-notifications.ts` |
| `lib/server/notifications.ts` | `lib/server/notifications/notifications.ts` |
| `lib/seo.ts` | `lib/seo/seo.ts` |
| `lib/seo-manager.ts` | `lib/seo/seo-manager.ts` |
| `lib/seo-diagnostics.ts` | `lib/seo/seo-diagnostics.ts` |
| `lib/dynamic-seo.ts` | `lib/seo/dynamic-seo.ts` |
| `lib/structured-data.tsx` | `lib/seo/structured-data.tsx` |
| `lib/server/global-seo.ts` | `lib/server/seo/global-seo.ts` |
| `lib/server/seo-inventory.ts` | `lib/server/seo/seo-inventory.ts` |
| `lib/server/seo-manager.ts` | `lib/server/seo/seo-manager.ts` |
| `lib/server/record-seo.ts` | `lib/server/seo/record-seo.ts` |
| `lib/server/record-seo-api.ts` | `lib/server/seo/record-seo-api.ts` |
| `lib/analytics.ts` | `lib/analytics/analytics.ts` |
| `lib/analytics-range.ts` | `lib/analytics/analytics-range.ts` |
| `lib/revenue-periods.ts` | `lib/analytics/revenue-periods.ts` |
| `lib/server/analytics.ts` | `lib/server/analytics/analytics.ts` |
| `components/live-chat.tsx` | `components/support/live-chat.tsx` |
| `components/live-chat.module.css` | `components/support/live-chat.module.css` |
| `components/support-chat-panel.tsx` | `components/support/support-chat-panel.tsx` |
| `components/whatsapp-chat.tsx` | `components/support/whatsapp-chat.tsx` |
| `lib/live-chat-bot.ts` | `lib/support/live-chat-bot.ts` |
| `lib/live-chat-client.ts` | `lib/support/live-chat-client.ts` |
| `lib/live-chat-contract.ts` | `lib/support/live-chat-contract.ts` |
| `lib/support-chat.ts` | `lib/support/support-chat.ts` |
| `lib/mobile-chat-screen.ts` | `lib/support/mobile-chat-screen.ts` |
| `lib/server/live-chat.ts` | `lib/server/support/live-chat.ts` |
| `lib/server/live-chat-session.ts` | `lib/server/support/live-chat-session.ts` |
| `lib/server/live-chat-catalogue.ts` | `lib/server/support/live-chat-catalogue.ts` |
| `lib/server/support-chat.ts` | `lib/server/support/support-chat.ts` |
| `components/country-flag.tsx` | `components/shared/country-flag.tsx` |
| `components/country-select.tsx` | `components/shared/country-select.tsx` |
| `components/date-input.tsx` | `components/shared/date-input.tsx` |
| `components/international-phone-input.tsx` | `components/shared/international-phone-input.tsx` |
| `components/shared-select.tsx` | `components/shared/shared-select.tsx` |
| `components/shared-help-cta.tsx` | `components/shared/shared-help-cta.tsx` |
| `components/shared-help-cta.css` | `components/shared/shared-help-cta.css` |
| `components/gallery-lightbox.tsx` | `components/shared/gallery-lightbox.tsx` |
| `components/gallery-lightbox.css` | `components/shared/gallery-lightbox.css` |
| `components/horizontal-slider.tsx` | `components/shared/horizontal-slider.tsx` |
| `lib/gallery-lightbox.ts` | `lib/ui/gallery-lightbox.ts` |
| `lib/continuous-slider.ts` | `lib/ui/continuous-slider.ts` |
| `lib/use-mobile-drawer.ts` | `lib/ui/use-mobile-drawer.ts` |
| `lib/catalogue-client.ts` | `lib/catalogue/catalogue-client.ts` |
| `lib/events-cars-client.ts` | `lib/catalogue/events-cars-client.ts` |
| `lib/offers-blogs-client.ts` | `lib/catalogue/offers-blogs-client.ts` |
| `lib/use-catalogue-language.ts` | `lib/catalogue/use-catalogue-language.ts` |
| `lib/tour-format.ts` | `lib/tours/tour-format.ts` |
| `lib/tour-rich-text.ts` | `lib/tours/tour-rich-text.ts` |
| `lib/server/tours.ts` | `lib/server/catalogue/tours.ts` |
| `lib/server/categories.ts` | `lib/server/catalogue/categories.ts` |
| `lib/server/destinations.ts` | `lib/server/catalogue/destinations.ts` |
| `lib/server/catalogue-translations.ts` | `lib/server/catalogue/catalogue-translations.ts` |
| `lib/trip-request-submission.ts` | `lib/trip-builder/trip-request-submission.ts` |
| `lib/trip-request.ts` | `lib/trip-builder/trip-request.ts` |
| `lib/server/trip-requests.ts` | `lib/server/trip-builder/trip-requests.ts` |
| `lib/journey-gallery.ts` | `lib/gallery/journey-gallery.ts` |
| `lib/journey-gallery-client.ts` | `lib/gallery/journey-gallery-client.ts` |
| `lib/server/journey-gallery.ts` | `lib/server/gallery/journey-gallery.ts` |
| `lib/blog-editorial.ts` | `lib/editorial/blog-editorial.ts` |
| `lib/server/blogs.ts` | `lib/server/editorial/blogs.ts` |
| `components/faq-hero-context.tsx` | `components/cms/faq-hero-context.tsx` |
| `components/public-appearance.tsx` | `components/cms/public-appearance.tsx` |
| `components/server-showcase-hero.tsx` | `components/cms/server-showcase-hero.tsx` |
| `components/server-template-preview.tsx` | `components/cms/server-template-preview.tsx` |
| `components/showcase-hero-context.tsx` | `components/cms/showcase-hero-context.tsx` |
| `components/showcase-hero-preview.tsx` | `components/cms/showcase-hero-preview.tsx` |
| `components/promo-bar-icons.tsx` | `components/cms/promo-bar-icons.tsx` |
| `components/language-selector.tsx` | `components/shared/language-selector.tsx` |
| `lib/access-strip.ts` | `lib/cms/access-strip.ts` |
| `lib/compact-hero-defaults.ts` | `lib/cms/compact-hero-defaults.ts` |
| `lib/editorial-hero-definitions.ts` | `lib/cms/editorial-hero-definitions.ts` |
| `lib/faq-hero.ts` | `lib/cms/faq-hero.ts` |
| `lib/hero-catalogue.ts` | `lib/cms/hero-catalogue.ts` |
| `lib/showcase-hero-defaults.ts` | `lib/cms/showcase-hero-defaults.ts` |
| `lib/showcase-heroes.ts` | `lib/cms/showcase-heroes.ts` |
| `lib/promo-bar-defaults.ts` | `lib/cms/promo-bar-defaults.ts` |
| `lib/promo-bar-icons.ts` | `lib/cms/promo-bar-icons.ts` |
| `lib/storefront-settings.ts` | `lib/cms/storefront-settings.ts` |
| `lib/information-pages.ts` | `lib/cms/information-pages.ts` |
| `components/about-page.tsx` | `components/content/about-page.tsx` |
| `components/information-page.tsx` | `components/content/information-page.tsx` |
| `components/information-page.css` | `components/content/information-page.css` |
| `components/public-search-page.tsx` | `components/content/public-search-page.tsx` |
| `lib/homepage-copy.ts` | `lib/home/homepage-copy.ts` |
| `lib/homepage-popular.ts` | `lib/home/homepage-popular.ts` |
| `lib/homepage-recommendation-session.ts` | `lib/home/homepage-recommendation-session.ts` |
| `lib/navigation.ts` | `lib/navigation/navigation.ts` |
| `lib/site-search.ts` | `lib/navigation/site-search.ts` |
| `lib/use-public-search.ts` | `lib/navigation/use-public-search.ts` |
| `lib/server/navigation.ts` | `lib/server/navigation/navigation.ts` |
| `lib/server/navigation-request.ts` | `lib/server/navigation/navigation-request.ts` |
| `lib/server/promo-bar-backfill-planner.ts` | `lib/server/cms/promo-bar-backfill-planner.ts` |
| `lib/admin-booking-row.ts` | `lib/admin/admin-booking-row.ts` |
| `lib/admin-crm-reporting.ts` | `lib/admin/admin-crm-reporting.ts` |
| `lib/admin-customers-client.ts` | `lib/admin/admin-customers-client.ts` |
| `lib/admin-users-client.ts` | `lib/admin/admin-users-client.ts` |

## Remaining root files

### components

| File | Specific reason retained |
| --- | --- |
| `components/README.md` | Directory ownership guide; retained as the directory entry point. |
| `components/auth-pages.tsx` | Shared login/registration entry composition; authentication boundaries intentionally remain stable. |
| `components/authenticated-user.tsx` | Shared authenticated-user provider used across public/account layouts. |
| `components/brand-context.tsx` | Sitewide server-seeded brand context; cross-feature provider entry point. |
| `components/brand-favicon.tsx` | Shared document/favicon integration consuming the sitewide brand provider. |
| `components/brand-icons.tsx` | Shared branding primitives used by public and administrator shells. |
| `components/brand-mark.tsx` | Shared brand identity entry point for both public and administrator shells. |
| `components/consent-manager.module.css` | Paired stylesheet for the retained sitewide consent entry point. |
| `components/consent-manager.tsx` | Sitewide consent entry point mounted on public and protected routes; kept stable. |
| `components/extended-pages.tsx` | Large mixed-responsibility page composition; splitting or changing ownership is outside scope. |
| `components/homepage_backup.txt` | Unique pre-existing user backup; no relocation or cleanup authorization for its contents. |
| `components/impersonation-banner.tsx` | Shared staff-preview/security boundary; retained with the existing preview bootstrap. |
| `components/locale.tsx` | Sitewide locale/currency provider and shared formatting API. |
| `components/site-measurement.tsx` | Global tracking lifecycle mount; public/private page boundaries remain at this established entry point. |
| `components/site.tsx` | Large cross-feature shell, navigation, search and tour-card entry point; no split or API change. |
| `components/staff-preview-bootstrap.tsx` | Shared impersonation initialization/security entry point; no behavior changes. |

### lib

| File | Specific reason retained |
| --- | --- |
| `lib/README.md` | Directory ownership and server/client boundary guide. |
| `lib/admin-store.ts` | Mixed public/admin settings, preview and catalogue facade; not exclusively owned by admin features. |
| `lib/auth-page-metadata.ts` | Shared metadata helper for authentication routes; authentication entry points retained. |
| `lib/auth-types.ts` | Shared authentication types consumed across server/client boundaries. |
| `lib/brand-settings.ts` | Shared public/admin brand contract and validation defaults. |
| `lib/catalogue-translations.ts` | Exact module path consumed by DESTINATIONS_REAL_TOURS_VERIFICATION/validate-v3.cjs. |
| `lib/country-label.ts` | Cross-feature locale/country formatting utility. |
| `lib/currency.ts` | Shared money/currency contract used by bookings, cars, payments and presentation. |
| `lib/date-calendar.ts` | Shared date/calendar utility used across unrelated forms. |
| `lib/destination-builder.ts` | Exact module path consumed by DESTINATIONS_REAL_TOURS_VERIFICATION/validate-v3.cjs. |
| `lib/destination-public.ts` | Canonical public destination resolver shared with the retained destination/import contract cluster. |
| `lib/destination-write.ts` | Exact validation module path consumed by DESTINATIONS_REAL_TOURS_VERIFICATION/validate-v3.cjs. |
| `lib/documents.ts` | Shared document contract for customer and financial/document services; stable outside this organization scope. |
| `lib/json-text.ts` | Exact source/symbol path read by temp/real-tours-batch/validate_batch.cjs. |
| `lib/locale-config.ts` | Shared locale contract; exact source path read by temp/real-tours-batch/validate_batch.cjs. |
| `lib/locale-helpers.ts` | Shared locale helper API used across feature groups. |
| `lib/payment.ts` | Shared financial/payment contract; retained with the existing payment infrastructure boundaries. |
| `lib/phone.ts` | Cross-feature phone validation/formatting contract. |
| `lib/query.ts` | Cross-feature URL parsing entry point for public forms and navigation. |
| `lib/record-seo.ts` | Exact source/symbol path read by temp/real-tours-batch/validate_batch.cjs. |
| `lib/seo-content.ts` | Exact source/symbol path read by temp/real-tours-batch/validate_batch.cjs. |
| `lib/site-copy.ts` | Mixed navigation, footer, form and search translations; no split of this cross-feature copy facade. |
| `lib/staff-preview-client.ts` | Shared client preview/security state entry point. |
| `lib/tour-json.ts` | Exact module path consumed by REAL_TOURS import/update/verification scripts. |
| `lib/tour-public-locale.ts` | Exact module/source path consumed by REAL_TOURS and destination verification scripts. |
| `lib/tour-publish.ts` | Exact module/source path consumed by REAL_TOURS import and batch validation scripts. |
| `lib/tour-translations.ts` | Exact source/symbol path read by temp/real-tours-batch/validate_batch.cjs. |
| `lib/tour-write.ts` | Exact module/source path consumed by REAL_TOURS import/update and batch validation scripts. |
| `lib/tours-client.ts` | Exact resolveTours source/symbol path read by temp/real-tours-batch/validate_batch.cjs. |
| `lib/trip-builder-destinations.ts` | Exact module path consumed by DESTINATIONS_REAL_TOURS_VERIFICATION/validate-v3.cjs. |
| `lib/trip-builder-preview.ts` | Exact source/symbol path read by temp/real-tours-batch/validate_batch.cjs. |
| `lib/use-current-user.ts` | Shared authentication hook for public/account/admin integration. |
| `lib/utils.ts` | Established shared class-name utility and components.json alias target. |
| `lib/website-heroes.ts` | Exact HeroValidationError/validateHeroMedia source path read by temp/real-tours-batch/validate_batch.cjs. |

### lib/server

| File | Specific reason retained |
| --- | --- |
| `lib/server/auth-navigation.ts` | Shared authentication navigation/security infrastructure. |
| `lib/server/auth.ts` | Central authentication/authorization entry point. |
| `lib/server/brand-settings.ts` | Shared server brand settings service used by public/admin initialization. |
| `lib/server/csrf.ts` | Shared request CSRF security boundary. |
| `lib/server/db.ts` | Database singleton; neither moved nor executed by this organization task. |
| `lib/server/document-pdf.ts` | PDF filesystem service resolving assets under process.cwd()/public; runtime paths retained. |
| `lib/server/documents.ts` | Existing commercial/document service boundary retained with PDF infrastructure. |
| `lib/server/email-smtp.ts` | Shared SMTP transport infrastructure; credentials and delivery behavior unchanged. |
| `lib/server/email.ts` | Cross-feature transactional email service; no sending performed. |
| `lib/server/errors.ts` | Shared server error contract. |
| `lib/server/fx.ts` | Shared financial/currency infrastructure used outside a single feature. |
| `lib/server/guards.ts` | Central RBAC/authorization boundary. |
| `lib/server/journey-video-storage.ts` | Persistent video storage paths and upload lifecycle; intentionally stable. |
| `lib/server/locale.ts` | Cross-feature request locale resolver. |
| `lib/server/logging.ts` | Shared server logging/security infrastructure. |
| `lib/server/media.ts` | Persistent storage/media filesystem paths; intentionally stable. |
| `lib/server/payment-proofs.ts` | Financial proof/ownership service retained with the existing payment boundary. |
| `lib/server/payments.ts` | Existing shared payment orchestration entry point; no financial behavior changes. |
| `lib/server/rate-limit.ts` | Cross-feature abuse/rate-limit infrastructure. |
| `lib/server/request-json.ts` | Shared request body parsing/validation boundary. |
| `lib/server/session.ts` | Central authentication/session security boundary. |
| `lib/server/settings.ts` | Shared server settings storage/credential boundary; no database access performed. |
| `lib/server/staff-preview.ts` | Server impersonation/preview authorization entry point. |
| `lib/server/upload-form.ts` | Shared upload validation boundary, retained with storage services. |
| `lib/server/users.ts` | Central user/account identity and authorization service. |

## Verification

Every batch retained the canonical 3559-edge import graph with zero unresolved local imports, and passed focused tests. Normalized AST comparison of 495 changed code files found no non-path implementation changes. All seven moved CSS files retain their original bytes. One pre-existing source-reader path list was updated for the moved event-request form; its assertions remain unchanged. TypeScript passed after all five batches. The complete suite ran once after all moves: 3219 passed, zero failed, one skipped (238 passed test files and one skipped file). git diff --check passed. Eleven external operational source files were inspected with zero conflicts against moved paths.

No database, Prisma, environment, dependency, deployment configuration, booking behavior, API contract, translation or authentication changes were made. Operational scripts received reference updates only and were not executed. No barrel modules or duplicate implementations were added. Browsers and database-dependent builds were not run. Git HEAD/index and unrelated tracked/untracked work remain preserved.

## Previous 98 moves

The first 98 relocation records and original before/after hashes remain in the cumulative manifest. None of those files was moved again. Their source paths remain the feature folders established in the preceding organization phase. Existing historical documentation and cleanup manifests remain historical records.
