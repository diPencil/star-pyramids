# Live cart and checkout tour resolution

## Problem

The cart and checkout called `estimateCart(items)`, which resolved each slug through the static `findTour` map in `data/tours.ts`. A real published database tour absent from that bootstrap map (for example the prepared Alexandria tour) was therefore classified as removed, producing the unavailable warning and a zero subtotal. The account cart metric reused the same path.

Date Pricing is not an availability gate. `priceRows` describe travel-period price information; bookings use the existing `getBookingTotal` traveler pricing engine. Legacy child-rate fallback can read certain price rows, but an empty Date Pricing section does not make a published trip unavailable. Preferred dates are still requests, not capacity guarantees.

## Repair

* `estimateCart(items, catalogue)` now requires an explicit catalogue and resolves published canonical slugs and aliases. No static `findTour` fallback. Existing canonical rates/add-on calculations still use the same pricing engine.
* `useCartCatalogue` reuses the existing public `/api/tours?full=1` cache and its loading/error/retry contract. Cart, checkout and the account cart metric all consume this path.
* Pending/unreachable catalogue reads do not prove that selected trips were removed. The cart/checkout show localized loading or retry feedback, preserve saved selections and withhold checkout until the catalogue resolves. They do not display a false zero subtotal or tell customers to delete trips during those states.
* A successfully loaded catalogue that excludes a selected trip still produces the genuine unavailable state. Draft/deleted tours are not resurrected. A mixed cart containing an unavailable line cannot proceed until it is removed.
* Aliases resolve to canonical slugs for submission, while the original local line key is preserved for removal/deduplication. Stored customer selections and money snapshots are not rewritten by a catalogue read. Current totals ignore stored money snapshots.
* Contact form state remains in the CheckoutPage parent while the catalogue reloads. Booking submission requires catalogue readiness. The backend continues to recheck publication, slugs, preferred dates, add-ons and prices; no server authorization or money validation was relaxed.

## Verification and boundaries

Offline tests cover DB-only tours in all four categories with empty Date Pricing, live traveler rates and extras, aliases, tampered money snapshots, draft/missing tours, loading/error/empty/success states in actual cart and checkout static rendering, mixed-cart blocking and EN/ES/IT error messages. Existing catalogue focus/invalidation/race tests and mocked checkout/security tests are included.

The focused command runs `cart-live-catalogue`, `booking-api-security`, `tours-cache-lifecycle`, `tours-cache-refresh`, `tour-cache-race` and `payments/checkout`: 81 tests passed. TypeScript and local compile-only verification are reported in the task result. No real booking, database write, browser test, publication or deployment was performed.

Before release, manually verify a published DB-only trip -> cart -> checkout against an approved test environment, including delayed/failed network reads, retry, a removed trip and a mixed cart. Do not create production test bookings. Checkout pricing is still an estimate until authoritative server validation; cached catalogue data can be briefly older than the database, and the backend remains the final gate. This repair does not introduce inventory scheduling or change Draft/publication rules.
