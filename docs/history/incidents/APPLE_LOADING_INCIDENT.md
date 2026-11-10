# Apple loading incident: production diagnostics

Date: 2026-10-15 (Africa/Cairo). Investigation is read-only against production; the code fix is local and unpublished.

## Confirmed application defect

`components/locale.tsx` called `window.requestIdleCallback` on provider mount and `window.cancelIdleCallback` on cleanup without feature detection. The provider is used across the public website.

The same unguarded application code was retrieved from the actual production bundles:

- `/_next/static/chunks/5337-91e2f760dff45241.js`
- `/_next/static/chunks/app/not-found-77bab75ded496132.js`

MDN browser-compat-data for both APIs reports Safari support as preview/flagged, not generally available. This API must not be assumed to exist merely because Next.js supports a browser.

The actual LocaleProvider effect was executed in a mocked browser without these APIs. Before the fix, three regression cases failed; the mount case raised `TypeError: window.requestIdleCallback is not a function`. The native-idle case passed. After the fix, all four cases passed: missing APIs, native APIs, unmount cancellation, and a partial implementation.

The minimal fix detects both methods, otherwise schedules the same preference initializer with `setTimeout`, and cancels using the matching API. Locale/currency defaults, persistence, transitions and subscriptions are unchanged. No global polyfill or browser-name detection was introduced.

This proves an application startup failure after HTML delivery on browsers missing the APIs. It is the strongest identified explanation for the Apple report, but the affected physical Apple device and its exact browser-generated error screen have not been reproduced here. Do not claim all possible infrastructure causes are excluded.

## Network and hosting observations

| Check | Observed result | Boundary |
| --- | --- | --- |
| DNS A/AAAA | Both apex and www resolve; www uses `www.starpyramids.com.cdn.hstgr.net` | Google, Cloudflare and local DNS return geographically different CDN addresses; this alone is not misconfiguration |
| IPv4 | Eight sampled edge IPs returned HTTP 200 over HTTP/2 | Not a worldwide or every-network guarantee |
| IPv6 | AAAA records exist | Local environment has no IPv6 default route; both direct target and IPv6 control failed, so production IPv6 reachability remains unverified |
| HTTP redirects | HTTP redirects once to HTTPS; HTTPS apex and www return 200 | No loop in sampled requests |
| TLS/SNI | TLS 1.2 and 1.3 validate for apex and www | Windows/Node/OpenSSL validation, not an Apple trust-store test |
| Certificate | SAN includes both names; valid 2026-10-13 through 2027-01-11 | Leaf issued by Let's Encrypt YE2 |
| Server-supplied chain | Leaf -> YE2 -> Root YE cross-signed by X2 -> X2 cross-signed by X1; OpenSSL verification code 0 | No missing intermediate demonstrated |
| HTTP/2 | Successful page GET on all eight sampled IPv4 endpoints | Verified using Node HTTP/2, not just ALPN negotiation |
| HTTP/3 | CDN advertises h3 on port 443 | Available curl lacks HTTP/3; QUIC/HTTP3 was not exercised |
| Assets | 31 discovered JavaScript chunks returned 200; four CSS assets returned 200 with correct MIME | Public resources only, no authenticated pages |
| User agents | Earlier desktop/iPhone/iPad HTTP checks returned 200 | Spoofed UA is not Apple browser execution and does not inspect WAF configuration |
| Middleware/service workers | Home route is outside the proxy matcher; no service-worker registration found in application/public sources | Does not inspect a previously installed worker on a visitor's device |
| Hostinger logs/config | Not accessible in this task | No claim to have inspected WAF rules, origin logs, reverse-proxy configuration or CDN administration |

Sampled IPv4 endpoints: apex `92.113.23.140`, `92.113.16.179`, `84.32.84.159`, `88.222.222.184`; www `92.113.23.162`, `92.113.16.250`, `193.58.105.50`, `147.79.116.55`. CDN addresses are time/location-dependent, not configuration recommendations.

## Validation

- Standalone TypeScript passed.
- 387 safe tests passed across 27 files; database dependencies mocked where applicable.
- Local production Webpack build passed, 273/273 pages generated.
- `git diff --check` passed.
- No physical Apple device or installed WebKit automation runtime was available. Existing browser downloads include Chromium, not WebKit.
- No production writes, migrations, dependency changes, environment changes, commit, push or deployment.

## Next action

1. Obtain authorization to commit/push/deploy the local idle-callback fix. It is not live yet.
2. After the authorized deployment, test the same failing iPhone/iPad, in Safari and Chrome, checking homepage plus language/currency switching. Record OS version, exact URL and time.
3. If failure persists, capture the affected device's Safari Web Inspector console/network log. Determine whether the document request fails or whether a JavaScript exception occurs after HTTP 200. Do not share cookies, credentials or unredacted personal data.
4. Have Hostinger support correlate that timestamp/client IP with CDN/WAF and origin access/error logs; request status, edge request ID and any TLS/QUIC error, without disabling protections.
5. From an IPv6-capable server/network (first verify `curl --version` features), run these read-only checks:

```sh
curl -4 -IL --max-time 20 https://starpyramids.com/
curl -6 -IL --max-time 20 https://starpyramids.com/
curl -6 -IL --max-time 20 https://www.starpyramids.com/
openssl s_client -connect starpyramids.com:443 -servername starpyramids.com -verify_hostname starpyramids.com -verify_return_error </dev/null
```

If that curl build explicitly supports HTTP/3, compare `curl --http3-only -I --max-time 20 https://starpyramids.com/` with HTTP/2. A failure requires host/network-specific investigation, not automatic disabling of IPv6 or HTTP/3.

References: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback ; https://developer.mozilla.org/en-US/docs/Web/API/Window/cancelIdleCallback ; https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Window.json
