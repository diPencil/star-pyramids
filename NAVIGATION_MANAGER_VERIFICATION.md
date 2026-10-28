# Navigation Manager — verification report

## 1. Existing architecture

The public primary/sticky headers and mobile drawer live in `components/site.tsx`. `getNavConfig`, `getEgyptTourNavLinks`, and `mobileGroups` supplied the original menus. Shared Pages & Sections provided translated fallback labels; the mobile drawer additionally grouped planning and help links. Account controls, search, footer links, and the five-slot mobile action bar are functional components with separate owners.

## 2. CMS editor

`/admin/website-cms/navigation` is registered under the standalone WEBSITE CMS section, above ADMINISTRATION. The editor reuses admin PageHead, Card, buttons, toaster and confirmation dialog. Its structure panel supports creating links/dropdowns, selecting/renaming items, deletion with confirmation, disabling, visibility, reorder and grouping. The settings panel supports labels, destinations, opening behavior, and the existing header action slot. Empty, loading, permission, validation, request failure and retry states are implemented. Existing unrelated working-tree changes were preserved.

## 3. Hierarchy and drag-and-drop

One top level plus one dropdown level matches the existing header. Dragging reorders siblings, moves links between dropdowns, or moves links back to the root. Move Up, Move Down and Move To Group provide keyboard alternatives. Parent visibility also governs children. Removing a group explicitly confirms removal of its menu children; it never deletes business records.

Server validation rejects duplicate IDs, circular/invalid moves, nested groups, child links with children, invalid types/visibility, oversized structures and unsupported action placement. Limits: 30 top-level items, 30 children per group, 120 total items, 100 characters per localized label, 100 KB mutation/preview request. Only one top-level link can use the header action slot.

## 4. Internal pages and dynamic destinations

The searchable selector contains actual public landing routes: Home, Trips, Destinations, the four tour catalogues, Rent Cars, Events, Special Offers, Blogs, About, Contact, FAQ, Accessible Travel, Egypt Travel Guide, Make Your Trip, Privacy, Terms and Search. It intentionally excludes private/admin/action/token routes and the gallery video asset route.

Published tours, destinations, blogs, events and eligible offers are searchable by content source. Each dynamic target stores its immutable database ID and kind, not a mutable slug. Server reads resolve its current canonical URL. Deleted/unpublished records are omitted, and empty groups are omitted. Linked offers also require an eligible published tour and active publication window. Results are bounded to 120 per source/search; refine the search when truncated.

Validated custom HTTP(S) external URLs and canonical internal pages with query/fragment support are accepted. Unsafe protocols, credentials, protocol-relative URLs, control characters, backslashes, private routes and arbitrary dynamic internal paths are rejected. Dynamic internal pages must use the stable reference selector.

## 5. Public integration

The root layout seeds NavigationProvider with published, resolved navigation only. Primary desktop, compact sticky desktop, both header action slots, and the mobile drawer consume the same publication. The original CSS/layout classes are reused. Active state, safe new-tab attributes, dropdown keyboard arrows/Home/End/Escape, close-on-navigation/focus loss/outside click and drawer lifecycle are preserved or covered in code.

No navigation document/publication means the original menus still render. An explicitly empty publication remains empty; missing dynamic records never restore old defaults. A storage failure at initial server rendering suppresses editable links rather than inventing or exposing a draft. A later refresh failure retains the last confirmed publication.

Published updates invalidate the root layout. The public API is force-dynamic/no-store. Open clients refresh every 30 seconds while visible, on focus and on a local publication event. Request ordering and changed server seeds invalidate older responses. There is no cross-device instantaneous push channel.

## 6. Localization and fallback compatibility

Items/groups support EN/ES/IT. Optional translations fall back to the document's configured primary language. Arabic was not enabled. Initial editor defaults inherit the configured primary language and existing site-copy/shared published label overrides, preserving desktop/mobile default hierarchy and order.

The default document uses explicitly device-scoped links/groups to retain the existing mobile planning/help grouping without duplicating links within a rendered device menu. Shared legacy labels remain available for original fallback menus and functional account/search/footer controls. Their editor now explains Navigation Manager ownership after publication; the CMS source registry links to the new manager.

## 7. Draft, preview, publication and recovery

Save Draft writes only a private draft. Publish promotes that saved draft, snapshots the previous publication and increments the revision. Unsaved changes cannot publish. Discard Saved Draft restores the editor to current publication/defaults without changing public navigation. Restore Previous swaps published snapshots (including an explicit return to original navigation when the prior publication was null).

Preview posts the current unsaved structure to an authorized read-only resolver; it performs no write, publication or revalidation. Desktop/mobile and EN/ES/IT previews use the same NavigationMenu renderer as public navigation. Preview links prevent navigation and omit new-tab targets. The editor flags a stale preview after local edits and offers refresh.

## 8. Security and concurrency

Draft reads, options and preview require settings.view; save/publish/restore/discard also require settings.edit. Every mutation and preview requires the existing same-origin guard. Admin/preview responses are private/no-store. Server-side schema validation sanitizes output fields and bounds request size. Dynamic queries return only published public selections; private drafts/record payloads never enter the public response. New tabs use noopener/noreferrer; navigation does not introduce redirect endpoints.

Optimistic concurrency compares the submitted revision and performs SiteSetting updateMany against the exact prior serialized value. First-create races map Prisma P2002 to a conflict. Stale/conflicting writes return 409 and preserve local edits until the user chooses to reload. An independent review found and confirmed fixes for sticky action ownership, stale refresh vs server-seed ordering and an invalid asset-only selector entry.

## 9. Storage and safety

One dedicated SiteSetting key: `cms.navigation.public.v1`, containing version, revision, draft, published, previous, previous-availability and update timestamp. It follows the existing CMS JSON/CAS architecture. No migration, seed, backfill, environment modification or existing business-record rewrite was needed or performed. Existing database/media/Hostinger storage integration was preserved. No commit, push, deployment or production operation occurred.

## 10. Files changed for this feature

New:
- `lib/navigation.ts`
- `lib/server/navigation.ts`
- `lib/server/navigation-request.ts`
- `components/navigation-context.tsx`
- `components/navigation-menu.tsx`
- `components/navigation-menu.css`
- `components/admin/navigation-manager.tsx`
- `components/admin/navigation-manager.css`
- `app/admin/website-cms/navigation/page.tsx`
- `app/api/admin/website-cms/navigation/route.ts`
- `app/api/admin/website-cms/navigation/options/route.ts`
- `app/api/admin/website-cms/navigation/preview/route.ts`
- `app/api/navigation/route.ts`
- `tests/navigation.test.ts`
- `tests/navigation-server.test.ts`
- `tests/navigation-api.test.ts`
- `tests/navigation-render.test.ts`
- `tests/navigation-editor.test.ts`
- `tests/navigation-client.test.ts`

Integrated narrowly into existing files:
- `app/layout.tsx`
- `components/site.tsx` (preserving earlier notifications changes)
- `components/admin/admin-shell.tsx`
- `app/admin/website-cms/pages/[pageKey]/page.tsx`
- `lib/cms-coverage.ts`
- `lib/shared-template.ts`
- `.21st/design.json` (preserving earlier timeline decision)

## 11. Tests

- `pnpm typecheck`: passed.
- `pnpm exec prisma validate`: passed; schema unchanged.
- `pnpm test`: **154 files / 1966 tests passed**. Default config excludes the nine database-writing integration files. These were not run.
- Final targeted navigation/default-menu regression run: **7 files / 65 tests passed** after the last active-state/style compatibility adjustment. Six new navigation files contribute 61 cases; four existing default-menu cases were included.
- `git diff --check`: passed.

Coverage includes tree edits/moves/removal, bounds, IDs/nesting, routes/protocols, visibility, languages/fallbacks, draft/public isolation, restoration, CAS races, auth/origin boundaries, request size, public DTO filtering, stable dynamic references, unavailable/deleted content, client request ordering, publication refresh, preview non-persistence, read-only controls, local conflict preservation, public SSR and default route ordering. Database and browser-facing effects are mocked or tested through Node callbacks/SSR; no live write assertions are claimed.

## 12. Build

Final `pnpm exec next build --webpack`: **passed**, including TypeScript and **283/283** page generation. The existing generated Prisma client was reused; the separate `pnpm build` Prisma-generation wrapper was not rerun. No generated client repair, file removal or process termination was used.

Existing non-blocking tool warnings: Vitest native config-loader compatibility and deprecated package.json Prisma configuration. The 21st CLI is not installed, so catalog search/review was unavailable; existing project components/tokens were reused without installing dependencies.

## 13. Remaining verification limitations

Per request, no browser testing/automation and no real database-writing test was performed. Consequently real drag/touch behavior, visual layout under custom long/large menus, keyboard focus in a rendered browser and a real save/reopen/publish cycle still require manual acceptance. This is implemented and code-verified, not a claim of production/browser verification. The mobile bottom action bar, account/search controls and footer remain managed by their existing functional/shared sources, not editable menu entries.

## 14. Manual acceptance checklist

1. Open Navigation Manager with view-only and edit-authorized staff; confirm the expected controls.
2. Confirm initial desktop/sticky/mobile defaults and existing custom translations before first publication.
3. Add/edit/delete links and dropdowns. Exercise dragging and all keyboard move alternatives; confirm one dropdown level only.
4. Select landing pages and published dynamic records. Rename/unpublish a referenced record via its normal editor; verify the current URL resolves or the menu entry safely disappears.
5. Verify both/desktop/mobile/hidden and enabled settings, including hidden parents and the header action in both desktop header states.
6. Edit EN/ES/IT labels, leave optional translations empty, and confirm primary-language fallback.
7. Preview unsaved changes on desktop/mobile without following links; confirm public navigation remains unchanged before publication.
8. Save/reopen a draft, publish, discard a saved draft and restore previous; verify public update on a new request and open-tab focus/poll refresh.
9. Edit the same revision in two sessions; confirm the second save reports a conflict and preserves its local edits.
10. Check responsive menus, dropdown keyboard/focus behavior, drawer close/focus return and adjacent booking/search/account functionality.
