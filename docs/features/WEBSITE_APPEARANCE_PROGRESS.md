# Website Appearance

Implementation date: 2026-10-15.

## Ownership

- Administration > Settings > Website Appearance owns public visual overrides.
- The existing internal `website` tab ID is retained for navigation compatibility.
- SEO Manager > Global Settings remains the sole UI editor of the existing SEO setting keys.
- Offers > Promotional Bars remains the promotional content editor. Legacy settings are preserved, not deleted or migrated.
- Appearance has one independent versioned `SiteSetting` record: `cms.appearance.public.v1`. No schema change is required.

## Publishing

- Save Draft affects only the appearance draft; public rendering reads only `published`.
- Publish requires an existing saved draft and snapshots the previous published appearance.
- Restore Previous swaps the current and previous published versions. Restoring the first publication returns to the original design.
- Reset to Published and Original Defaults change only the local editor until explicitly saved and published.
- Revisions and raw-value compare-and-swap protect updates, including first-create races.
- GET requires `settings.view`; mutations require `settings.view`, `settings.edit`, and same origin. Requests are limited to 16 KB.
- Mutation responses are private/non-indexable. Publishing and restoring invalidate the root layout only; no content/SEO drafts are published.

## Real rendering integration

- The public boundary consumes validated, published appearance. Admin and account shells are explicitly excluded, including after client navigation.
- Existing global tokens are reused: primary, blue, yellow, surface, text, muted, border, content width, radius and primary hover.
- Only explicit overrides produce CSS. An empty/default publication emits no theme CSS; component-specific original dimensions and colors remain unchanged.
- Shared primary/secondary buttons, search buttons and homepage CTAs consume button colors, radius, borders, minimum height, padding, typography, hover, focus and disabled opacity.
- Contact/planner forms, enquiry/review dialogs and shared help fields consume field colors, typography, labels, placeholder, radius and focus tokens. Hidden/file/radio/checkbox/range/button inputs are excluded from text-field sizing.
- Tour, content, car, offer, homepage blog and review cards consume surface/radius/border/shadow tokens; their content wrappers and existing listing/home grids consume safe spacing overrides.
- Desktop/tablet/mobile base text, heading scales and section spacing use the existing 760/1100 px responsive boundaries. Structural breakpoints and booking grids are not configurable.
- Language and review portals retain public token inheritance without applying public settings to admin portals.
- Custom page-specific structural spacing, imagery, animations, overlays, semantic status colors and icon-only controls remain owned by their original components. This is not an arbitrary CSS editor or a rewrite of every bespoke visual rule.
- No dark-mode toggle, arbitrary font URL, arbitrary shadow/CSS, scripts or letter-spacing controls are exposed. Existing fonts and safe system/Arial/Georgia choices only.

## Editor and preview

- Existing Settings layout and admin primitives are retained. Color pickers have HEX inputs, numbers are bounded, and controls can individually return to original behavior.
- Contrast warnings cover body, primary/secondary buttons and field text. Existing brand colors are not silently rewritten.
- A sandboxed iframe previews representative public typography, cards, buttons and fields at desktop/tablet/mobile widths using the same validated appearance CSS. It is a component sample, not a claim of complete page visual coverage.
- Preview is local and non-writing; it does not override the live page or admin styles. Existing loaded font faces are reused.
- Existing custom confirmation dialogs protect publish, restore, reset and unsaved navigation/tab changes. Duplicate submissions are blocked; failed/conflicting saves preserve local edits and allow confirmed reload.

## Validation and boundaries

- Safe suite: 888 tests passed across 61 files, including mocked appearance lifecycle/RBAC/CAS, injection/bounds, ownership, portal/private-shell scoping and original CMS/SEO/payment regressions.
- Standalone TypeScript passed. Production Webpack build passed with 271/271 pages; final rerun recorded in task response.
- No automated writes to the active MySQL database were performed. Live admin save/publish/restore has not been exercised against that database.
- Browser visual/interactive verification is not available in this task; no desktop/mobile pixel or overflow certification is claimed.
- Existing environment, media, Hostinger storage, database records and unrelated untracked files are preserved. No migration, installation, commit, push or deployment.
