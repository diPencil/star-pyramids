# Components

| Folder | Ownership |
| --- | --- |
| account/ | Customer portal, trip/event requests and account dialogs |
| booking/ | Cart, checkout, receipt, enrollment and booking payment UI |
| cars/ | Car quote summary and fleet empty-state presentation |
| events/ | Public event-request form |
| enquiries/ | Ask-question UI and enquiry navigation tracking |
| offers/ | Offer/campaign presentation, promotion cards and paired styles |
| notifications/ | Shared notification dropdown and CSS Module |
| support/ | Guest/customer live chat, staff-message UI and WhatsApp |
| tours/ | Tour catalogue/detail pages, rich text and tour videos |
| home/ | Homepage, hero, preview, slider and sustainability |
| reviews/ | Review pages, providers, picker and marquee |
| cms/ | CMS content providers, hero/appearance presentation and icons |
| branding/ | Server-seeded company identity provider, shared brand mark, favicon synchronization and brand SVG primitives |
| content/ | Public information/about/search page compositions |
| layout/ | Navigation context/menu, header search and social icons |
| shared/ | Reusable form controls, language UI, gallery, slider and help CTA |
| admin/ | Existing administrator UI |
| ui/ | Existing design-system primitives |

Sitewide auth/locale/consent/preview entry points and the tracking mount intentionally remain at root. Branding modules now share branding/ without changing their root-layout mount order or state ownership; see [Phase 12](../docs/source-organization-phase12.md). `site.tsx` and `extended-pages.tsx` preserve their original public import paths; their extracted implementations are documented below. No behavior change or duplicate implementation is introduced.

See [the complete before/after tree and retained-file reasons](../docs/source-organization.md) and [exact relocation hashes](../docs/source-organization-manifest.json).

## Internal organization (Phase 4)

Admin editors now use feature subfolders documented in [admin/README.md](admin/README.md). Booking separates cart/ and checkout/; tours separates detail/; CMS separates heroes/; shared controls separate forms/ and gallery/. The four-file account directory remains cohesive and unchanged.

See [the Phase 4 structure and verification report](../docs/source-organization-phase4.md).

## Site entry-point modularization (Phase 5A)

`site.tsx` preserves its public exports and import path. Tour cards live in `tours/tour-card.tsx`, the reusable trip search in `shared/trip-search-engine.tsx`, and header/navigation/notification presentation in `layout/site-header.tsx`. Remaining page/layout composition stays at the original entry point. See [the extraction and verification report](../docs/site-modularization-phase5a.md).

## Extended-page modularization (Phase 5B)

`extended-pages.tsx` remains the compatibility entry for cars/car-pages, enquiries/contact-page, account/password-recovery-pages, content/public-content-pages, events/event-pages, content/blog-pages, content/destination-pages, offers/offer-pages and account/legacy-account-page. Existing AboutPage and SearchPage re-exports are preserved. See [exact extractions and verification](../docs/extended-pages-modularization-phase5b.md).

## Account portal modularization (Phase 5C)

The public account portal remains at its original path with its shell, providers and section dispatcher. Feature sections and existing hook definitions are documented in [account/README.md](account/README.md); all props, hook call sites and state ownership remain unchanged. See [the full verification report](../docs/account-portal-modularization-phase5c.md).
