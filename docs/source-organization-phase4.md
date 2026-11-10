# Internal architecture organization — Phase 4

**81 files relocated in this phase**, in four batches. These are internal moves following the preceding 229 operations; 51 files intentionally moved again into more specific subfolders, while 30 admin files were organized for the first time. There are 310 cumulative relocation operations covering 259 distinct source files. No implementation was split or duplicated.

## Internal counts

Direct file counts exclude directory README files and count paired CSS as files. They describe internal organization, not root cleanup.

| Directory | Direct files before | Direct files after | Files moved |
| --- | ---: | ---: | ---: |
| `components/admin` | 52 | 22 | 30 |
| `components/account` | 4 | 4 | 0 |
| `components/booking` | 10 | 5 | 5 |
| `components/tours` | 7 | 2 | 5 |
| `components/cms` | 14 | 10 | 4 |
| `components/shared` | 11 | 4 | 7 |
| `lib/cms` | 18 | 7 | 11 |
| `lib/tracking` | 9 | 4 | 5 |
| `lib/server/cms` | 8 | 4 | 4 |
| `lib/server/booking` | 8 | 2 | 6 |
| `lib/server/tracking` | 5 | 1 | 4 |

## Before

```text
components/admin/
  admin-back.tsx
  admin-confirm-dialog.tsx
  admin-currency.tsx
  admin-locale.tsx
  admin-pagination.tsx
  admin-shell.tsx
  admin-table-sort.tsx
  admin-toaster.tsx
  admin-ui.tsx
  blog-editorial-form.tsx
  booking-tours-summary.tsx
  campaign-fields.tsx
  car-pricing-manager.css
  car-pricing-manager.tsx
  cms-device-preview.tsx
  cms-pages-dashboard.tsx
  cms-reference-picker.tsx
  content-language-tabs.tsx
  creation-timeline.css
  creation-timeline.tsx
  destination-builder-preview.tsx
  destination-builder.css
  destination-sections-editor.tsx
  editorial-hero-editor.tsx
  editorial-sections-editor.tsx
  gallery-form.tsx
  gallery-text.tsx
  image-field.tsx
  navigation-manager.css
  navigation-manager.tsx
  notifications-page.tsx
  page-visual-editor.tsx
  promo-bar-fields.tsx
  revenue-trend.tsx
  review-integrations.tsx
  rich-text-editor.css
  rich-text-editor.tsx
  seo-global-settings.tsx
  seo-manager.css
  seo-manager.tsx
  seo-record-editor.tsx
  showcase-hero-editor.tsx
  tour-cta-picker.tsx
  tracking-health.module.css
  tracking-health.tsx
  trip-builder-preview.css
  trip-builder-preview.tsx
  trip-builder.tsx
  vehicle-form.tsx
  website-appearance.css
  website-appearance.tsx
  website-enquiries.tsx

components/account/
  account-custom-trip.tsx
  account-event-requests.tsx
  account-portal.tsx
  customer-confirm-dialog.tsx

components/booking/
  booking-account-setup.tsx
  booking-confirmation.tsx
  booking-payment.tsx
  booking-print-document.tsx
  cart-catalogue-status.tsx
  cart-line-issues.tsx
  cart-page.tsx
  checkout-page.tsx
  checkout-receipt.css
  mobile-booking-shortcut.tsx

components/tours/
  day-tour-detail.tsx
  nile-cruises-page.tsx
  tour-detail.tsx
  tour-rich-text.css
  tour-rich-text.tsx
  tour-video-gallery.tsx
  trips-page.tsx

components/cms/
  cms-additional-pages.tsx
  cms-icons.tsx
  cms-image.tsx
  cms-public-link.tsx
  faq-hero-context.tsx
  page-sections-context.tsx
  page-sections.css
  presentation-content-context.tsx
  promo-bar-icons.tsx
  public-appearance.tsx
  server-showcase-hero.tsx
  server-template-preview.tsx
  showcase-hero-context.tsx
  showcase-hero-preview.tsx

components/shared/
  country-flag.tsx
  country-select.tsx
  date-input.tsx
  gallery-lightbox.css
  gallery-lightbox.tsx
  horizontal-slider.tsx
  international-phone-input.tsx
  language-selector.tsx
  shared-help-cta.css
  shared-help-cta.tsx
  shared-select.tsx

lib/cms/
  access-strip.ts
  additional-page-content.ts
  cms-coverage.ts
  compact-hero-defaults.ts
  editorial-hero-definitions.ts
  faq-hero.ts
  hero-catalogue.ts
  information-pages.ts
  page-sections.ts
  promo-bar-defaults.ts
  promo-bar-icons.ts
  shared-template.ts
  showcase-hero-defaults.ts
  showcase-heroes.ts
  storefront-settings.ts
  template-items.ts
  template-presentation.ts
  website-appearance.ts

lib/tracking/
  booking-funnel.ts
  booking-measurement.ts
  form-lead.ts
  tracking-browser.ts
  tracking-csp.ts
  tracking-events.ts
  tracking-health-browser.ts
  tracking-health.ts
  tracking.ts

lib/server/cms/
  editorial-hero-api.ts
  faq-hero.ts
  page-content-metadata.ts
  page-sections.ts
  promo-bar-backfill-planner.ts
  showcase-heroes.ts
  website-appearance.ts
  website-heroes.ts

lib/server/booking/
  booking-access.ts
  booking-checkout.ts
  booking-confirmation.ts
  booking-quote.ts
  booking-recovery.ts
  booking-request-security.ts
  bookings.ts
  checkout-account.ts

lib/server/tracking/
  form-lead-measurement.ts
  google-tracking-api.ts
  tracking-health.ts
  tracking.ts
  trip-request-measurement.ts
```

## After

```text
components/admin/
  cars/
    car-pricing-manager.css
    car-pricing-manager.tsx
    vehicle-form.tsx
  cms/
    cms-device-preview.tsx
    cms-pages-dashboard.tsx
    cms-reference-picker.tsx
    editorial-hero-editor.tsx
    editorial-sections-editor.tsx
    navigation-manager.css
    navigation-manager.tsx
    page-visual-editor.tsx
    showcase-hero-editor.tsx
    website-appearance.css
    website-appearance.tsx
  destinations/
    destination-builder-preview.tsx
    destination-builder.css
    destination-sections-editor.tsx
  gallery/
    gallery-form.tsx
    gallery-text.tsx
  marketing/
    campaign-fields.tsx
    promo-bar-fields.tsx
  seo/
    seo-global-settings.tsx
    seo-manager.css
    seo-manager.tsx
    seo-record-editor.tsx
    tracking-health.module.css
    tracking-health.tsx
  tours/
    tour-cta-picker.tsx
    trip-builder-preview.css
    trip-builder-preview.tsx
  README.md
  admin-back.tsx
  admin-confirm-dialog.tsx
  admin-currency.tsx
  admin-locale.tsx
  admin-pagination.tsx
  admin-shell.tsx
  admin-table-sort.tsx
  admin-toaster.tsx
  admin-ui.tsx
  blog-editorial-form.tsx
  booking-tours-summary.tsx
  content-language-tabs.tsx
  creation-timeline.css
  creation-timeline.tsx
  image-field.tsx
  notifications-page.tsx
  revenue-trend.tsx
  review-integrations.tsx
  rich-text-editor.css
  rich-text-editor.tsx
  trip-builder.tsx
  website-enquiries.tsx

components/account/
  account-custom-trip.tsx
  account-event-requests.tsx
  account-portal.tsx
  customer-confirm-dialog.tsx

components/booking/
  cart/
    cart-catalogue-status.tsx
    cart-line-issues.tsx
    cart-page.tsx
  checkout/
    checkout-page.tsx
    checkout-receipt.css
  booking-account-setup.tsx
  booking-confirmation.tsx
  booking-payment.tsx
  booking-print-document.tsx
  mobile-booking-shortcut.tsx

components/tours/
  detail/
    day-tour-detail.tsx
    tour-detail.tsx
    tour-rich-text.css
    tour-rich-text.tsx
    tour-video-gallery.tsx
  nile-cruises-page.tsx
  trips-page.tsx

components/cms/
  heroes/
    faq-hero-context.tsx
    server-showcase-hero.tsx
    showcase-hero-context.tsx
    showcase-hero-preview.tsx
  cms-additional-pages.tsx
  cms-icons.tsx
  cms-image.tsx
  cms-public-link.tsx
  page-sections-context.tsx
  page-sections.css
  presentation-content-context.tsx
  promo-bar-icons.tsx
  public-appearance.tsx
  server-template-preview.tsx

components/shared/
  forms/
    country-flag.tsx
    country-select.tsx
    date-input.tsx
    international-phone-input.tsx
    shared-select.tsx
  gallery/
    gallery-lightbox.css
    gallery-lightbox.tsx
  horizontal-slider.tsx
  language-selector.tsx
  shared-help-cta.css
  shared-help-cta.tsx

lib/cms/
  heroes/
    compact-hero-defaults.ts
    editorial-hero-definitions.ts
    faq-hero.ts
    hero-catalogue.ts
    showcase-hero-defaults.ts
    showcase-heroes.ts
  promo-bar/
    promo-bar-defaults.ts
    promo-bar-icons.ts
  templates/
    shared-template.ts
    template-items.ts
    template-presentation.ts
  access-strip.ts
  additional-page-content.ts
  cms-coverage.ts
  information-pages.ts
  page-sections.ts
  storefront-settings.ts
  website-appearance.ts

lib/tracking/
  health/
    tracking-health-browser.ts
    tracking-health.ts
  leads/
    booking-funnel.ts
    booking-measurement.ts
    form-lead.ts
  tracking-browser.ts
  tracking-csp.ts
  tracking-events.ts
  tracking.ts

lib/server/cms/
  heroes/
    editorial-hero-api.ts
    faq-hero.ts
    showcase-heroes.ts
    website-heroes.ts
  page-content-metadata.ts
  page-sections.ts
  promo-bar-backfill-planner.ts
  website-appearance.ts

lib/server/booking/
  access/
    booking-access.ts
    booking-confirmation.ts
    booking-recovery.ts
  checkout/
    booking-checkout.ts
    booking-quote.ts
    checkout-account.ts
  booking-request-security.ts
  bookings.ts

lib/server/tracking/
  health/
    google-tracking-api.ts
    tracking-health.ts
  leads/
    form-lead-measurement.ts
    trip-request-measurement.ts
  tracking.ts
```

## Exact Phase 4 moves

Paths are relative to the application root. [The cumulative manifest](source-organization-manifest.json) retains original operation paths/hashes and adds currentPath/currentSha256 for live-file verification.

| Original | Destination |
| --- | --- |
| `components/admin/cms-device-preview.tsx` | `components/admin/cms/cms-device-preview.tsx` |
| `components/admin/cms-pages-dashboard.tsx` | `components/admin/cms/cms-pages-dashboard.tsx` |
| `components/admin/cms-reference-picker.tsx` | `components/admin/cms/cms-reference-picker.tsx` |
| `components/admin/editorial-hero-editor.tsx` | `components/admin/cms/editorial-hero-editor.tsx` |
| `components/admin/editorial-sections-editor.tsx` | `components/admin/cms/editorial-sections-editor.tsx` |
| `components/admin/page-visual-editor.tsx` | `components/admin/cms/page-visual-editor.tsx` |
| `components/admin/showcase-hero-editor.tsx` | `components/admin/cms/showcase-hero-editor.tsx` |
| `components/admin/website-appearance.tsx` | `components/admin/cms/website-appearance.tsx` |
| `components/admin/website-appearance.css` | `components/admin/cms/website-appearance.css` |
| `components/admin/navigation-manager.tsx` | `components/admin/cms/navigation-manager.tsx` |
| `components/admin/navigation-manager.css` | `components/admin/cms/navigation-manager.css` |
| `components/admin/seo-global-settings.tsx` | `components/admin/seo/seo-global-settings.tsx` |
| `components/admin/seo-manager.tsx` | `components/admin/seo/seo-manager.tsx` |
| `components/admin/seo-manager.css` | `components/admin/seo/seo-manager.css` |
| `components/admin/seo-record-editor.tsx` | `components/admin/seo/seo-record-editor.tsx` |
| `components/admin/tracking-health.tsx` | `components/admin/seo/tracking-health.tsx` |
| `components/admin/tracking-health.module.css` | `components/admin/seo/tracking-health.module.css` |
| `components/admin/car-pricing-manager.tsx` | `components/admin/cars/car-pricing-manager.tsx` |
| `components/admin/car-pricing-manager.css` | `components/admin/cars/car-pricing-manager.css` |
| `components/admin/vehicle-form.tsx` | `components/admin/cars/vehicle-form.tsx` |
| `components/admin/destination-builder-preview.tsx` | `components/admin/destinations/destination-builder-preview.tsx` |
| `components/admin/destination-builder.css` | `components/admin/destinations/destination-builder.css` |
| `components/admin/destination-sections-editor.tsx` | `components/admin/destinations/destination-sections-editor.tsx` |
| `components/admin/tour-cta-picker.tsx` | `components/admin/tours/tour-cta-picker.tsx` |
| `components/admin/trip-builder-preview.tsx` | `components/admin/tours/trip-builder-preview.tsx` |
| `components/admin/trip-builder-preview.css` | `components/admin/tours/trip-builder-preview.css` |
| `components/admin/campaign-fields.tsx` | `components/admin/marketing/campaign-fields.tsx` |
| `components/admin/promo-bar-fields.tsx` | `components/admin/marketing/promo-bar-fields.tsx` |
| `components/admin/gallery-form.tsx` | `components/admin/gallery/gallery-form.tsx` |
| `components/admin/gallery-text.tsx` | `components/admin/gallery/gallery-text.tsx` |
| `components/booking/cart-page.tsx` | `components/booking/cart/cart-page.tsx` |
| `components/booking/cart-catalogue-status.tsx` | `components/booking/cart/cart-catalogue-status.tsx` |
| `components/booking/cart-line-issues.tsx` | `components/booking/cart/cart-line-issues.tsx` |
| `components/booking/checkout-page.tsx` | `components/booking/checkout/checkout-page.tsx` |
| `components/booking/checkout-receipt.css` | `components/booking/checkout/checkout-receipt.css` |
| `components/tours/tour-detail.tsx` | `components/tours/detail/tour-detail.tsx` |
| `components/tours/day-tour-detail.tsx` | `components/tours/detail/day-tour-detail.tsx` |
| `components/tours/tour-rich-text.tsx` | `components/tours/detail/tour-rich-text.tsx` |
| `components/tours/tour-rich-text.css` | `components/tours/detail/tour-rich-text.css` |
| `components/tours/tour-video-gallery.tsx` | `components/tours/detail/tour-video-gallery.tsx` |
| `components/shared/country-flag.tsx` | `components/shared/forms/country-flag.tsx` |
| `components/shared/country-select.tsx` | `components/shared/forms/country-select.tsx` |
| `components/shared/date-input.tsx` | `components/shared/forms/date-input.tsx` |
| `components/shared/international-phone-input.tsx` | `components/shared/forms/international-phone-input.tsx` |
| `components/shared/shared-select.tsx` | `components/shared/forms/shared-select.tsx` |
| `components/shared/gallery-lightbox.tsx` | `components/shared/gallery/gallery-lightbox.tsx` |
| `components/shared/gallery-lightbox.css` | `components/shared/gallery/gallery-lightbox.css` |
| `components/cms/faq-hero-context.tsx` | `components/cms/heroes/faq-hero-context.tsx` |
| `components/cms/server-showcase-hero.tsx` | `components/cms/heroes/server-showcase-hero.tsx` |
| `components/cms/showcase-hero-context.tsx` | `components/cms/heroes/showcase-hero-context.tsx` |
| `components/cms/showcase-hero-preview.tsx` | `components/cms/heroes/showcase-hero-preview.tsx` |
| `lib/cms/compact-hero-defaults.ts` | `lib/cms/heroes/compact-hero-defaults.ts` |
| `lib/cms/editorial-hero-definitions.ts` | `lib/cms/heroes/editorial-hero-definitions.ts` |
| `lib/cms/faq-hero.ts` | `lib/cms/heroes/faq-hero.ts` |
| `lib/cms/hero-catalogue.ts` | `lib/cms/heroes/hero-catalogue.ts` |
| `lib/cms/showcase-hero-defaults.ts` | `lib/cms/heroes/showcase-hero-defaults.ts` |
| `lib/cms/showcase-heroes.ts` | `lib/cms/heroes/showcase-heroes.ts` |
| `lib/cms/shared-template.ts` | `lib/cms/templates/shared-template.ts` |
| `lib/cms/template-items.ts` | `lib/cms/templates/template-items.ts` |
| `lib/cms/template-presentation.ts` | `lib/cms/templates/template-presentation.ts` |
| `lib/cms/promo-bar-defaults.ts` | `lib/cms/promo-bar/promo-bar-defaults.ts` |
| `lib/cms/promo-bar-icons.ts` | `lib/cms/promo-bar/promo-bar-icons.ts` |
| `lib/server/cms/editorial-hero-api.ts` | `lib/server/cms/heroes/editorial-hero-api.ts` |
| `lib/server/cms/faq-hero.ts` | `lib/server/cms/heroes/faq-hero.ts` |
| `lib/server/cms/showcase-heroes.ts` | `lib/server/cms/heroes/showcase-heroes.ts` |
| `lib/server/cms/website-heroes.ts` | `lib/server/cms/heroes/website-heroes.ts` |
| `lib/server/booking/booking-checkout.ts` | `lib/server/booking/checkout/booking-checkout.ts` |
| `lib/server/booking/booking-quote.ts` | `lib/server/booking/checkout/booking-quote.ts` |
| `lib/server/booking/checkout-account.ts` | `lib/server/booking/checkout/checkout-account.ts` |
| `lib/server/booking/booking-access.ts` | `lib/server/booking/access/booking-access.ts` |
| `lib/server/booking/booking-recovery.ts` | `lib/server/booking/access/booking-recovery.ts` |
| `lib/server/booking/booking-confirmation.ts` | `lib/server/booking/access/booking-confirmation.ts` |
| `lib/tracking/tracking-health.ts` | `lib/tracking/health/tracking-health.ts` |
| `lib/tracking/tracking-health-browser.ts` | `lib/tracking/health/tracking-health-browser.ts` |
| `lib/tracking/booking-funnel.ts` | `lib/tracking/leads/booking-funnel.ts` |
| `lib/tracking/booking-measurement.ts` | `lib/tracking/leads/booking-measurement.ts` |
| `lib/tracking/form-lead.ts` | `lib/tracking/leads/form-lead.ts` |
| `lib/server/tracking/google-tracking-api.ts` | `lib/server/tracking/health/google-tracking-api.ts` |
| `lib/server/tracking/tracking-health.ts` | `lib/server/tracking/health/tracking-health.ts` |
| `lib/server/tracking/form-lead-measurement.ts` | `lib/server/tracking/leads/form-lead-measurement.ts` |
| `lib/server/tracking/trip-request-measurement.ts` | `lib/server/tracking/leads/trip-request-measurement.ts` |

## Deliberate remaining boundaries and issues

- `components/site.tsx` remains a large shared shell/navigation/search/card entry point (about 1219 lines before this phase); its export surface is preserved. Splitting requires a separate behavior-aware change.
- `components/extended-pages.tsx` remains mixed public content, car/event/request forms and legacy account/auth compositions (about 1838 lines). No automatic split or API change.
- `components/account/account-portal.tsx` combines shell, lists, detail views and hooks (about 1902 lines). Its four-file directory does not benefit from extra hierarchy until a separately approved extraction.
- `components/admin/trip-builder.tsx` is pinned by `temp/real-tours-batch/validate_batch.cjs` external source/symbol extraction. Its public preview helpers are grouped in admin/tours/, but the pinned entry point and extracted implementation remain.
- Admin root primitives (shell, locale/currency, buttons/dialogs/table/toast helpers) remain cross-feature entry points. Image, language, rich-text and timeline controls are shared across editors. Standalone small feature screens (blog editorial, review integration, revenue, notifications, enquiries and booking summary) remain at root instead of gaining one-file folders.
- `lib/server/booking/bookings.ts` remains the persistence/domain entry point (about 1065 lines); its request security and authorization are preserved. Internal checkout and guest-access services are grouped without splitting business logic.
- Existing small, cohesive directories (account, reviews, cars, support, catalogue, SEO, payments/core infrastructure and others) remain unchanged unless listed in the move table. Additional nesting would add depth without clarifying ownership.
- Existing Prisma, DB/session/auth/CSRF/storage/PDF paths and external import contracts are unchanged. No filesystem runtime paths or credentials moved.

## Verification

All four batches passed TypeScript, canonical import-graph and focused-test checks (372, 308, 212 and 414 tests respectively). The configured full suite ran once after all moves: 3219 passed, zero failed, one skipped (238 passed test files and one skipped file). Normalized AST comparison of 284 changed code files found no non-path implementation changes. All 10 moved CSS files retain their original bytes. The 3559-edge canonical import graph is preserved, with zero unresolved local imports. Eleven external operational source files show no moved-path conflicts. git diff --check passed; all 1144 baseline files are accounted for, with only authorized moves/reference/documentation changes. Git HEAD and index are unchanged. CSS imports/assets and source-reader paths are checked alongside module imports. No browser or database-dependent build runs under this scope. No database, Prisma, environment, deployment, dependency, business-rule or UI changes are authorized or made. No staging, commit, push or deployment.
