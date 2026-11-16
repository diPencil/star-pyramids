# Customer social sign-in

The Google and Facebook tabs under Admin → Settings store each provider's Client or App ID, encrypted secret and customer enable switch. **Test saved login** runs the actual provider authorization, code exchange and identity lookup. It reports the result to the administrator who started the test and creates no customer session or connection. The test can run with public sign-in disabled. A successful test applies to the tested credentials and current browser for ten minutes.

## Initial deployment

1. Back up the target database and review the additive `20261116000000_customer_social_login` migration in an isolated MySQL copy. It creates `social_identities` with a foreign key to `users` and `facebook_login_revocations` to invalidate pending authorizations. The existing registration fields and customer records are retained.
2. Configure `SOCIAL_AUTH_ENCRYPTION_KEY` as a persistent, randomly generated 32-byte key encoded as 64 hexadecimal characters in the server's secret facility. Use the same key on every instance in this environment. Key changes require administrators to re-enter the provider secrets. Existing plaintext OAuth secrets must be replaced through Settings before the provider is available. Credentials are never returned to the browser.
3. Use the canonical HTTPS origin set by `NEXT_PUBLIC_SITE_URL` for both the public forms and the callback. The fallback origin is `https://starpyramids.com`. The other host variants must redirect to the canonical origin before starting OAuth.
4. Have the authorized operator apply the migration before exposing OAuth and generate the Prisma client from the new schema. Neither operation belongs in a settings change. Keep public provider toggles off during provider testing.

The administrator test verifies the provider exchange. Verify the two database tables separately before enabling customer sign-in or registering the Facebook deletion callback. If rolling back to a release without the customer-only session check after activation, revoke the social-issued sessions first or use a rollback build that retains the check.

## Administrator setup after deployment

1. Use an OAuth web client in Google Cloud or Facebook Login in Meta Developers. Register the exact HTTPS login callback shown in the relevant tab. For Facebook, also register the displayed **Data deletion callback** in the Meta App Dashboard and tell users in the published privacy policy how to request deletion. Use a separate provider app and origin for sandbox checks.
2. Enter the ID and secret, then save. Click **Test saved login** and complete authorization with a permitted test account. Review the provider's own error if it refuses authorization.
3. Enable the provider and save. Verify an existing customer can link by password once, a new customer can finish standard registration, and the linked customer can then return by social sign-in alone. Complete provider testing with both providers before exposing them to customers.

Account linking uses the provider's stable account ID, scoped to the OAuth app. It requires an existing customer's password or a successful normal customer registration including the existing Terms and Privacy acceptance. Each form submission must match the pending authorization that populated the form. An authorization in another tab cannot silently replace it. Provider email, profile, passwords and tokens are not stored. The server rejects blocked customer accounts and issues customer-only social sessions. A provider switch affects future sign-ins. Existing sessions expire or are revoked through the existing session system.

Facebook deletion requests must carry a valid Meta signature for the configured App Secret. A successful request removes the app-scoped Facebook identity link and returns a status URL and confirmation code. The status remains available for 30 days. The callback leaves the local customer account, bookings, password login and any Google link intact. Test a deletion with a sandbox Facebook account using Meta's Apps and Websites instructions before public activation. Replacing the App ID requires the matching App Secret. Resolve outstanding deletion requests for the old app before switching IDs.

Facebook deletion and linking serialize on the same keyed digest. A request recorded before the customer submits their link blocks earlier authorizations. If the older link commits first, the deletion removes it by authorization time. A fresh authorization can link after the deletion. The revocation row contains a keyed digest and timestamp only. Later callbacks prune rows older than the maximum authorization window, with a one-minute margin.

## GTM and GA4 measurement

Use exact GTM Custom Event triggers `sp_sign_up` and `sp_login`. Map them to GA4 `sign_up` and `login`, respectively, and pass the top-level Data Layer Variable `method` (`google` or `facebook`). The optional `event_id` is an opaque random ID for troubleshooting and local deduplication. Keep one GA4 tag per milestone and require Analytics consent.

Sign-up is measured after the account and provider link are saved and the local session is issued. Login is measured after an already-linked user completes OAuth and receives a customer session. First-time linking by password, failed attempts and admin tests create no event. The grant recorded when OAuth started must still match at dispatch. Private login, registration, callback and account pages do not initialize GTM. The receipt waits up to ten minutes for the next eligible public page in the same browser. Customers who remain in their account or never return to a public page in that window will not be counted. Refresh and repeated public pages do not intentionally redispatch the same receipt. Privacy tools, unavailable storage, network failures and a blocked container can prevent delivery. The tracking payload contains no address, identity, URL, auth token or consent proof.
