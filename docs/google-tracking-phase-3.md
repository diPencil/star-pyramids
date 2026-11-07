# Booking funnel measurement

| GTM Custom Event trigger | GA4 Event name | Event parameters | Application milestone |
| --- | --- | --- | --- |
| `sp_add_to_cart` | `add_to_cart` | `event_id`, `items` | The cart accepts a new tour configuration. Replacing the same configuration or rejecting an addition generates no event. |
| `sp_begin_checkout` | `begin_checkout` | `event_id`, `items` | Checkout has a ready catalogue and a nonempty, valid basket. An unchanged basket reuses its ID across rerenders and refreshes in the same tab until a successful receipt. |
| `sp_booking_created` | `booking_created` | `event_id`, `items`, `value`, `currency` | Checkout accepts a successful receipt for a persisted booking. A verified replay or recovery returns the same event ID. |

Each item has a public tour slug as `item_id` and a `quantity` of 1 for each booking configuration. A booking-created item also includes `price`, the saved USD total for that line after discounts and applicable priced add-ons. The event value is the saved booking total, which must match the sum of those lines to the cent. A pending booking represents a booking request and has no purchase or payment event.

## GTM and GA4 configuration

1. Create three exact-match Custom Event triggers from the first column. Use one **Google Analytics: GA4 Event** tag per trigger with the existing site Google tag and the event name in the second column. Use **Once per event** firing. Avoid additional receipt, click, or page-view triggers on these tags.
2. Create Version 1 Data Layer Variables for the top-level keys `event_id`, `items`, `value`, and `currency`. Map only the parameters listed for each tag. This prevents the last booking's value or currency in GTM's data model from being reused by an intent event. Map `items` directly and leave automatic ecommerce data collection off on these tags. Use the existing safe Google tag context. Exclude DOM, form, link, booking-reference, and user-data variables.
3. In each funnel tag's consent settings, require `analytics_storage` as an additional consent check. The application queues the events only with affirmative analytics consent and checks it again before dispatch. Keep the existing consent defaults and update path. Verify that a consent manager supplies the explicit visitor choice through the [Phase 2 consent bridge](google-tracking-phase-2.md).
4. Keep `booking_created` a regular GA4 event. Leave Google Ads conversion tags, GA4 key events and Ads imports for this funnel inactive for Phase 3. Keep the existing explicit page-view flag and its coordinated GTM/GA4 settings.
5. Check for one tag execution per event and inspect the allowlisted parameters in an isolated container with a test destination before publishing. Include a multi-item event immediately followed by a single-item event and confirm the second tag receives only its own item. Treat `event_id` as a diagnostic and downstream reconciliation key. The application handles local deduplication and the ID alone gives no delivery or deduplication guarantee in GA4.

[GTM Custom Event triggers](https://support.google.com/tagmanager/answer/7679219) · [GTM Data Layer Variables](https://support.google.com/tagmanager/answer/7683362/) · [GA4 ecommerce event configuration](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce?client_type=gtm) · [GTM consent checks](https://support.google.com/analytics/answer/10718549)

## Privacy, recovery and delivery

Checkout and receipts stay outside the Google tracking boundary. The request captures separate Analytics and Marketing grants, and the original booking transaction stores per-booking proofs. An authorized replay returns the same opaque event ID and saved values while the original Analytics grant remains current. Marketing eligibility carries through only when the original Marketing grant also matches. The booking receipt and business recovery remain available independently of measurement. Older measurements without grant proofs are excluded. Visitors with an older saved choice can save their preferences again to establish proofs for new bookings.

The browser stores the allowlisted pending event, its capture time and, for booking creation, the grant identifiers. The dispatcher keeps those identifiers out of Google payloads. It adds the boolean `ads_eligible` to `sp_booking_created` only, with true requiring continuous Marketing consent from capture to dispatch. Keep the existing GA4 parameter mapping. For a future approved Ads tag, require both the exact event and `ads_eligible` equal to boolean true in addition to current advertising consent, and use `event_id` as the transaction ID. Keep ordinary GA4 `booking_created` out of Ads imports because it includes Analytics-only leads.

The queue drains after GTM loads on an eligible public page on the same origin. Pending events expire after seven days. Analytics withdrawal or a different grant invalidates an old lead, even if a storage cleanup was missed. Browser-local markers suppress duplicate dispatch across refreshes and retries. Web Locks coordinate simultaneous drains where available.

GTM receives events at dispatch time. Checkout events can arrive later than the underlying action and under the context of the public page that drains them. Delivery depends on booking acknowledgement or authorized recovery, a return to an eligible page, browser storage, consent, and GTM availability. Clearing storage or switching browser or origin removes access to the local queue and deduplication markers. Browser enqueueing provides no acknowledgement from Google.
