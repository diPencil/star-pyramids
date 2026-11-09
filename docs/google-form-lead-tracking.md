# Public form lead tracking and handoff

These events are leads after confirmed persistence, never purchases or successful-button-click approximations. GTM is the only Google loader; consent defaults, CMS enablement, environment isolation and the explicit page-view flag are unchanged. No migration or database operation is needed for this implementation. API responses add only an optional `leadMeasurement` receipt.

| Form | dataLayer Custom Event | `form_type` |
| --- | --- | --- |
| Homepage help | `enquiry_created` | `home_help` |
| Shared help CTA | `enquiry_created` | `shared_help` |
| Contact Us | `enquiry_created` | `contact` |
| Public car request | `car_request_created` | `car_request` |
| Public event request | `event_request_created` | `event_request` |
| Make Your Trip (existing) | `trip_request_created` | not added; existing payload preserved |
| Booking (existing) | `sp_booking_created` | not added; existing payload preserved |

New form payloads contain only `event`, `event_id`, `form_type` and the existing `ads_eligible` boolean. Server-generated IDs are namespaced SHA-256 projections of persisted identity, with `enq_`, `car_` or `evt_` prefixes. Raw enquiry IDs, references, name, email, phone, notes, locations, dates, passenger counts and form contents are never included in these events. Preferences, budget and quotes are not conversion revenue. No `purchase`, `add_payment_info`, Enhanced Conversions or user-data payload was introduced.

## Firing and recovery

The forms capture the existing category grant IDs before submission. The three enquiry forms keep that capture alongside their existing request ID when retrying unchanged input. A 201 persistence acknowledgement is required. Enquiry idempotent replays may return 200 with the same server-generated receipt; other 200 responses/updates do not create leads. Failed validation, rate limiting, failed/unconfirmed persistence and missing/old API receipts do not generate events. Event and car forms measure only new creations, never account edits.

The receipt goes through the existing typed funnel parser, persistent pending queue, delivered markers and Web Locks. It drains immediately on a ready eligible public page or when GTM becomes ready/reconnects. Current Analytics consent must match the captured grant. Analytics withdrawal/regrant invalidates the old lead. Later Marketing consent cannot upgrade a previously Analytics-only lead for Ads. No new consent system is involved. Storage failures never turn a saved customer request into an error, and conservatively prevent measurement.

Delivered markers suppress repeated dispatch of the **same persisted record**, including reloads/replayed receipts. Web Locks coordinate supported browsers; fallback cross-tab coordination is best effort. These markers attest enqueueing, not Google acknowledgement. Network/ad blockers, closed tabs, blocked storage or withdrawn consent can prevent delivery. The car/event APIs do not gain new business-level idempotency in this phase: if retrying a lost response creates another actual record, that separate record has a separate lead ID. Preventing duplicate business records is a separate backend change, not analytics deduplication.

## Public/private boundary

`/contact` and `/rent-car/request` join the eligible public pages. Car entry URLs admit only validated public vehicle/type/date parameters plus the existing campaign/debug allowlist. Application page views use fixed public titles and sanitized URLs. Address-bearing `pickup`/`dropoff`, edit/reference/token parameters, private routes, unknown parameters and unreviewed fragments remain excluded from Google loading. The 9 November URL-policy review permits exact existing public section links such as `/contact#contact-enquiry` and `/events/<slug>#event-book` without copying fragments into payloads; normal CTA navigation no longer suppresses their persisted lead receipts. See [the sitewide contract](google-consent-mode-and-csp.md#sitewide-url-compatibility-review--9-november-2026).

A new car receipt can be captured locally on an address-bearing car form, without exposing its URL/address to Google. It drains only in an eligible public document, including an already-open same-origin public tab via the existing storage listener. If none exists and the visitor never returns to a safe public page, that lead remains undelivered. Checkout stays protected and its existing booking milestones have the same deliberate deferred-delivery boundary. Do not enable Google on private receipt/account/token pages to remove this limitation. A guaranteed immediate private-page conversion would require a separately designed consent-aware server/isolated relay and external credentials; it is not claimed here.

The later owner-approved [public booking confirmation](google-booking-confirmation.md) automatically provides a safe document after booking success when its HttpOnly handoff is acknowledged. This improves booking lead delivery through the same queue without enabling Google on checkout; the address-bearing car-form limitation above is unchanged.

## SEO/GTM setup

1. Configure and publish one native Google tag for the correct GA4 Measurement ID. Use the existing Advanced Consent Mode contract. No Custom HTML/extra GA4 loader or second configuration on `sp_consent_ready`.
2. Create version-2 Data Layer Variables `event_id`, `form_type`, `ads_eligible`. Create exact Custom Event triggers `enquiry_created`, `car_request_created`, `event_request_created`, alongside existing `trip_request_created`/`sp_booking_created` triggers. GA4 Event tags use the same event names, `event_id`/`form_type` parameters and require Analytics consent.
3. Disable automatic form-interaction and automatic user-provided-data collection/Enhanced Conversions for these forms. Never map DOM/form fields, raw URLs, contact details or request references. The application does not control tags configured outside it; review the published container.
4. Choose appropriate lead key events. Ads conversions additionally require `ads_eligible === true` and current Marketing consent, and map `event_id` to transaction ID. Do not count both a direct Ads lead and its GA4 import as separate primary conversions. Do not use these events as paid purchases or send quoted/preferred budgets as revenue.
5. Keep one page-view mechanism consistent with the current explicit-page-view flag. The form change does not activate page views or Google conversions.
6. In isolated Preview/DebugView, verify consented success once, replay/refresh deduplication, failure with no lead, reject/withdrawal with no application lead, later Marketing consent with no eligibility upgrade, and every public/private boundary. Preview is not proof of publication. Use test fixtures and isolated destinations; never create real bookings or send customer details for verification.

The last read-only public-container inspection found no published tags/rules in `GTM-KQ8GR36H`; that historical observation is not authenticated live-account verification. Publishing and destination verification remain owner/SEO tasks. Missing Health Monitor credentials still correctly yield Not Verified.
