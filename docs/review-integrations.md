# Review integrations

Admin Settings → Review Integrations owns the four provider configurations.
The existing tour-review API and moderation workflow are unchanged. Local browser
reviews are preserved in localStorage but are no longer presented as verified
external reviews on the homepage. No fabricated ratings, counts or verification
badges are used.

## Supported connection methods

| Provider | Implemented method | Owner supplies | Limitations |
| --- | --- | --- | --- |
| Google | Places API (New), server-side Place Details | Place ID and server API key; enabled Places API, billing and key restrictions | Provider-selected sample (up to five reviews), not a complete export. Author and Google Maps attribution and review-policy link are displayed. |
| Tripadvisor | Content API location details and reviews, server-side | Location ID and Content API key with subscription and access restrictions | Recent review sample, not a complete export. Client fetch only; API routes are blocked by existing robots.txt and send noindex. New Terra subscriptions may require a different adapter after account-specific documentation is supplied. |
| Trustindex | Official loader widget in a sandboxed iframe | Widget ID from the official loader.js URL | No arbitrary embed HTML or script URLs. Saving/checking an ID means configured, not connected. Live widget rendering needs the owner's real widget and may require layout/height adjustments for that widget. |
| GetYourGuide | Profile link and explicit partner-access state | Public profile link, partner approval and account-specific review API documentation | No public review-feed contract was verified. No speculative endpoint, scraping, fake API success or nonfunctional API-key field is included. A real adapter still requires approved documentation; entering a profile URL does not connect an API. |

Sources checked October 10, 2026:

- [Google Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details)
- [Google attribution and policies](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Tripadvisor Location Reviews](https://tripadvisor-content-api.readme.io/reference/getlocationreviews)
- [Tripadvisor review implementation policy](https://tripadvisor-content-api.readme.io/reference/review-implementation-policy)
- [Trustindex official widget installation](https://www.trustindex.io/how-to-insert-your-widgets-code-into-your-site/)
- [GetYourGuide API access requirements](https://partner.getyourguide.support/hc/en-us/articles/13981133907613-API-integration-and-requirements)

## Storage and credentials

Uses the existing MySQL SiteSetting table, only keys
`reviews.integration.google`, `.tripadvisor`, `.trustindex`, `.getyourguide`.
No schema migration, catalogue/customer mutation or provider-review text storage.
New credentials use AES-256-GCM, a separate random nonce, and provider-bound AAD.
GET returns only `secretConfigured`; ciphertext and keys are never returned.
Blank secret keeps the current key; remove is an explicit checkbox. Saves and
test status use compare-and-set, rejecting a concurrent configuration update
rather than restoring a removed/replaced credential. Audit contains provider and
action only. As in existing settings, auditing is best effort and its failure
does not falsely report a completed save as failed.

Set `REVIEW_INTEGRATIONS_KEY` to a cryptographically random 32-byte key encoded
as 64 hexadecimal characters in each server environment before saving keys.
A key was provisioned in the ignored local `.env` without displaying its value.
Back it up securely together with deployment secrets. Keep it stable across
restarts and deployments; losing/replacing it requires re-entering provider keys.
Never commit `.env` or put this key in a NEXT_PUBLIC variable. It is intentionally
not editable through the browser.

Read requires `settings.view`. Saving and testing require `settings.edit` and
same-origin requests. Only documented fixed outbound provider hosts are used,
redirects are rejected, requests time out, responses are size limited and upstream
errors are sanitized. Profile links are HTTPS with exact provider host allowlists.
Trustindex runs without same-origin permission in a sandboxed iframe; no provider
script runs in the parent application context.

## Refresh and publication

Save persists configuration; Test connection / Refresh fetches current data and
records the last test state/time without retaining review text. This is a
connection check, not a background import job. Website tabs fetch live data on
selection/load. No scheduled synchronization or persistent review cache is
installed. Requests deduplicate in flight, and outbound checks are bounded to
30 requests per provider per minute per Node process. A multi-instance deployment
needs a shared quota gate sized to the purchased provider plan before high traffic.
Display defaults off, and disabling hides provider content. Public API responses
are no-store, redact all credentials and carry noindex/nofollow. Empty/unavailable
providers show an honest empty/error state with retry, never a five-star default.

## Verification

### Website reviews (2026-10-10)

The public section also has a Website reviews tab using `/favicon.png`.
Write a review opens the shared review form; sign-in is required and the account
name is used. Submission uses `POST /api/reviews` with `scope: "website"`.
The existing reviews table stores this scope under the reserved `@website` key,
which cannot be requested as a tour. No fake tour, schema migration or existing
record rewrite is needed. Existing `(userId, tourSlug)` uniqueness allows one
website review per account, independently of reviews for actual tours.
All new reviews are PENDING; existing Admin Reviews permissions and moderation
apply. Admin list/detail labels identify website reviews and link to the homepage.
Only PUBLISHED reviews appear at `GET /api/reviews?scope=website` with pagination
and separate real rating/count. No aggregate external-provider score is invented.

Review us on is a separate disclosure dropdown, visible only when at least one
enabled provider has a saved public profile URL, in the All reviews view. Each
provider tab instead has its own icon and Write a review link to that provider;
the action is disabled until its URL is configured. Website reviews opens only
the website form. All reviews renders available cards/widgets from every enabled
source plus published website reviews, without nested source summary bars.
Source icons on the cards retain attribution, and website/provider statistics
remain separate. Links open the configured provider
page in a new tab. The platform controls the actual review-writing flow and any
account/booking eligibility requirements. No local form posts to provider APIs.

Provider icons are bundled local copies of official site assets retrieved on
2026-10-10: `https://static.tacdn.com/favicon.ico`,
`https://cdn.trustindex.io/assets/img/favicon.png`, and
`https://cdn.getyourguide.com/tf/assets/static/favicon.ico`.
No external favicon service or tracking request is used at runtime.

`node scripts/verify-website-reviews.mjs` checks seven real MySQL assertions for
pending, publication, rejection, scope identity and record preservation inside a
rolled-back transaction. It never changes an existing review and leaves no test
records. Website-review route tests additionally cover authentication, origin,
validation, duplicates/race conflicts, failed writes and tour-scope regression.
Browser checks cover the website tab, official icon loading, modal opening,
short-input prevention, Escape/cancel and widths 1440/375. No owner account review
was submitted or published through the browser. External dropdown navigation
requires real configured profile links; live paid integrations remain unverified.

- Focused tests cover validation, host restrictions, encryption/tamper protection,
  key preservation/replacement/removal, compare-and-set, missing credentials,
  official adapter parsing, malformed upstream JSON, redaction, authorization,
  same-origin enforcement, malformed admin bodies and audit failure.
- `node --conditions=react-server --import tsx scripts/verify-review-integrations.mjs`
  verifies seven actual MySQL persistence/encryption assertions inside one rolled
  back transaction. It refuses to run if a Google integration already exists.
  No test rows remain and existing settings are preserved.
- Live credentials, paid provider access and real Trustindex widget execution
  cannot be verified until the owner supplies the respective account details.
- No account creation, login, subscription purchase, provider scraping, commit or
  push was performed.
