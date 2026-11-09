# Advanced Consent Mode and CSP

The owner approved pre-consent cookieless Google signals on 2026-11-08. `SiteMeasurement` now requests Advanced mode on the existing production-only public boundary. CMS disablement, container validation, host restrictions, sensitive query/fragment exclusions and admin/account/preview exclusions remain unchanged. The low-level loader still supports Basic mode for a policy rollback; no environment setting, database or Google account was changed.

## Consent and container contract

Before appending `gtm.js`, the loader queues denied defaults for `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization` and `personalization_storage`, and enables `ads_data_redaction`. Only essential functionality/security storage defaults are granted. Existing persisted preferences are re-read when loading completes. Accept, reject, withdrawal and cross-tab updates use the existing consent bridge. A storage failure keeps optional consent denied. Loading the container does not grant consent.

Advanced mode may send Google cookieless measurement/consent signals before acceptance and after rejection. It is not a promise of zero network traffic or anonymization. Confirm the published privacy/cookie notice covers this behavior. Application page/click/booking/trip-request events still require their existing consent and URL guards; no `purchase`, duplicate GA4 loader or automatic application page views were introduced. Third-party requests already sent cannot be cancelled by these guards.

Advanced startup sets `gtm.allowlist: ['google']` and blocks `html`, `customScripts`, `customPixels`, `nonGoogleScripts`, `nonGooglePixels`, `nonGoogleIframes`, and `sandboxedScripts` before GTM executes. Custom HTML, custom JavaScript, custom templates and non-Google tags remain unavailable even after acceptance. Do not remove these restrictions to make a marketing tag fire. A future non-Google integration requires a separate consent-aware review.

Review the published container before release: use modern consent-aware native Google tags only; remove legacy tags without built-in Consent Mode support. Runtime class restrictions cannot attest that every Google tag's configuration is safe. No tag should override the site's defaults or grant consent. No Custom HTML consent bootstrap or separate GA4 script is needed. Tags outside GTM are outside its allowlist/blocklist control.

Use one Google tag with the intended GA4 destination. An Initialization trigger can initialize it under denied consent in Advanced mode; do not additionally fire a second configuration on `sp_consent_ready`. Google tags use built-in consent checks. Application Custom Event tags retain Analytics consent requirements; Ads booking leads also retain their captured Marketing eligibility and deduplication. Unpaid requests remain leads. The existing explicit page-view flag is unchanged: keep automatic initial/history page views disabled when explicit `sp_page_view` is activated. Do not activate two page-view mechanisms.

## Public planner and trip-request lead delivery

For the additional contact/help, car and event forms, see [Public form lead tracking and handoff](google-form-lead-tracking.md), including the intentionally deferred private/address-bearing cases.

The public `/make-your-trip` route is now eligible, including typed public entry dates, tour/destination slugs, bounded traveler counts, add-on indexes and the existing validated campaign/debug parameters. Duplicate keys, invalid dates, free text, contact details, edit/reference/token parameters and planner fragments remain excluded. Admin/account/preview and booking access links remain excluded. Application page views use the fixed title `Plan Your Egypt Trip | STAR PYRAMIDS` and canonical `/make-your-trip` URL, omitting all planner query values. The explicit page-view flag is unchanged.

Older saved consent choices containing booleans without category grant IDs now receive browser-local grant metadata bound to the exact saved record, so existing explicit choices remain usable for lead measurement. This does not grant a denied category or rewrite the consent choice. A concurrent withdrawal wins; unavailable metadata storage fails closed. The metadata is shared across tabs/reloads and never enters tracking payloads. Current consent records containing grant IDs use their existing IDs unchanged.

After a confirmed HTTP 201 creation response, the existing `trip_request_created` receipt is stored and immediately offered to the existing consent-aware queue dispatcher on the planner. GTM loading/reconnection uses the existing ready/online flush. The visitor no longer needs to visit a catalogue page. A denied, withdrawn or replaced Analytics grant cannot dispatch the lead. Marketing granted later cannot upgrade the captured lead's Ads eligibility. Existing delivered markers and cross-tab locks are reused; failures, edits and refreshes do not create new events. Storage/network blockers can still prevent optional measurement; dataLayer enqueueing is not a Google delivery acknowledgement.

Payload: `{ event: 'trip_request_created', event_id: 'tr_<32 hex characters>', ads_eligible: boolean }`. No names, email, phone, notes, request reference, budget, preferred dates or purchase value is included. The opaque event ID comes from the server after persistence. No `purchase` is emitted.

Read-only inspection on 2026-11-08 of the publicly served `https://www.googletagmanager.com/gtm.js?id=GTM-KQ8GR36H` resource returned HTTP 200 with empty `tags` and `rules` arrays, and no native Google tag/GA4 event tag type. This is limited evidence about that public response, not authenticated account/workspace inspection. A container ID in CMS cannot create the missing published tags.

SEO owner setup (no Google account changes were made by this code change):

1. Create one native Google tag for the intended GA4 Measurement ID, verify the destination, and initialize it once using Advanced Consent Mode built-in checks. Do not use Custom HTML or a separate gtag loader; those are intentionally restricted. Do not initialize a duplicate on `sp_consent_ready`.
2. Add Data Layer Variables (version 2) `event_id` and `ads_eligible`. Add a Custom Event trigger with the **exact name `trip_request_created`**, and one native GA4 Event tag with event name `trip_request_created`, the existing Google tag destination and `event_id` parameter. Require `analytics_storage` consent for this lead tag. Do not attach raw form/DOM fields, URL query variables or user-provided data.
3. Disable GA4 automatic form-interaction measurement and automatic user-provided-data/Enhanced Conversions collection on this planner; the form and confirmation display customer data. Use the explicit lead only. Review all native Google tags for DOM extraction and automatic data collection before publication. Application payload projection does not prevent an externally configured tag from reading the DOM.
4. Mark the GA4 event as a lead key event if desired. If a Google Ads lead conversion is configured, trigger only on this event with `ads_eligible === true` and current Marketing consent requirements, use `event_id` as the transaction ID, and do not also import the same lead as another primary conversion. Do not infer a sale or use the visitor's preferred budget as revenue.
5. Preserve one page-view strategy according to the existing explicit-page-view flag. Do not enable additional history/page-view mechanisms as part of this lead setup. Validate in Preview that defaults are denied before loading, saved choices update correctly and the lead dispatches once after a consented successful request. Then review and publish the container. DebugView/Ads delivery and the actual published settings remain external verification steps; use isolated test transactions, never real customer details.

## CSP findings and narrow fix

### Cart boundary update — 9 November 2026

`/cart` is eligible for the existing production-only loader, including the bounded Tag Assistant signal. It displays selected public tour products without the checkout's name/email/phone fields or private booking links. Application page views use the fixed `Cart | STAR PYRAMIDS` title and canonical `/cart`, stripping query parameters. This does not activate the explicit page-view flag, add conversions or configure Google tags.

`/checkout`, account/authentication and token-bearing booking pages remain excluded. The proxy requires a fresh document when navigating from the now-eligible cart to checkout, so the previous document's GTM cannot follow the SPA into the private form. Sensitive cart query parameters and fragments are also excluded. An already-loaded external tag cannot be cancelled by an application event guard; retain the published-container privacy review and avoid automatic form/user-data collection.

A Tag Assistant “No Google tags found” warning on protected checkout pages is expected under this policy. It does not establish that booking persistence failed. Existing checkout events remain deferred until a safe public document is available; do not solve that delivery limitation by loading arbitrary tags on private pages.

The subsequent owner-approved [safe booking confirmation flow](google-booking-confirmation.md) now establishes that public document automatically after an acknowledged successful booking. Its generic public page drains the same receipt; private details remain in a separate protected document. Optional handoff failures retain the original receipt and deferred fallback.

### Sitewide URL compatibility review — 9 November 2026

Two ordinary URL producers disagreed with the shared eligibility policy: public section links added fragments that stopped application events, and catalogue filters emitted destination/duration labels that were rejected. This affected successful contact/event leads after their section CTAs as well as ordinary filtered catalogue navigation.

The shared policy now accepts only reviewed literal section anchors on their owning public routes (for example `/contact#contact-enquiry`, `/events/<slug>#event-book` and the existing catalogue section CTAs). Unknown or modified fragments, anchors on private routes, and unsafe query combinations remain excluded. Every application URL payload strips fragments. A section jump does not create a second explicit page view. Existing tags can still read the actual document; application guards cannot cancel a third-party request or attest its DOM-reading configuration.

Catalogue filters accept reviewed public place names/combinations already present in the reference catalogue, plus bounded numeric hour/day/night labels and the existing fixed duration options. They do not accept arbitrary text. New CMS place names and other unreviewed label formats continue to fail closed until reviewed. The dropdowns and application routing are unchanged; free-text `q` search, transfer addresses and private request-edit URLs remain excluded.

`tests/tracking-route-policy.test.ts` inventories every current `app/**/page.tsx`. New routes must receive an explicit public/private decision. It checks public document/Flight eligibility, protected boundaries, payload sanitization, and compatibility with all reference-catalogue location/duration values. Related loader, page-view and form-receipt tests cover first loads, section navigation, consent and deduplication. This is automated code verification, not browser or Google delivery verification.

| Journey | Intended behavior |
| --- | --- |
| Reviewed public pages and static section links | One Advanced GTM loader; denied defaults before execution; application events require verified Analytics consent |
| Reviewed public catalogue filters, planner, contact and event forms | Safe payloads; leads only after persistence; no raw fields or fragments |
| Checkout, booking access, login/account/admin/preview | No GTM; fresh document boundary; booking receipts may drain later on an eligible public page/tab |
| Search text, unknown parameters/fragments or transfer addresses | Fail closed; no promise of tag detection or immediate lead delivery |
| Reject all or Marketing-only | No application Analytics events; approved Google cookieless signals may still occur |
| Analytics-only | Application events permitted; lead `ads_eligible` remains false |
| Withdraw/regrant | Old lead grants are not revived; current consent always applies |

Production sign-off still requires a single published native Google tag with the intended GA4 destination; exact Custom Event tags for `sp_page_view` (only after explicit cutover), `sp_navigation_click`, `sp_select_item`, `sp_book_now_click`, `sp_search_submit`, `sp_cta_click`, `sp_contact_click`, `sp_add_to_cart`, `sp_begin_checkout`, `sp_booking_created`, `trip_request_created`, `enquiry_created`, `car_request_created` and `event_request_created`; and matching version-2 variables. Keep one page-view strategy, built-in Consent Mode checks, Analytics consent for application events, and captured/current Marketing eligibility for Ads leads. Application delivered markers suppress duplicate enqueueing; map the stable lead `event_id` to the Ads tag's transaction/order ID. A GA4 `event_id` parameter alone is not a universal custom-event deduplication guarantee. Disable automatic form/user-provided-data collection. Do not configure unpaid bookings as purchases.

Do not interpret an empty container, missing Google credentials, denied consent, an excluded URL, a blocked browser request, and missing GA4 reception as the same failure. Health Monitor reports these independently. Live publication, destination ownership, Preview/DebugView delivery, CSP console violations and browser blockers remain external verification; local tests do not prove them.

Read-only public-resource inspection repeated on 9 November returned HTTP 200 (333,357 bytes), with empty `tags` and `rules` arrays and no `__googtag`, `__gaawc` or `__gaawe` tag types in that response. The script was not executed and no events were sent. This limited public evidence still requires the SEO owner to inspect the correct account/container's published version; it does not reveal unpublished workspace changes or prove that every visitor receives the same response.

Read-only HTTPS inspection of `/`, `/trips`, and `/privacy` returned only `Content-Security-Policy: upgrade-insecure-requests`, no Report-Only header and no meta CSP. This directive does not block HTTPS Google scripts. There is no page-level CSP builder in `proxy.ts` or `next.config.mjs`. The image optimizer's `script-src 'none'` policy protects SVG/image responses; it must remain unchanged. Iframe-specific policies must likewise not be weakened to address a page-level warning.

The dynamic GTM element now copies an existing page script's `.nonce` when present. This supports an upstream nonce policy without introducing inline code, generating a fake nonce, changing hashes, or broadening allowed origins. GTM itself propagates the nonce to supported descendant scripts. A missing/mismatched upstream nonce still requires fixing the policy owner.

The browser health responder now observes `securitypolicyviolation` before initialization and reports only a recognized Google origin, directive and enforce/report disposition. It never reports query strings, fragments, script samples, page URLs or `originalPolicy`/nonce values. This is passive, bounded local-tab evidence, not a new CSP permission or an independent guarantee of delivery. A loaded container is Browser Load Verified even under denied consent; the displayed consent values remain denied and GA4 reception stays independent.

No exact blocked resource/directive was supplied and no restrictive page header was observed. Therefore **no origin allowlist was widened**. A generic Tag Assistant warning is insufficient evidence for a security policy change. Capture the real Console violation and response headers from the affected document (including iframe context and any Report-Only policy) before changing Hostinger/proxy headers. Multiple CSP headers intersect; adding a permissive second policy cannot override a blocking first one.

## Production verification and conditional CSP changes

1. On a clean eligible public page, inspect the document headers and Console. Record the exact blocked resource and effective directive, excluding tokens/nonces. Check extensions separately. Do not submit a real booking for this test.
2. Confirm exactly one `https://www.googletagmanager.com/gtm.js?id=GTM-KQ8GR36H` request before acceptance. GTM is dynamically injected after hydration, so absence of the URL in raw server HTML is expected. Confirm denied defaults precede `gtm.js` in Tag Assistant.
3. Only if that URL is blocked by an origin-based `script-src`/`script-src-elem`, add `https://www.googletagmanager.com` to the existing responsible directive, retaining its nonce/hash restrictions. Under `strict-dynamic`, a valid nonce may be required instead of a host entry. Do not create or replace a sitewide CSP from this example.
4. For actual GA4 violations, narrowly authorize only the observed endpoint and directive: commonly `https://www.google-analytics.com` or `https://region1.google-analytics.com` under `connect-src` (and `img-src` only if an actual pixel uses it). Ads endpoints require separate evidence and the relevant consent. No wildcard Google domains are necessary as a speculative fix.
5. Preview may need `https://tagmanager.google.com` in `script-src-elem`/`style-src`, `https://www.googletagmanager.com` in `style-src`, `https://fonts.googleapis.com` in `style-src`, `https://fonts.gstatic.com` in `font-src`, and `https://ssl.gstatic.com`/`https://www.gstatic.com` in `img-src`. Apply only the resources shown blocked in the affected policy/context. Do not add `unsafe-inline`, `unsafe-eval`, wildcard script sources or remove an existing nonce/hash. Custom JavaScript variables should be replaced rather than permitting eval.
6. Test Accept All, Reject Optional, Analytics-only, Marketing-only, reload, cross-tab withdrawal and withdrawal during loading. Verify four Consent Mode flags follow the saved choices, while denied users produce no application interaction/conversion events. Check that custom/non-Google tags stay blocked.
7. Verify admin/account/preview pages never inject GTM on direct loads, and sensitive SPA navigation denies application events. An already-loaded external container cannot be disabled by an application event guard; inspect its history, enhanced measurement and URL collection settings explicitly.
8. Use GTM Preview to inspect firing/consent and GA4 DebugView to inspect consented, isolated test events only. Preview detection proves neither publication nor GA4 reception. Keep conversion setup, explicit page-view cutover and destination verification separate. Disable extra automatic history/page views before any explicit cutover.

Rollback before release if policy approval changes: switch the `SiteMeasurement` initializer's mode from `advanced` to `basic`, then verify no request before consent. Reload to remove an already-loaded third-party script; removing its element cannot undo transmitted requests. No schema or data changes are involved.

References: [Google Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode), [GTM runtime restrictions](https://developers.google.com/tag-platform/tag-manager/restrict), [Google CSP guidance](https://developers.google.com/tag-platform/security/guides/csp).
