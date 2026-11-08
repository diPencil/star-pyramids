# Public chat authorization and live catalogue

## 403 handling

The previous `chatOwner()` treated every authenticated identity without an account-write customer as staff preview. A normal staff member browsing the public website therefore received 403 from both history and bootstrap. This was an application defect independent of GTM. A real preview must still remain protected.

The public chat now uses the server-authenticated customer ID for customer accounts, an independently authorized HttpOnly guest session for staff browsing the public site normally, and 403 for an active customer-account preview. Staff/admin permissions and all account-write services are unchanged. Guest requests never select another customer by browser-provided conversation/user IDs. The GET empty state does not create a guest session; explicit message bootstrap does. Existing customer conversations and staff replies use the same backend.

Preview denials carry only the safe `preview_read_only` code. The widget shows localized guidance to exit preview, rather than presenting that intentional restriction as a network error. Other server diagnostics remain hidden. The user-supplied production screenshot proves GET `/api/live-chat` returned 403, but did not include the response JSON. The code defect is reproduced and fixed locally; attributing that specific deployed response conclusively still requires its JSON `error`/`code` or redacted Hostinger evidence. No production request/session was replayed.

## Dynamic trip responses

The first chip is **All trips / Todos los viajes / Tutti i viaggi**. New EN/ES/IT greetings refer to trips generally. Generic browsing links point to `/trips`. Existing persisted chat messages are historical records and are not rewritten.

Bot catalogue responses query the existing Tour model at message time: published-only, bounded six rows, latest updates first, returning at most five safe trip links plus `/trips`. Titles, public locations and durations come from current records. Queries use bounded parameterized search terms and can filter Nile cruises/day/multi-day/shore requests. No client-supplied product data or bot text is trusted. Empty/error results are explained without substituting static products or exposing SQL errors. Names are canonical catalogue names; guidance and controls use EN/ES/IT. This is deterministic catalogue lookup and booking/contact guidance, without an external AI service or credentials.

No fixed cruise inventory, per-person price, current availability or final quote is invented. Trip links lead to the actual itinerary/options/pricing page; checkout remains authoritative for the selected booking price. The assistant does not currently quote live booking totals, stock/availability, or translated catalogue titles. Only canonical public relative paths in server-authored bot messages become links; customer/staff message bodies remain plain text. Bot answers are persisted in the same owner-serialized conversation transaction before the API confirms success. Agent handoff and staff-attention counts are unchanged.

## Verification/deployment

No schema change, migration, environment change, package addition or Google setting is required. Deploy the application changes using the existing generated Prisma Client/schema. Tests use mocked sessions, database adapters and message persistence; they do not create real guest sessions/conversations or access an operational database. Production compile-only builds use an unreachable dummy database. Browser automation is prohibited by project instructions and was not used.

Online QA after an authorized deployment: normal guest, normal staff on the public site, authenticated customer and active customer preview; new/unpublished/updated tours; EN/ES/IT; retry/reload and agent replies. Verify public history/bootstrap no longer reject normal staff, actual preview stays 403, and no customer history leaks into guest mode. Inspect only redacted JSON/HTTP evidence; do not share/replay session cookies. If a truly anonymous request still returns 403 with different response content, investigate that evidence and Hostinger/WAF rather than weakening CSRF or ownership checks.
