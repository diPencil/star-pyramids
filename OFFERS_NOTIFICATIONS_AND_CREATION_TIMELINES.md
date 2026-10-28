# Offers notifications and admin creation timelines

## Implemented

- Replaced fabricated public marketing notifications with published, currently eligible Special Offers and real published tour discounts. Draft, expired and unavailable linked-tour sources are excluded; linked offers and manual tour deals are deduplicated.
- Customer account notifications include the same eligible marketing sources alongside personal notifications. Marketing sources are derived on read, without broadcasting copied records to every customer.
- Explicit customer read actions persist owner-specific revision receipts through the existing notification storage. Guest read state uses local storage. Public marketing read-all does not mark personal booking/payment notifications read.
- Marketing failures preserve personal notification availability. Requests and read updates are guarded against stale account responses and polling races.
- Refresh occurs on opening the public bell, focus, relevant local changes and a 30-second interval. This is an in-app feed, not email, operating-system push or a persistent server-push connection.
- Preserved EN/ES/IT content and existing styling.

## Creation timelines

| Editor | Steps |
| --- | --- |
| Destinations | Hero; Facts; Story; Experiences; Journey; Practical; Related trips; Cover & CTA; Review & publish |
| Multi-day categories | Basic information; Media; Linked tours; Review & publish |
| Events | Basic & content; Schedule & venue; Pricing; Media; Highlights & program; Inclusions & add-ons; Organizer; Review & publish |
| Offers | Creation method; Offer details; Pricing & schedule; Content & media; Review & publish, adapted to existing offer/bar editing modes |
| Stories | Story details; Article hero; At-a-glance facts; Article sections; Guide navigation & sidebar; Tips, quote & checklist; Final call to action; Review & publish |

The shared compact horizontal timeline reuses Trip Builder styling. Inactive panels stay mounted to preserve field state. Navigation buttons never submit the form. Save controls/errors remain accessible outside inactive panels, and busy operations disable step navigation. Existing save handlers were compared with HEAD and remain unchanged. Existing permissions, field contracts and localization controls are preserved.

## Verification

- `pnpm typecheck`: passed.
- `pnpm exec prisma validate`: passed.
- `pnpm test`: 148 files / 1905 tests passed. The safe unit configuration excludes database-writing integration tests; those tests were not run.
- `pnpm exec next build --webpack`: passed; 282/282 pages generated. This validates Next.js with the existing generated Prisma client; the separate Prisma-generate build wrapper was not rerun.
- `git diff --check`: passed.
- New regression coverage includes feed eligibility, scopes, localization, read ownership/idempotency, authorization, source failure isolation, polling races, SSR rendering, timeline navigation and retained panel fields.

No schema migration, environment change, business-data write, media change, production operation, commit or push was performed. Unrelated working-tree files were preserved.

## Manual acceptance still required

Browser testing and live database-writing checks were intentionally not performed. Verify:

1. Published active offers appear in the public bell and customer account; drafts, expired offers and unpublished linked tours do not.
2. Scheduled offers become eligible at their configured start; manual tour discounts link to the correct tour without duplicating linked offers.
3. Read state is isolated per customer and survives reopening. Public offer read-all preserves unread personal notifications.
4. Each timeline preserves entered fields/media while moving between steps; original validation and save errors remain visible.
5. Check horizontal timeline scrolling and form layouts on mobile, and EN/ES/IT content in the browser.
