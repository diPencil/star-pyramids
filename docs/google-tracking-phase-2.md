# Google tracking Phase 2

The application queues the events below on eligible HTTPS public pages on the production hosts. The admin GTM toggle and container ID still apply. Every analytics event requires analytics consent from the existing `sp-consent` bridge. The sitewide Cookie settings control uses that bridge to save explicit analytics and marketing choices, including withdrawal on private pages. A verified optional grant allows the container script to load with denied defaults. Once the script finishes, the app rechecks the URL and current saved choice, applies the consent update, then pushes the internal `sp_consent_ready` signal when at least one optional category is granted. Use that exact Custom Event to start the applicable base tags with the relevant category checks and once-per-document firing. Keep the signal internal to GTM. Verify ordering in Preview, including a late Analytics grant after a Marketing-only start.

Inspect the Consent tab and network requests as well as the data layer. Google distinguishes queue order from consent processing inside a container and recommends its native Consent APIs for GTM templates that require deterministic ordering. Validate a fast withdrawal while the script is pending, then check tags that are already loaded. [Google consent setup guidance](https://developers.google.com/tag-platform/security/guides/consent)

## Page view cutover

The app-owned page view is opt-in. Leave the server environment variable `TRACKING_EXPLICIT_PAGE_VIEWS` unset until the GTM and GA4 changes below are ready. Set it to `true` on the application server for the coordinated cutover. No environment variable is needed for the interaction events.

1. On the existing Google tag for the target GA4 stream, set configuration parameter `send_page_view` to `false` before enabling the application page view. Keep the tag initialization for measurement and attribution.
2. In that GA4 web stream, open **Enhanced measurement → Page views → Show advanced settings**. Turn off **Page changes based on browser history events**. `send_page_view=false` alone does not disable the independent history events.
3. Remove or pause any other initial-load or GTM History Change GA4 `page_view` tags for these pages. Trigger the manual GA4 page-view tag only on `sp_page_view` as described below. Verify one view per intended navigation before enabling live reporting.

The app observes the App Router’s committed pathname and search state. Initial entries, public route changes, pagination, and back/forward revisits count. Duplicate renders, attribution-only changes, and filter-only changes do not. The page path and location retain only an eligible route and validated `page` above 1. The title is a stable label based on the public route or catalogue slug. It does not copy the page DOM, translated content or SEO metadata.

## GTM event configuration

Create an exact-match **Custom Event** trigger for each event. Create one **Google Analytics: GA4 Event** tag for each trigger and point it at the existing GA4 stream. Configure **Require additional consent for tag to fire** with `analytics_storage`. For each parameter in the table, create a **Data Layer Variable** with the same name and add it as an event parameter on that event’s tag. For `items`, pass the array as a variable so its structure is retained.

| Custom Event trigger | GA4 event name | Event parameters |
| --- | --- | --- |
| `sp_page_view` | `page_view` | `page_path`, `page_location`, `page_title` |
| `sp_navigation_click` | `navigation_click` | `placement`, `destination` |
| `sp_select_item` | `select_item` | `items` (`[{ item_id }]`), `placement` |
| `sp_book_now_click` | `book_now_click` | `item_id`, `placement` |
| `sp_search_submit` | `search_submit` | `placement` |
| `sp_cta_click` | `cta_click` | `cta_id` |
| `sp_contact_click` | `contact_click` | `channel`, `placement` |

Navigation values identify a section and a placement. Contact channels are `whatsapp`, `email`, `phone`, and `contact_page`. Tour item IDs are public slugs. CTA IDs identify positions or actions, for example `hero_primary` or `shore_enquiry`. Search records the initiating surface without the query or any field value. Search results and the contact form route remain outside the Phase 1 measurement boundary.

Use GA4 event-scoped custom dimensions for any additional categorical fields needed in reports, such as `placement`, `destination`, `channel`, and `cta_id`. Do not map GTM Click URL, Click Text, form variables or DOM scraping into these tags. Review automatic Enhanced Measurement outbound clicks, site search, and form interactions before publishing. Disable those automatic collectors where they duplicate the intent events or could collect raw URL or form data. Inspect any implicit location and referrer parameters and apply the stream’s data redaction rules as defense in depth.

Treat these as engagement events. Keep the triggers out of Google Ads conversion tags and purchase or booking-completion goals. The application does not define those conversions in Phase 2.

References: [GA4 SPA measurement with GTM](https://developers.google.com/analytics/devguides/collection/ga4/measure-spa-gtm), [GA4 page view settings](https://developers.google.com/analytics/devguides/collection/ga4/views), [GA4 recommended events](https://developers.google.com/analytics/devguides/collection/ga4/reference/events), [Google Analytics privacy guidance](https://support.google.com/analytics/answer/6366371).

## Isolated QA

The Node tests simulate eligible and excluded hosts, URL transitions and delayed script load with an in-memory data layer. Keep browser testing with a separately authorized QA operator under the repository rules.

For a later browser pass, use a disposable production-mode copy with fixture catalogue responses or an isolated fixture database. Omit operational credentials and block egress to the operational database and live Google destinations before starting. Inside that isolated runner only, resolve the allowlisted site hostname to a local TLS reverse proxy that preserves the Host header. Serve a local inert script in place of the GTM request so the real loader path and load callback run without executing published tags. Include a second local hostname outside the allowlist. Exercise reject, grant, fast withdrawal while holding the stub response, clearing a fragment without reloading, and protected routes. Account-level Preview and network verification require a separate approved test container and property. A production build also needs writable disposable output and isolated font assets.
