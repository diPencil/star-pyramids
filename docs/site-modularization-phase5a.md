# Safe site.tsx modularization — Phase 5A

`components/site.tsx` remains the existing client entry point. Its complete 32-name runtime export surface and existing type declarations remain available at the same import path. Existing consumers require no import changes.

## Exact extractions

| New module | Declarations moved unchanged | New module lines |
| --- | --- | ---: |
| `components/tours/tour-card.tsx` | `CardGallery`, `TourCard`, `TourCardPresentation` | 99 |
| `components/shared/trip-search-engine.tsx` | `FilterField`, `HeroField`, `TripSearchEngine` | 287 |
| `components/layout/site-header.tsx` | `Logo`, `NotificationDropdown`, `STAFF_ROLE_KEYS`, `isStaffUser`, `HeaderAuthAction`, `useActiveNav`, `COMPANY_LABELS`, `getNavConfig`, `getEgyptTourNavLinks`, `NavLinks`, `Header` | 446 |

All 17 moved declarations retain their exact original declaration text, including signatures, hooks, callbacks, markup, classes, localization and internal comments. The 39 remaining named declarations also retain their original declaration text. Only imports and forwarding exports change around them.

The shared card `images` binding imports the same `tourImages` object directly from `data/tours`, avoiding a backward import. `COMPANY_LABELS` is an internal export of the header module, imported by the retained footer; it is not added to the public site.tsx exports. There are no wrappers, duplicated implementations, new generic helpers, lazy loading or new runtime configuration.

## Line counts

- Original `site.tsx`: **1219 lines**.
- Current `site.tsx`: **458 lines**.
- Reduction: **761 lines (62.43%)**.
- Counts consistently include the final empty line. New modules include their own necessary imports and client directives. This is a responsibility split, not a claim of reduced bundled code.

## Public compatibility

The new compatibility suite checks the entire existing runtime export set, function identity through the original entry point, and `site.images === tourImages`. Public extracted exports remain:

- `components/tours/tour-card.tsx`: `CardGallery`, `TourCard`, `TourCardPresentation`.
- `components/shared/trip-search-engine.tsx`: `FilterField`, `HeroField`, `TripSearchEngine`.
- `components/layout/site-header.tsx`: `Logo`, `NotificationDropdown`, `useActiveNav`, `getNavConfig`, `getEgyptTourNavLinks`, `NavLinks`, `Header`.

All three new modules keep `use client`. Import checks find no direct or transitive dependency from an extracted module back to `site.tsx`. No CSS files change. The public/internal provider hierarchy remains unchanged.

## Intentionally retained

- SiteShell, SupportWidgets, footer/promotion/scroll composition, and the existing global images/data aliases. These retain their provider and shared layout ownership.
- Showcase/category heroes and their props. They compose provider-managed content with the remaining site layouts.
- Region, destination, multi-day/category and tour-listing pages and their private filtering/routing helpers. Further extraction would require deliberate handling of their shared composition dependencies.
- Breadcrumb, Heading, CategoryFilter/TourFilters, HelpCTA and the legacy HomePage composition, plus existing catalogue/copy constants. Small leaf moves are outside this cohesive extraction scope.

## Tests and source-reader references

- Focused tests passed after each extraction: **114**, **99**, **125** respectively; TypeScript passed each time.
- `tests/site-module-compatibility.test.ts` adds five regression tests for entry-point exports, function identity and shared image identity.
- Source-reader paths in account-copy/image-loading and mobile-header checks follow the extracted implementation; assertions are retained.
- Essential localization checks include all three extracted modules in addition to the remaining site.tsx content, preserving the copy coverage.
- The full configured suite ran once after all three extractions: **3224 passed, zero failed, one skipped**, across 239 passed test files and one skipped file (95.96 seconds). This includes the five new compatibility tests.

## Verification limits and safety

No browser QA (project rules), production build, database connection/operation, Prisma/environment/dependency/configuration change, commit, push or deployment. Existing tracked/untracked changes and Git HEAD/index are preserved. Existing source-organization relocation manifests remain unchanged: these are declaration extractions, not additional file moves.

Final import checks resolved all local modules (3595 edges); none of the new feature modules can reach the site entry point. All original moved/retained declarations compare byte-for-byte, and unrelated baseline files retain their hashes. git diff --check passed.
