# Google Tracking Health Monitor

The existing Admin SEO → Global Settings → Tracking & Analytics form owns GTM enablement, GTM Container ID and the nonsecret `tracking.ga4MeasurementId` setting. GA4 is a destination expectation for GTM; saving it does not install another loader. Existing `SiteSetting` storage is sufficient. There is no schema change or migration.

## Independent evidence

- Configuration verifies only the saved ID formats and enabled toggle.
- Published Container uses authenticated Tag Manager API `containers:lookup` followed by `versions:live`. It never inspects a workspace or treats Preview as publication. Empty containers require action. A built-in Google tag (`googtag`) or legacy GA4 configuration tag (`gaawc`) must contain the exact literal Measurement ID, be unpaused, and have a firing trigger. This verifies configuration, not execution. Dynamic variables, GT- linked destinations and custom templates need manual review and remain unverified.
- Without credentials, or if the authenticated GTM API fails, the server checks the public GTM script URL for the saved container ID. It reports the HTTP status when available and whether Google returned a JavaScript response. The check discards the response body, follows no redirects and sends no analytics hit. Public script evidence leaves the authenticated check's status unchanged.
- Browser Load requests an ephemeral, same-origin BroadcastChannel snapshot from open public tabs. It retries within the same 1.2-second window and uses the latest result per responder to allow time for hydration and GTM load. Responders report eligibility, container ID, current optional consent, script lifecycle and observation time, plus any observed CSP violation's allowlisted Google origin, directive and disposition. Probe and responder IDs are ephemeral. No page URL, CSP nonce, consent identifier, customer field or event content is transmitted. The check never navigates, initializes a tag or changes consent. Advanced mode can verify script loading with optional consent denied. An unavailable channel or absent public tab remains Not Verified. Loaded evidence applies only to the observed tabs. See [Advanced Consent Mode and CSP](google-consent-mode-and-csp.md) for the approved policy, runtime tag restrictions and conditional CSP diagnosis.
- GA4 reception first resolves the configured Measurement ID to its web stream using Analytics Admin API. Data API then queries aggregate eventCount/keyEvents for that stream and the production hostnames for the last seven complete days (GA4 property timezone). A 400 response retries eventCount alone; unavailable key-event totals remain null. Realtime reports the same stream's last 30 minutes; it cannot isolate hostname and is supporting evidence only. Zero events may mean low traffic, consent, filters or reporting latency. Realtime errors and historical results are shown independently. Received data does not verify every event, attribution or conversion.

Overall is Verified only when all four checks are Verified. Server-only results always leave Browser Load Not Verified. Saved IDs, an HTTP 200 download or historical GA4 reception alone cannot turn the overall indicator green.

## Secure server setup

Configure these in the server's secret environment facility; never in `NEXT_PUBLIC_*`, source control, a browser field, a report, or plaintext CMS settings:

- `GOOGLE_TRACKING_SERVICE_ACCOUNT_JSON`: service-account JSON containing `type`, `client_email`, and RSA `private_key`. The implementation pins the token endpoint; credential-provided URLs are ignored. Rotate and restrict the key under the normal secret-management process.
- `GOOGLE_TRACKING_GA4_PROPERTY_ID`: the numeric GA4 property ID, not the G- Measurement ID.

Enable Tag Manager API, Analytics Admin API and Analytics Data API in the credential's Cloud project. Grant the service-account email Read permission on the intended GTM container/account and Viewer access on the GA4 property. Requested OAuth scopes are only `tagmanager.readonly` and `analytics.readonly`. The verifier has no publishing or Google-account write operation. Missing credentials produce Not Verified; permission/authentication failures require action; timeouts/API failures are errors. No real credentials or external account access were used in mocked tests.

## Admin access and operation

`POST /api/admin/tracking-health` requires same-origin CSRF validation, an authenticated staff identity and existing `settings.edit` permission. It checks saved settings only and sends private/no-store responses. It accepts no caller-supplied URL, credential, property or container. Per-process limits are one check per administrator per minute and 20 checks per minute globally. Multi-instance hosting should also rate-limit this route at the trusted ingress. Each outgoing request has at most a five-second timeout and the API client has a 24-second request budget; response bodies and stream pagination are bounded. Errors and public evidence are projected, never raw Google responses, tokens or credential contents. Results are ephemeral; no verification result is written to the database.

Save configuration first. Use **Open public homepage in a new tab**, wait for the page to load and keep it open, then press **Verify Connection** in Admin. Reload any public tab that was already open before the latest deploy. No test traffic, lead, booking or conversion is generated by the monitor. The admin-only monitor has local EN/AR controls and logical RTL/LTR spacing; it does not enable Arabic in public routes or change the admin shell's language policy.

This monitor does not replace GTM Preview/GA4 DebugView for event-level QA. It does not enable the explicit page-view flag, create conversion tags, or change the published container. Production activation and publishing remain separate owner-controlled actions.

## API references

- [GTM container lookup](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers/lookup)
- [Published container version](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.versions/live)
- [GA4 web stream lookup](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.dataStreams/list)
- [Data API reports](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport)
- [Realtime schema](https://developers.google.com/analytics/devguides/reporting/data/v1/realtime-api-schema)
- [Service-account OAuth](https://developers.google.com/identity/protocols/oauth2/service-account)
