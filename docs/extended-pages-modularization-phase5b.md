# Safe extended-pages.tsx modularization — Phase 5B

The existing `components/extended-pages.tsx` import path remains a client compatibility entry point. All **29 runtime exports** retain their names and function identity through that entry point. No application consumer imports need to change.

## Exact extracted modules

| Module | Original declarations preserved | Lines |
| --- | --- | ---: |
| `components/cars/car-pages.tsx` | `CarsPage`, `CarsPageContent`, `CarCard`, `CarRequestValues`, `CAR_OTHER_LOCATION`, `CarLocationOption`, `carLocationKindLabel`, `carLocationName`, `carLocationDisplayName`, `useCarLocations`, `carTodayLocal`, `focusCarField`, `CarRequestForm`, `CarRequestPage`, `CarRequestContent` | 557 |
| `components/enquiries/contact-page.tsx` | `ContactPage`, `ContactPageContent`, `ContactForm` | 251 |
| `components/account/password-recovery-pages.tsx` | `ForgotPasswordPage`, `ResetPasswordPage`, `ResetPasswordContent` | 284 |
| `components/content/public-content-pages.tsx` | `EditorialHero`, `DetailNotFound`, `ContentCard`, `GuidePage`, `AccessiblePage`, `FAQPage`, `PolicyPage` | 43 |
| `components/events/event-pages.tsx` | `parseEventRange`, `eventStatus`, `EVENT_IMAGE_FALLBACK`, `eventImageSrc`, `onEventImageError`, `EventCard`, `EventsPage`, `EVENTS_PAGE_SIZE`, `EventsPageContent`, `EventDetailPage` | 321 |
| `components/content/blog-pages.tsx` | `BlogsPage`, `BlogMagazineCard`, `BlogsPageContent`, `guideIconMap`, `GuideTipCard`, `GuideSection`, `BlogEditorialPage`, `BlogDetailPage` | 239 |
| `components/content/destination-pages.tsx` | `DestinationListProps`, `DestinationsPage`, `DestinationCatalogueStatus`, `DestinationCatalogueHero`, `DestinationsPageContent`, `destinationFactIcons`, `DestinationDetailProps`, `DestinationDetailPage`, `DestinationDetailContent`, `DestinationDetailView` | 158 |
| `components/offers/offer-pages.tsx` | `OffersPage`, `OffersPageContent`, `OfferDetailPage` | 70 |
| `components/account/legacy-account-page.tsx` | `AccountPage` | 12 |

All **60 original named declarations** were moved without changing their declaration text, including private helpers, type aliases, defaults, validation, JSX, hooks, callbacks, route URLs, form submission logic and translations. Original unused private event aliases also remain; this was not dead-code cleanup. All feature modules retain `use client`, matching the original boundary.

## Entry-point size

- Before: **1838 lines**.
- After: **38 lines**.
- Reduction: **1800 lines (97.93%)**.
- Line counts consistently include the final empty line. Necessary imports/client directives are included in the new module counts. No bundle-size optimization is claimed.

## Preserved public exports

`AboutPage`, `AccessiblePage`, `AccountPage`, `BlogDetailPage`, `BlogEditorialPage`, `BlogsPage`, `CarCard`, `CarRequestForm`, `CarRequestPage`, `CarsPage`, `ContactForm`, `ContactPage`, `ContentCard`, `DestinationDetailPage`, `DestinationDetailView`, `DestinationsPage`, `DetailNotFound`, `EditorialHero`, `EventCard`, `EventDetailPage`, `EventsPage`, `FAQPage`, `ForgotPasswordPage`, `GuidePage`, `OfferDetailPage`, `OffersPage`, `PolicyPage`, `ResetPasswordPage`, `SearchPage`.

`AboutPage` and `SearchPage` keep their pre-existing direct re-exports. The new compatibility suite checks the complete original runtime export set, both pre-existing re-export identities, and direct function identity for every extracted public function. Private prop aliases remain alongside their original functions with unchanged declarations; no public type or prop contract is rewritten.

## Remaining responsibilities

The original entry point now forwards exports and retains its client boundary. It contains no page/form implementations. Pre-existing unrelated import bindings/evaluation dependencies were deliberately not swept away. New feature modules own their complete original behavior. The large car-request and password-reset functions remain intact inside their feature modules; splitting callbacks or altering lifecycle logic is a separate change. Public/legacy information and account implementations remain supported rather than being replaced or redesigned.

Shared presentation (`EditorialHero`, `DetailNotFound`, `ContentCard`) lives with public content. Events and blogs import `DetailNotFound` from that module directly, never through the compatibility entry. No extracted module has a direct or transitive import back to `extended-pages.tsx`. No wrappers, duplicated implementations, generic abstractions or CSS changes were introduced.

## Source readers and checks

Source-reader tests follow the actual feature implementations:

- CMS content coverage retains the original compatibility source and includes every extracted module. Existing field/section coverage assertions are unchanged.
- Showcase-hero source ownership maps the same contact/car/blog/offer IDs to their new files, preserving localized-copy checks.
- FAQ, editorial-destination hero and blog-editorial readers inspect the new files without suppressing their assertions.

Focused tests and TypeScript passed after every extraction. Final passing focused counts: **170, 75, 211, 73, 75, 103, 103, 85, 150** in extraction order. One missing shorthand icon import (`ShieldCheck`) was caught during the contact extraction, restored before continuing, and its dependency detection was corrected; only import wiring changed.

The full configured suite ran once after all extractions: **3236 passed, zero failed, one skipped**, across 240 passed test files and one skipped file (94.00 seconds). This includes 12 new export/function-identity compatibility tests.

## Safety and verification limits

No database connection/operation, Prisma/schema/migration change, environment/dependency/deployment configuration change, browser test, production build, commit, push or deployment. Test processes use an unusable database URL and existing isolated mocks. Existing tracked/untracked work, previous site.tsx modularization and Git HEAD/index are preserved. Historical source-organization manifests are unchanged: these are declaration extractions, not file relocations.

Final verification resolved 3674 local import edges without failures. No new feature module can reach extended-pages.tsx through direct or transitive imports. All original 60 declarations remain exact and unrelated baseline files retain their hashes. git diff --check passed; Git HEAD/index are unchanged.
