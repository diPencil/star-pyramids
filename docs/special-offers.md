# Special Offers

The `offers` table is the authoritative source for public offer cards and the admin list. The existing `/special-offers` hero and its surrounding sections are preserved. Fixed seasonal tour selections do not imply a discount or create offers. Existing manual `Tour.deal` values remain untouched and continue to apply to ordinary tour pricing.

## Tour offers

Create one through **Link existing tour**. Select any of the four tour categories, choose a tour, enter a 1–90% discount and an end date. A start date is optional. The relationship is unique per tour. Cards use the current tour images, duration and base price. Booking calculations resolve the same active discount without overwriting the tour's manual deal. Hiding, expiring or deleting the offer stops its discount and restores the original/manual pricing.

**New tour with offer** opens Trip Builder. Save the complete tour, then return to Offers to link its discount. A marketing campaign is not a substitute for a bookable tour.

## Marketing campaigns

Campaigns are offers without `tourSlug`. Their existing media and copy are preserved. Extra configuration is stored in `Offer.content.campaign`; no schema migration or owner-data conversion is required.

Editable fields: body, terms, CTA label and destination, price label, placements; existing title, badge, copy, image/gallery, highlights, optional price/original price/duration, publication dates and display order also apply. English, Spanish and Italian content tabs support campaign text. Links and placements are shared across translations. Empty translated text falls back to English.

Placements:

- `offers`: `/special-offers` cards.
- `home`: homepage **Special offers for you**.
- `trips-sidebar`: the ad inside the `/trips` filters sidebar.
- `blog-sidebar`: the ad in the blog guide sidebar; the editorial tour link remains intact.

Each sidebar shows the first active matching campaign by display order, with title as the tie-breaker. Legacy campaigns default to `offers` only; other placements require an explicit admin choice. Empty placement lists are valid and leave the detail page accessible while published and within its dates. Linked tour offers appear in the offers catalogue and homepage, provided the tour is published.

CTA destinations accept local paths or HTTPS URLs, reject executable schemes, protocol-relative links, backslashes, whitespace/control characters and embedded credentials. Empty destinations lead to the contact page with the offer slug. External destinations open a new tab with `noopener noreferrer`. Campaign body/terms are plain text, not executable HTML.

The admin table includes **Type** and a type filter. Publication, scheduling and expiry are separate concepts: published counts include scheduled/expired records, while public cards include only currently active records. Date-only deadlines include the full UTC end date.

## Verification

`npx vitest run` covers API RBAC/origin protection, campaign persistence/partial updates, unsafe links, placements, translations, lifecycle and pricing. `npx tsc --noEmit` checks types; `npm run build` checks the production build.

For a local database check, run `npx tsx scripts/verify-special-offers.ts` with `NODE_OPTIONS=--conditions=react-server`. It creates verification-only tour/campaign rows inside one transaction, verifies pricing, media/content preservation, placements, visibility and delete isolation, then deliberately rolls the transaction back. It compares complete tour, offer and catalogue-translation fingerprints before and after. It never commits test rows or alters existing records.

Tour JSON boundaries decode MySQL LONGTEXT on public/admin reads and encode structured JSON on writes, preserving omitted update fields and explicit nulls. This keeps Trip Builder responses and booking traveller prices consistent.
