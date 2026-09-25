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
|- lib/                       # Shared utilities and URL query parsing
|- public/                    # Local static assets
|- DESIGN_SYSTEM.md           # Visual source of truth
`- package.json               # Scripts and dependencies
```

There is currently no server API, database, or production authentication layer
in this repository. Forms, account screens, favorites, and bookings are UI
prototypes unless code explicitly proves otherwise. Never describe mock state as
persisted or secure production behavior.

## Code ownership map

| Concern | Primary source |
| --- | --- |
| Root metadata, fonts, and global layout | `app/layout.tsx` |
| Homepage route | `app/page.tsx` |
| Homepage composition and sections | `components/homepage.tsx` |
| Unified trip catalogue and filters | `components/trips-page.tsx`; membership in `data/tours.ts` |
| Header, footer, shell, search engine, tour listing, shared travel UI | `components/site.tsx` |
| Content, account, password recovery, cars, policies, search, and detail pages | `components/extended-pages.tsx` |
| Login and registration experiences, social-auth previews, and registration fields | `components/auth-pages.tsx`; country metadata in `data/countries.ts` |
| Tour detail presentation | `components/tour-detail.tsx` (packages and other tours); `components/day-tour-detail.tsx` (one-day tours); shared social video reels in `components/tour-video-gallery.tsx` |
| Tour entities, canonical slugs, category collections, and rich tour content | `data/tours.ts` |
| Shared frontend domain contracts | `data/types.ts` |
| Locale, RTL, and currency state | `components/locale.tsx` |
| Static destinations, cars, blogs, events, offers, FAQs, and policies | `data/content.ts` |
| URL query contracts and defensive parsers | `lib/query.ts` |
| Shared class-name utility | `lib/utils.ts` |
| Design tokens and nearly all site styles | `app/globals.css` |
| Images, icons, and brand assets | `public/` |

Prefer changing the owning shared component or data source instead of copying
logic into a route wrapper. Keep `app/**/page.tsx` files thin unless a route has
genuinely route-specific behavior.

## Route-to-code map

| Routes | Implementation |
| --- | --- |
| `/` | `app/page.tsx` -> `components/homepage.tsx` |
| `/trips` | `app/trips/page.tsx` -> `components/trips-page.tsx`; catalogue in `data/tours.ts` |
| `/about`, `/contact`, `/faq`, `/accessible-travel`, `/egypt-travel-guide` | Thin route wrappers -> `components/extended-pages.tsx` |
| `/blogs`, `/blogs/[slug]` | `components/extended-pages.tsx`; content in `data/content.ts` |
| `/events`, `/events/[slug]` | `components/extended-pages.tsx`; content in `data/content.ts` |
| `/destinations`, `/destinations/[slug]` | `components/extended-pages.tsx`; content in `data/content.ts` |
| `/special-offers`, `/special-offers/[slug]` | `components/extended-pages.tsx`; content in `data/content.ts` |
| `/egypt-tours/one-day-tours` | `components/site.tsx` (`OneDayToursRegions`) |
| `/egypt-tours/multi-days-tours`, `/egypt-tours/nile-cruises`, `/egypt-tours/shore-excursions` | `components/site.tsx` (`TourListing`) |
| `/egypt-tours/[slug]` | Entities in `data/tours.ts`; route validation in `app/egypt-tours/[slug]/page.tsx`; presentation in `components/tour-detail.tsx` or `components/day-tour-detail.tsx` by category |
| `/make-your-trip` | Route-local interactive planner in `app/make-your-trip/page.tsx` |
| `/rent-car`, `/rent-car/request` | `components/extended-pages.tsx`; car data in `data/content.ts` |
| `/search` | `components/extended-pages.tsx`; index in `data/content.ts` |
| `/login`, `/register` | Thin route wrappers -> `components/auth-pages.tsx`; country metadata in `data/countries.ts` |
| `/forgot-password` | `components/extended-pages.tsx` |
| `/account`, `/account/profile`, `/account/bookings`, `/account/favorites` | `components/extended-pages.tsx` (`AccountPage`) |
| `/privacy`, `/terms` | `components/extended-pages.tsx`; copy in `data/content.ts` |

## Project commands

Run application commands from this directory (the directory containing
`package.json`):

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev
corepack pnpm exec tsc --noEmit
corepack pnpm build
corepack pnpm start
```

Important current constraints:

- `package.json` has no `lint` or `test` script yet. Do not claim linting or
  automated tests ran when they did not.
- Do not introduce a test runner, lint framework, E2E framework, or major
  quality dependency from inside an ordinary feature task. The official quality
  stack must be selected once in a dedicated infrastructure task; until then,
  follow the available verification and reporting rules in `constitution.md`.
- `next.config.mjs` currently sets `typescript.ignoreBuildErrors: true`.
  Therefore a successful production build does not replace
  `corepack pnpm exec tsc --noEmit`.
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
5. Treat English/Arabic direction, keyboard access, focus visibility, semantic
   HTML, and responsive layouts as acceptance criteria, not polish.
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

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
