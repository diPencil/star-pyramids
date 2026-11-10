# Library ownership

Shared contracts/browser helpers live in feature folders; server-only services stay under the corresponding `server/` folders. Existing client directives and server-only guards are preserved.

| Feature folders | Responsibility |
| --- | --- |
| account/, booking/ | Existing customer/booking contracts and helpers |
| cars/, events/, enquiries/ | Quote/request validation, event models and enquiry navigation |
| offers/, marketing/, notifications/ | Offers, campaign/feed contracts and notification clients |
| seo/, analytics/ | SEO helpers, structured data and reporting contracts |
| support/ | Guest/customer chat contracts, hooks and viewport utilities |
| catalogue/ | Catalogue clients and locale hooks shared by record types |
| tours/, trip-builder/ | Tour rich text/formatting and trip-request contracts/submission |
| gallery/, editorial/ | Journey gallery and blog editorial contracts |
| cms/, home/, navigation/ | CMS presentation/settings, homepage selection and public navigation/search |
| cms/brand-settings.ts, server/cms/brand-settings.ts | Public company branding contract/defaults and existing cached server projection; identity UI lives in components/branding/ |
| admin/ | Administrator customer/user clients, booking-row and CRM reporting helpers |
| ui/ | Shared slider, lightbox and mobile-drawer behavior |
| reviews/, tracking/ | Existing review and consent-aware measurement architecture |
| core/, payments/ | Shared validation/security/date/phone utilities; neutral currency/payment contracts and existing provider interfaces |
| i18n/ | Neutral language configuration, copy, fallback and country labels; the global LocaleProvider stays in components/locale.tsx |

`server/` now groups account, booking, cars, events, enquiries, offers, marketing, notifications, seo, analytics, support, catalogue, trip-builder, gallery, editorial, cms, navigation, reviews and tracking services. Transactional email/SMTP, commercial documents/PDF assembly and managed media/multipart parsing have cohesive `server/email`, `server/documents` and `server/media` groups. Existing `server/payments`, `server/pdf` and `server/webhooks` remain unchanged in location; the FX service now belongs to `server/payments/fx.ts`.

Authentication/session/user authority now lives in `server/auth/`; the central payment transaction service lives in `server/payments/payments.ts`. Remaining cross-feature entry points, the mixed admin-store facade, protected source contracts and shared server DB/error/logging/request infrastructure retain their root paths. Language/text modules are grouped in i18n/; neutral financial contracts in payments/; shared phone/date utilities in core/. Exact external consumers and retention reasons are in [the current source map](../docs/source-organization.md). Import explicit modules; no barrel or compatibility duplicates were added.

Phase 7 coordinates eight formerly pinned tour/trip-builder source paths with
their nine external tools. Their implementations now live in `tours/` and
`trip-builder/`; only source references changed in the tools, which were not
executed. Remaining pinned root contracts stay in place. See the
[exact moves and historical-input limitations](../docs/source-organization-phase7.md).

Phase 8 moves catalogue translation/destination contracts to `catalogue/`,
record/static SEO contracts to `seo/`, and the homepage hero contract to
`cms/heroes/website-heroes.ts`, with coordinated tool reference updates. The
remaining 18 direct files are shared infrastructure or established cross-feature
contracts. See [their individual retention reasons](../docs/source-organization-phase8.md).

Phase 9 groups the four shared language/text modules in `i18n/`, with coordinated
source-reader updates. The global provider and enabled-language behavior remain
unchanged. See [the exact moves and 14 remaining root files](../docs/source-organization-phase9.md).

Phase 10 moves phone/date utilities into `core/` and currency/payment contracts
into `payments/`, preserving every moved byte. The central payment service stays
fixed. `json-text.ts` remains at root because a protected Prisma importer depends
on its original path. See [the four moves and 10 retained files](../docs/source-organization-phase10.md).

## Internal organization (Phase 4)

[Phase 13](../docs/source-organization-phase13.md) groups auth/session/RBAC/user
services and payment persistence without changing security or transaction logic.
Earlier phase root-retention tables are historical snapshots.

[Phase 12](../docs/source-organization-phase12.md) groups branding contract/read
projection under the existing CMS folders, without changing the admin-store facade,
provider mount order, company settings source or public asset URLs.

The latest [Phase 11 server ownership report](../docs/source-organization-phase11.md)
records seven server moves and the reasons for retaining the remaining 16 direct
server files. Historical root-retention tables below describe their original phase.

CMS separates heroes/, templates/ and promo-bar/. Tracking separates health/ and leads/ while loader, consent and dispatch entry points remain at its root. Server CMS groups heroes/; server booking separates access/ and checkout/ while persistence/request-security remain entry points; server tracking separates health/ and leads/. Smaller cohesive directories are intentionally unchanged.

See [the Phase 4 structure and verification report](../docs/source-organization-phase4.md).

## Root ownership review (Phase 6)

Authentication metadata and destination read helpers now live in
`seo/auth-page-metadata.ts` and `catalogue/destination-public.ts`. Payment-proof
handling and gallery video storage code now live in
`server/payments/payment-proofs.ts` and `server/gallery/journey-video-storage.ts`.
Central payment/media/auth infrastructure and external import-package paths
remain stable. No storage directory, URL, or business logic changed. See the
[file-by-file decisions and exact moves](../docs/source-organization-phase6.md).
