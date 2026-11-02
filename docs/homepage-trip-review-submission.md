# Homepage Trip reviews submission

Owner request: the homepage Trip reviews Write a review action must open an internal modal, require selecting a trip, and feed that trip's review section and the homepage after normal moderation.

## Cause and implementation

ProviderReviewsSection previously allowed internal writing only for All/Website; Trip reviews fell through to the external-provider branch and displayed a disabled unconfigured-link button. The existing review API already supports tourSlug, requires an authenticated account, rejects unavailable/unpublished tours and duplicates, and stores PENDING for staff approval.

Trip reviews now opens the same ReviewWriteModal with a required native trip selector. The selector reads the public lightweight /api/tours list with no-store, accepts unique explicitly published records only, and sends the selected canonical tourSlug through the existing POST /api/reviews. It cannot silently fall back to @website. Native selection keeps the existing modal focus trap self-contained and works with device-native pickers; its label, loading/error/retry/empty messages support EN/ES/IT. Arabic remains disabled.

Failed submissions preserve typed text and selection. A 401 offers login with a return URL to the chosen tour's reviews. Failure/retry/empty catalogue states never create fake choices or report local success. Existing Website/All website-review behavior and external-provider URLs remain unchanged. Tour detail forms retain their fixed canonical tour; they do not gain an unnecessary picker.

The same approved review is returned by scope=trips, scope=all and tourSlug=<chosen-trip>, and excluded from scope=website and other trips. No published count or rating is incremented on pending submission. Trip review cards use the trip icon. Both homepage and tour-detail public feeds refresh on visible/focus return so staff moderation can be read after returning to the page. Tour requests explicitly use no-store. This is foreground revalidation, not polling or a push notification service.

## Verification and boundaries

Tests cover the enabled Trip action, selection requirements, duplicate/private choices, real submission body, preserved text on authentication/network failure, retry, existing website and tour forms, and an in-memory POST -> moderation -> homepage/tour GET flow (including rejection). No real database is used by these tests. Existing moderation, authentication, duplicate/rate-limit/origin checks and schema are unchanged. No public or production review was created, approved, modified or deleted during implementation; no browser automation is used. Pixel/device interaction verification remains unperformed under project rules.
