# Special Offers

## Data and workflow

- Link existing tour: select a real database tour in any of the four categories, enter 1–90% discount and an end date, optionally schedule its start. One offer may link to each tour. Edit that offer to change its discount.
- New tour with offer: use the existing complete Trip Builder, save the tour, then link it in Offers. There is no second, incomplete tour implementation.
- Marketing campaign: preserves the existing standalone offer content and enquiry workflow. This is not a directly bookable tour.
- Linked offers use a nullable unique `tourSlug` foreign key. The additive migration `20261010193000_link_special_offers_to_tours` preserves all existing offers without automatically linking them.
- Offer saving and catalogue translations share the existing database transaction. Unique constraints prevent duplicate links. Staff permissions and same-origin mutation protection remain enforced.
- Public lists exclude unpublished, scheduled and expired offers. Linked offers require a published tour, and open its real tour page. Legacy manual tour discounts remain supported without duplicating linked cards.
- Live tour images, base price and duration supply linked cards. Booking validation loads the same authoritative discount resolver; traveller price tiers receive the discount once, while add-ons remain undiscounted.
- The original `Tour.deal` is never rewritten by an offer mutation. Its parsed value travels separately as `manualDeal` so editing a tour cannot accidentally persist its projected offer discount. Hiding, expiring or deleting the offer restores the existing manual pricing policy.
- Date-only deadlines cover the complete UTC calendar day. A start must not follow the inclusive end. Invalid JSON, null/array bodies, invalid dates/percentages and duplicate links receive JSON errors.

## Verification on 2026-10-10

- Prisma validation passed; all 33 migrations applied, database schema current.
- TypeScript passed with zero errors. Production build passed.
- 61 targeted tests passed across offers, API security, booking API security and tour publication regression.
- 16 real MySQL assertions passed in a transaction that was fully rolled back: linkage, authoritative price, reload, manual deal preservation, hide, expiry, deletion and unchanged existing offers. No booking was created and no email was sent.
- Independent review found and verified the fix for the manual-deal overwrite issue.
- Authenticated browser: the new creation paths and responsive form render; mobile viewport 390px has no horizontal overflow. Live catalogue loading is **not verified successfully**: it returns HTTP 500 on the currently running old server.

## Remaining local runtime blocker

The existing Next.js process PID **520648** on port **3000** retains the old Prisma model. Its development log reports `Unknown argument tourSlug` and `Unknown field tour for include statement on model Offer`. Prisma generation fails with Windows EPERM renaming `query_engine-windows.dll.node`. Stopping this confirmed project process was denied by Windows. No unrelated process was stopped, and no replacement port was started.

Owner action: open PowerShell as Administrator and run `Stop-Process -Id 520648`. After it stops, regenerate Prisma Client and restart the project on **3000 only**, then complete browser creation/edit/hide/expiry/booking verification. Do not treat the currently running server as a completed acceptance test.

No commit or push performed. Existing database records and unrelated worktree changes preserved.
