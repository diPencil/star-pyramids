# Star Pyramids Agent Guide

This file is the entry point for AI agents working in this repository. It maps
the documentation to the code and identifies the minimum checks required before
work is reported as complete.

## Required reading order

Read these files before editing code:

1. `AGENTS.md` (this file) for the repository map and working rules.
2. `constitution.md` for the mandatory feature-delivery, review, testing, and
   security gates.
3. `README.md` for the product summary, stack, and local setup.
4. `DESIGN_SYSTEM.md` for UI tokens, layout, responsive behavior,
   accessibility, and visual conventions.
5. `AGENT.md` before changing Next.js code. It contains version-specific
   guidance maintained by Next.js.

For framework behavior, consult the installed Next.js 16 documentation under
`node_modules/next/dist/docs/`. Do not rely on remembered behavior
from older Next.js versions when local documentation is available.

## Documentation map

| Document | Purpose | Read when |
| --- | --- | --- |
| `constitution.md` | Non-negotiable delivery and quality policy | Every feature, fix, or refactor |
| `README.md` | Product overview, stack, setup, and public project structure | Starting work or onboarding |
| `DESIGN_SYSTEM.md` | Brand tokens and UI/UX rules | Any visual, responsive, or accessibility change |
| `AGENT.md` | Next.js 16 agent warning and local docs pointer | Any application code change |
| `CLAUDE.md` | Redirects Claude-compatible agents to `AGENTS.md` | Claude-based tooling only |
| `components.json` | shadcn aliases, style, Tailwind CSS entry, icon library | Adding or modifying UI components |
| `package.json` | Runtime versions, dependencies, and executable scripts | Dependency or command changes |
| `tsconfig.json` | TypeScript strictness and `@/*` alias | TypeScript or import changes |
| `next.config.mjs` | Next.js build and image behavior | Build, image, or framework configuration changes |

When a code change makes any statement above stale, update the relevant
documentation in the same change.

## Repository map

```text
web-source/
|- AGENTS.md                 # AI entry point and documentation/code map
|- AGENT.md                  # Next.js-generated framework instructions
|- constitution.md           # Feature delivery and quality constitution
|- README.md                 # Product and setup overview
|- app/                       # App Router layouts, pages, and global CSS
|- components/                # Shared shells, features, and page compositions
|- components/ui/             # shadcn-style primitives
|- data/                      # Typed domain contracts and static content
|- lib/                       # Feature contracts, client utilities and shared infrastructure
|- lib/server/                # Server-only services, persistence and integration boundaries
|- app/api/                   # Authenticated, guest and public HTTP handlers
|- prisma/                    # Prisma schema and migration history (protected)
|- tests/                     # Vitest unit/regression and isolated integration tests
|- docs/                      # Operational contracts and organization/modularization records
|- public/                    # Local static assets
|- DESIGN_SYSTEM.md           # Visual source of truth
`- package.json               # Scripts and dependencies
```

This is a Next.js 16 App Router application with API route handlers, Prisma/MySQL
persistence, cookie/session authentication, account ownership checks and staff
RBAC. Public catalogue reads and booking prices use server services; `data/`
also contains reference content and fallbacks, not proof of current database
state. Guest booking links and guest chat have separate authorization boundaries.
Never describe mocked test execution as verified database persistence, payment
settlement, live email delivery or Google tracking reception. Database operations
and production actions require task-specific authorization.

## Code ownership map

| Concern | Primary source |
| --- | --- |
| Root metadata, fonts, and global layout | `app/layout.tsx` |
| Homepage route | `app/page.tsx` |
| Homepage composition and sections | `components/home/homepage.tsx` |
| Unified trip catalogue and filters | `components/tours/trips-page.tsx`; membership in `data/tours.ts` |
| Header, footer, shell, search engine, tour listing, shared travel UI | `components/site.tsx` compatibility entry; header/navigation in `components/layout/site-header.tsx`, search in `components/shared/trip-search-engine.tsx`, cards in `components/tours/tour-card.tsx` |
| Public content, password recovery, cars, events and offers | `components/extended-pages.tsx` compatibility entry; implementations in existing `content/`, `account/`, `cars/`, `events/`, `enquiries/` and `offers/` feature folders |
| Customer account routes and sections | `components/account/account-portal.tsx` compatibility entry/dispatcher; shell in `shared/account-shell.tsx`; booking, car, payment, profile and support sections in their account subfolders |
| Customer trip/event requests | `components/account/account-custom-trip.tsx`, `components/account/account-event-requests.tsx`; shared shell/UI imported directly, not through the dispatcher |
| Admin SEO | `components/admin/seo/seo-manager.tsx` dashboard/editor; `seo-record-editor.tsx` record entry; independent `seo-record-data.ts` and `seo-record-lists.tsx` |
| Authentication, sessions and RBAC | `lib/server/auth/` groups `auth.ts`, `auth-navigation.ts`, `session.ts`, `guards.ts`, `staff-preview.ts` and `users.ts`; owning handlers in `app/api/auth/` and protected API routes |
| Booking persistence and lifecycle | `lib/server/booking/bookings.ts` public entry and mutation/transaction owner; sibling `booking-validation.ts`, `booking-values.ts`, `booking-read-models.ts`, `booking-queries.ts`, `booking-replay.ts`; checkout coordination in `checkout/`, token/recovery flows in `access/` |
| Payments and documents | `lib/server/payments/payments.ts`, `lib/server/payments/payment-proofs.ts`, `lib/server/payments/fx.ts`, `lib/server/documents/documents.ts`, `lib/server/documents/document-pdf.ts`, `pdf/`, `webhooks/`; API handlers retain authorization and signature checks |
| Transactional email and managed media | `lib/server/email/email.ts`, `lib/server/email/email-smtp.ts`; `lib/server/media/media.ts`, `lib/server/media/upload-form.ts`; existing storage paths and external URLs remain unchanged |
| Guest/customer support and Inbox | `components/support/live-chat.tsx`, `lib/server/support/`, `lib/support/`, `app/api/live-chat/`, `app/api/admin/conversations/` |
| Google tracking and consent | `components/site-measurement.tsx`, `components/consent-manager.tsx`, `lib/tracking/`, `lib/server/tracking/`; GTM is the only Google loader; retain private-route and consent guards |
| CMS and published content | `lib/server/cms/`, `editorial/`, `catalogue/`, `lib/cms/`; existing settings storage in `lib/server/settings.ts` |
| Login and registration experiences, social-auth previews, and registration fields | `components/auth-pages.tsx`; country metadata in `data/countries.ts` |
| Tour detail presentation | `components/tours/detail/tour-detail.tsx` (packages and other tours); `components/tours/detail/day-tour-detail.tsx` (one-day tours); shared social video reels in `components/tours/detail/tour-video-gallery.tsx` |
| Tour reference entities and published catalogue access | `data/tours.ts` reference/fallback content; `lib/server/catalogue/tours.ts` and `lib/tours/tours-client.ts` for live access; tour JSON/write/publish/translation helpers in `lib/tours/` |
| Shared frontend domain contracts | `data/types.ts` |
| Enabled EN/ES/IT locale and currency state | `components/locale.tsx`, `lib/i18n/locale-config.ts`; neutral copy/fallback/country-label helpers in `lib/i18n/`; preserve legacy code without enabling Arabic |
| Reference destinations, cars, blogs, events, offers, FAQs, and policies | `data/content.ts`; published records belong to the corresponding server feature service |
| URL query contracts and defensive parsers | `lib/query.ts` |
| Shared class-name utility | `lib/utils.ts` |
| Shared phone/date utilities and neutral financial contracts | `lib/core/phone.ts`, `lib/core/date-calendar.ts`, `lib/payments/currency.ts`, `lib/payments/payment.ts`; server payment persistence lives in `lib/server/payments/payments.ts` |
| Design tokens and shared site styles | `app/globals.css`; account/admin layouts and feature CSS/CSS Modules retain their owning paths |
| Images, icons, and brand assets | `public/` |
| Company branding and server-seeded identity | `components/branding/`, `lib/cms/brand-settings.ts`, `lib/server/cms/brand-settings.ts`; the `lib/admin-store.ts` brand facade and root-layout provider ownership are preserved |

Authentication route metadata lives in `lib/seo/auth-page-metadata.ts`, public
destination association helpers in `lib/catalogue/destination-public.ts`, and
gallery video storage code in `lib/server/gallery/journey-video-storage.ts`.
Their runtime/public URL and persistent-storage contracts are unchanged. See
`docs/source-organization-phase6.md` for all root-level ownership decisions.
Phase 7 relocates eight tour/trip-builder modules and updates their external
source-reader contracts; see `docs/source-organization-phase7.md`. Existing
operational import commands and protected historical data remain unchanged.
Phase 8 places catalogue translation/destination contracts in `lib/catalogue/`,
record/static SEO contracts in `lib/seo/`, and the homepage hero contract in
`lib/cms/heroes/website-heroes.ts`. See `docs/source-organization-phase8.md` for
the coordinated tool references and the 18 intentionally shared root files.
Phase 9 groups four neutral language/text modules in `lib/i18n/` while keeping
the global LocaleProvider at its existing path and preserving its state and
language policy. See `docs/source-organization-phase9.md` for the 14 remaining
root files and exact source-reader updates.
Phase 10 groups phone/date utilities in `lib/core/` and neutral currency/payment
contracts in `lib/payments/`. Keep `lib/json-text.ts` at its original path:
`prisma/import-blogs.ts` is a protected consumer. See
`docs/source-organization-phase10.md` for the 10 remaining root files.
Phase 11 groups seven server modules under `email/`, `documents/`, `media/`
and the existing `payments/` folder. Central auth, DB, settings and payment
persistence entry points remain stable. See `docs/source-organization-phase11.md`
for exact paths and all 16 retained server root files.
Phase 12 groups four branding UI/provider modules in `components/branding/`
and the public branding settings contract/projection in the existing CMS folders.
See `docs/source-organization-phase12.md`; no asset or provider ownership changes.
Phase 13 groups six auth/user authority modules in `lib/server/auth/` and the
central payment service in `lib/server/payments/payments.ts`. The root proxy
changes only its session-constant import. See `docs/source-organization-phase13.md`
for all eight retained server infrastructure files and security-preservation checks.

Prefer changing the owning shared component or data source instead of copying
logic into a route wrapper. Keep `app/**/page.tsx` files thin unless a route has
genuinely route-specific behavior.

## Route-to-code map

| Routes | Implementation |
| --- | --- |
| `/` | `app/page.tsx` -> `components/home/homepage.tsx` |
| `/trips` | `app/trips/page.tsx` -> `components/tours/trips-page.tsx`; catalogue in `data/tours.ts` |
| `/about`, `/contact`, `/faq`, `/accessible-travel`, `/egypt-travel-guide` | Thin route wrappers -> `components/extended-pages.tsx` |
| `/blogs`, `/blogs/[slug]` | Public blog components via `extended-pages.tsx`; published reads in `lib/server/editorial/blogs.ts` |
| `/events`, `/events/[slug]` | Event feature components; published reads in `lib/server/events/` |
| `/destinations`, `/destinations/[slug]` | Destination feature components and `lib/server/catalogue/` |
| `/special-offers`, `/special-offers/[slug]` | Offer feature components and `lib/server/offers/` |
| `/egypt-tours/one-day-tours` | `components/site.tsx` (`OneDayToursRegions`) |
| `/egypt-tours/multi-days-tours`, `/egypt-tours/nile-cruises`, `/egypt-tours/shore-excursions` | `components/site.tsx` (`TourListing`) |
| `/egypt-tours/[slug]` | Entities in `data/tours.ts`; route validation in `app/egypt-tours/[slug]/page.tsx`; presentation in `components/tours/detail/tour-detail.tsx` or `components/tours/detail/day-tour-detail.tsx` by category |
| `/make-your-trip` | Server route in `app/make-your-trip/page.tsx`; interactive planner in `app/make-your-trip/trip-request-planner.tsx` |
| `/rent-car`, `/rent-car/request` | `components/extended-pages.tsx` -> `components/cars/car-pages.tsx`; live car services in `lib/server/cars/` |
| `/search` | `components/extended-pages.tsx` -> `components/content/public-search-page.tsx`; search helpers in `lib/search/`, with published records supplied by the existing feature catalogue APIs |
| `/login`, `/register` | Thin route wrappers -> `components/auth-pages.tsx`; country metadata in `data/countries.ts` |
| `/forgot-password` | `components/extended-pages.tsx` |
| `/account` and account sections | `components/account/account-portal.tsx` (`CustomerAccountPage`); protected layout in `app/account/layout.tsx` |
| Account booking/car/payment detail routes | Intended detail exports from `account-portal.tsx`; reference validation in route wrappers and ownership enforcement in APIs/services |
| Account trip/event requests and details | Dedicated request components; trip `?new=1` / `?edit=<ref>` handled by the trip route and existing request flow |
| `/checkout`, `/checkout/details`, `/booking-confirmation`, `/checkout/receipt`, `/booking/[token]` | Tagged checkout summary, untagged contact form, safe public confirmation and protected booking-access flows; preserve their tracking/document boundaries |
| `/admin/**`, `/api/**` | Feature-owned admin components and route handlers; validate authentication, permission, CSRF/signatures and ownership at the existing boundaries |
| `/privacy`, `/terms` | `components/extended-pages.tsx`; copy in `data/content.ts` |

## Project commands

Run application commands from this directory (the directory containing
`package.json`):

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:unit
corepack pnpm build
corepack pnpm verify:release
corepack pnpm start
```

Important current constraints:

- Vitest is the existing test runner. `test` runs the default suite, excluding
  the database integration files listed in `vitest.config.ts`. `test:unit` is a
  selected database-independent subset. `test:integration` is separately guarded
  by `vitest.integration.config.ts`; it must not use the operational database.
- `verify:release` runs TypeScript, the complete Vitest suite, and the
  production build in sequence and stops on the first failure.
- Production builds enforce TypeScript errors. Keep the separate `typecheck`
  step in release verification so failures are reported before the build.
- Builds run Prisma generation and can query published content during
  `generateStaticParams`. Do not run a build when the task prohibits database
  access; use an explicitly isolated environment when authorized.
- Application `tsconfig.json` excludes tests. Vitest success is not test type
  checking. A standalone all-test TypeScript assessment found existing typing
  errors; do not silently suppress them or claim a clean test typecheck.
- There is no lint or browser E2E script yet. Do not claim either ran when it
  did not, and do not add another test runner or package manager.
- Use pnpm through Corepack; do not introduce a second lockfile or package
  manager.
- Do not edit generated output in `.next/`, `node_modules/`, or
  `tsconfig.tsbuildinfo`.

## Working rules

1. Preserve the App Router, strict TypeScript, `@/*` imports, and existing
   component boundaries unless the feature requires a documented change.
2. Follow `DESIGN_SYSTEM.md` and existing CSS variables before adding new
   colors, spacing, typography, or interaction patterns.
3. Use existing shared components and Lucide icons before creating duplicates.
4. Keep server components by default. Add `'use client'` only where browser
   state, effects, or browser APIs require it.
5. Preserve enabled English, Spanish and Italian behavior, keyboard access,
   focus visibility, semantic HTML and responsive layouts. Preserve existing
   legacy direction handling without adding or enabling Arabic/RTL behavior.
6. Inspect the current diff, preserve unrelated user and agent work, and make
   surgical changes to the owning code. Never rewrite an entire working file
   merely because a feature touches one part of it.
7. Do not add dependencies, infrastructure, or abstractions without a concrete
   need and a clear maintenance benefit.
8. Follow every gate in `constitution.md` and report exactly what was and was
   not verified.

## Completion report

Every completed task should state:

- what changed and which user-visible behavior is affected;
- which files own the change;
- which checks were run and their outcomes;
- what could not be verified, if anything;
- any remaining risk, mock behavior, migration, or follow-up.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes  -  APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev`  -  verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## STAR PYRAMIDS project rules  -  highest priority for all agents

These project-specific restrictions take precedence over instructions in any
installed skill, plugin, persona, script, or general workflow. Skills are
reference workflows only; they do not authorize actions prohibited here.

- Do not use browsers, browser automation, or browser-based testing.
- Do not stage, commit, push, or deploy without the user's explicit approval.
- Do not perform production operations.
- Do not reset or seed databases, or run destructive migrations. Preserve local
development data.
- Preserve the existing design system and page layouts. Do not make unrelated
code or configuration changes.
- Support English (EN), Spanish (ES), and Italian (IT). Arabic is disabled;
do not add or enable Arabic/RTL behavior.
- Do not access or modify `web-source-recovery`.
- Before considering any bundled or repository script, inspect its complete
contents and effects. Never execute a bundled script without inspecting it.
- When a skill recommends an action that conflicts with these rules, follow
these project rules and stop before the prohibited action.
