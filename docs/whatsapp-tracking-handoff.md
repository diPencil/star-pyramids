# WhatsApp widget tracking and GTM handoff

## Confirmed code findings

The desktop/mobile widget launcher is a button, not an outbound link. It had no
application event for opening the panel. Submitting a nonempty draft already
dispatched sp_contact_click, then called window.open after a 700ms timeout.
That programmatic handoff is not a GTM Just Links click; delaying it also risks
losing the browser's user activation. The separate WhatsApp link offered by the
live-chat suggestions had no application tracking handler.

The screenshot of gtm.linkClick does not prove a custom event fired, a Google tag
matched it, or GA4 received it. Published GTM/GA4 configuration was not inspected
or modified. A missing/mismatched Custom Event trigger remains an external
configuration possibility, not a confirmed account diagnosis.

## Events and milestones

| Action | dataLayer event | Safe parameters |
| --- | --- | --- |
| Open widget using desktop or mobile trigger | sp_whatsapp_open | channel: whatsapp; placement: support_widget |
| Submit a nonempty widget draft to open WhatsApp | sp_contact_click | channel: whatsapp; placement: support_widget |
| Follow the WhatsApp suggestion in live chat | sp_contact_click | channel: whatsapp; placement: support_widget |

Closing the panel, typing and blank submissions do not dispatch these events.
The handoff opens synchronously in the original submit gesture; the greeting
animation retains its existing timer. Events use the existing typed dispatcher,
production-host/public-URL boundary, startup queue and Analytics consent guard.
Marketing-only consent does not authorize application Analytics events. Private
routes remain excluded, and withdrawal prevents queued startup delivery.

The draft and company phone number go only to the intended WhatsApp handoff URL,
not the application event payload. Payload projection excludes arbitrary fields,
form text, personal details, numbers, URLs and booking references. Google automatic
form/link collection must also be reviewed separately in the published container.

These events measure opening/contact intent. The website cannot confirm that a
message was sent or delivered inside WhatsApp. They are neither booking-created
events nor purchases, and must not be described as confirmed messages.

## SEO/GTM setup

1. Custom Event trigger with exact name sp_whatsapp_open. Optional GA4 event
   mapping: whatsapp_widget_open. Use Analytics consent; keep it informational,
   not a primary Ads lead conversion.
2. Custom Event trigger with exact name sp_contact_click. Filter channel equals
   whatsapp (and placement equals support_widget for this widget-specific report).
   Reuse the existing GA4 contact_click mapping if already present; do not add a
   second competing event tag. Parameters: version-2 Data Layer Variables channel
   and placement only. No Click URL, form values, draft text or phone parameters.
3. If Ads measures WhatsApp contact intent, configure it deliberately as such,
   preferably Secondary until quality is assessed. Require current Marketing/Ads
   consent in addition to the application Analytics guard. Never count panel
   opening and contact handoff as two instances of the same lead. Do not also
   import the same GA4 key event and fire a native Ads tag as two primary actions.
4. Disable competing generic gtm.linkClick/Click URL conversions for these same
   interactions. The live-chat suggestion is an anchor and can also produce the
   built-in link event; the application custom event must be the single chosen
   measurement path. Keep existing Google tag/page-view setup unchanged.
5. In Preview on an eligible public production page with explicit Analytics
   consent, check one sp_whatsapp_open per open and one sp_contact_click per
   nonempty submit/link click. Verify the expected GA4 tag under Tags Fired and
   its consent state; then verify receipt in GA4 DebugView. Repeat desktop/mobile,
   EN/ES/IT, denied, Marketing-only, withdrawal and private-page scenarios.

No live destinations, real messages or Google settings were used in local tests.
Focused verification passed: 53 widget/event/render/mobile checks and 127
tracking/consent checks (180 tests across seven files), application TypeScript,
and git diff --check. Neither the full application suite nor a production build
was repeated for this focused instrumentation change.
Local tests establish application dispatch behavior, not published container
mapping, actual popup behavior on every browser or GA4/Ads delivery. Project
instructions prohibit browser automation; production build is not run because
static generation can query the operational database.

References: [GTM Custom Event triggers](https://support.google.com/tagmanager/answer/7679219),
[dataLayer event dispatch](https://developers.google.com/tag-platform/tag-manager/datalayer),
[browser user activation](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/User_activation).
