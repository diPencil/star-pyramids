# Trip Builder live preview — Phase 8

2026-10-27. Local only. No browser testing, production operations, commits, pushes, deployment, migrations, seeds, resets or business-data writes. Rent Cars, Reviews, Journey Gallery and Destinations implementation files were preserved. Phases 9/10 were not started.

## Root causes

1. The previous preview spread the saved `sourceTour` and changed only base price and traveler rates. Unsaved descriptions, itinerary, sections and media were absent; a missing saved detail object also prevented new-trip tiers from being attached.
2. `Number(form.price) || sourceTour.price` restored a saved amount for both blank and legitimate zero. Empty tier strings were converted with Number('') into invented free rates. A new editor could begin with placeholder zero prices and a blank cover-image record.
3. The sidebar gated pricing behind a cover image, hardcoded currency symbols and showed only a small booking mock. Cleared galleries could regain saved images during persistence.
4. Detail initialization preferred `detail` over `dayDetail` regardless of category, allowing inactive-category content/rates to mask the active model.
5. The old mount-only query-string loader could retain a prior tour after navigation. It lacked a distinct loading/failure boundary around the editor.
6. The preview needed explicit linked-offer provenance: an active linked offer legitimately outranks the manually edited discount. The read model now carries this distinction instead of silently inferring it.

## Implemented

- A pure projection builds the current preview from every editor-owned value: basic fields, current route/category associations, summary/overview, itinerary/meals/images/note, grouped highlights, inclusions/exclusions, add-ons, coordinates/locations, date-pricing rows/tiers, gallery/captions/credits and video metadata/posters.
- Current blank text/arrays/images remain blank, with no saved-data restoration. New and existing tours use the same projector. Blank media sources and captions are filtered together to retain association.
- Preview language is an independent EN/ES/IT selector, available in the sidebar and open dialog. Optional translations fall back to the current English form value. Explicitly cleared unsaved translations use local markers so they do not silently display saved English; the existing translation save/revert contract is retained. Arabic is not offered.
- The default sidebar updates immediately without opening a modal and prices do not depend on a selected image. The full read-only preview has desktop/mobile-width controls, gallery thumbnail selection and the public page's hero/gallery/facts/content/pricing hierarchy.
- Date-pricing cards remain visible on the Date Pricing step and in full preview, using the same public price-card classes. Missing values display a dash rather than zero. Date-pricing display rows are explicitly separate from booking traveler rates.
- Existing Base UI Dialog supplies a viewport portal, modal focus trap, initial/final focus, Escape/outside dismissal and scroll locking. All preview buttons explicitly use type=button; there is no preview submit/save/checkout action.
- Existing published Website Appearance tokens are read, not changed, and applied inside the public preview scope. The surrounding admin appearance remains separate.
- The builder route keys the editor by canonical query input so changing/new-trip navigation reinitializes state. Loading and read errors have an explicit retry boundary; outdated responses cannot replace a newer editor.
- Publishing still requires an explicit owner action through the existing APIs. Empty base/tier inputs are no longer accepted as zero. Publishing requires a cover image because public tour rendering expects one, while an incomplete preview may remain image-free. Removed gallery/location values are not restored from the saved source. An inactive category's detail payload is cleared on explicit save so its old rates cannot outrank the selected category; existing API SEO preservation remains in force. None of these persistence paths was executed against the demo records during this task.

## Pricing behavior

- The actual Tour model has a DECIMAL base price and JSON traveler/date tiers; the authoritative booking service stores USD. There is no per-tour currency selector/column to invent.
- Preview reuses `getBookingTotal` and the existing independent adult/child/infant nearest-tier rules, counting adults + children + infants for tier selection. Active deal rules are shared with the public/booking model.
- Unit amounts are rounded to cents before integer multiplication/summation, matching `server/bookings.ts`, including fractional-cent legacy JSON inputs.
- Limits match booking validation: 1–50 adults, 0–50 children, 0–50 infants, at most 60 total; fractional/invalid counts are not quotable.
- Missing/blank/invalid/duplicate/missing-required-group tier configuration produces an incomplete message, not a saved or zero total. An explicit valid zero remains valid.
- `formatPrice(value, 'USD', locale)` is the existing currency formatter. USD is explicitly labelled, no display conversion occurs and no exchange rate is introduced. Per-person units and traveler group total are separate. Optional add-ons are listed but explicitly excluded from that group total; real booking selections and all final pricing remain server-authoritative.
- The derived optional `pricingDealSource` field is additive in the Tour read model/API mapping. An active linked offer remains authoritative and gets an explanatory notice. No new database field or preview API was added.

## Public-page fidelity / intentional differences

The preview uses the actual public layout/section/price-card classes, public currency/date helpers and published design tokens, with scoped containment for an admin dialog. It does not mount the entire interactive public route: those components include cart/favorites, booking, reviews, provider feeds and other behavior that should not run on an unsaved admin draft.

Global site navigation/footer, actual booking/cart actions, live reviews, related tours and provider video players are omitted. Locations show current names/coordinates instead of mounting an external map; videos show current metadata/posters rather than loading external players. Optional content is read-only and itinerary sections are expanded for inspection. Mobile width is a constrained presentation, not a browser/device emulator. Pixel-perfect visual fidelity has not been browser-verified.

Preview reads all current manual ES/IT maps. Existing public route consumers' translation/fallback behavior was not changed by this phase; as previously documented in `docs/trip-builder-translations.md`, some storefront consumers still do not consume every manual map. This work does not claim a site-wide public translation rollout. Unsaved explicit-clear markers are preview-local; saved translation deletion still follows the existing editor's missing-translation fallback contract.

## Data integrity and APIs

- No Prisma schema/migration/environment change. Existing create/edit authorization, same-origin protection, SEO preservation and real-booking server calculations remain in place.
- Opening preview, selecting language, changing preview counts/images/viewport and closing it use local React state/pure calculations. They neither call persistence functions nor change the editor's persisted-field dirty snapshot.
- Automated preview rendering tests reject any fetch call; server repository mapping is tested with mocked database access. Full safe tests use their existing mocked/in-memory boundaries; database-writing integration tests were not run.
- SELECT-only before/after fingerprint: **59 tours, 7 offers**, identical SHA-256 `edac602e6f2e535a779418e0e427724e6db5d2b8460787617e16d7facf0222e1` across all stored Tour/Offer fields, including pricing JSON.
- `scripts/verify-trip-preview-readonly.cjs` rejects non-local DB targets and prints counts/hash only, never titles, URLs or prices.

## Checks

- TypeScript passed.
- Relevant preview/translation/offer suite: **4 files, 50 tests passed**.
- Full official unit subset: **24 files, 264 passed**.
- Full available safe suite: **122 files, 1569 passed** on the final source.
- Production build: `pnpm exec next build --webpack` **passed, exit 0, 282/282 pages**, including TypeScript and build traces. Direct Next compilation avoids replacing the previously documented locked Prisma DLL; no client regeneration is required by this phase.
- `git diff --check`: passed.
- Independent static review identified empty-tier and gallery-caption edge cases, now fixed and regression-tested. Its provenance concern is covered by the additive read-model mapping and test. No visual/browser or real save/booking write verification is claimed.

## Files

- `app/admin/trips/builder/page.tsx`
- `components/admin/trip-builder.tsx`
- `components/admin/trip-builder-preview.tsx` (new)
- `components/admin/trip-builder-preview.css` (new)
- `lib/trip-builder-preview.ts` (new)
- `data/types.ts` (optional derived Tour metadata)
- `lib/server/special-offers.ts` (derived deal provenance only)
- `lib/server/tours.ts` (preserve provenance in read mapping)
- `tests/trip-builder-preview.test.ts` (new)
- `tests/trip-builder-preview-render.test.ts` (new)
- `scripts/verify-trip-preview-readonly.cjs` (new)
- `TRIP_BUILDER_PHASE8_VERIFICATION.md` (new)

## Manual acceptance

1. Open a new and an existing trip; change title/overview/itinerary, delete sections and reorder/remove images without saving. Check sidebar/full preview and image captions, including an entirely blank draft.
2. Switch EN/ES/IT both outside and inside the dialog; verify current translations, current-English fallback and explicit unsaved clears. Preview controls must not mark an otherwise clean trip dirty.
3. Change independent traveler rates and counts (including infants), test tier boundaries, zero, blank/deleted rates, 60/61 travelers, manual discount and an active linked offer. Confirm explicit USD, unit vs group totals, add-on exclusion and date-price separation.
4. Test modal open/close, Escape/backdrop, focus restoration, keyboard controls, mobile width and real phone/tablet layout. Check the published appearance without changing admin colors.
5. Navigate between different builder slugs/new mode; verify loading/error/retry and no old draft leakage. If you intentionally save test content, verify cover validation, clears/category changes and reopen behavior against the existing APIs.

Stopped at Phase 8. No production readiness, deployment or later-phase completion is claimed.
