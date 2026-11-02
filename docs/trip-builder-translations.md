# Trip Builder language tabs

Each content step has its own English, Spanish and Italian selection, using
`ENABLED_LOCALES`. Arabic remains disabled and existing Arabic fields are
preserved. Pricing-only and publication review steps contain shared settings.

Text edits stay in the builder state when changing language or step. Language
selection is excluded from the saved-state comparison. Prices, dates, images,
URLs, category selections and coordinates remain shared.

Manual translations are optional `translations` maps stored alongside their
English objects in the existing JSON columns. Basic text and paragraph/list
text use the active detail object's map. Repeatable items carry their own maps.
Name-only map locations retain the existing string/coordinate contract and use
the detail object's parallel `locationTranslations` array. Day-tour highlight
groups are retained in `highlightGroups` alongside the public flattened list.
Gallery captions retain their legacy Arabic text on the corresponding image
when reordering. No database migration is required.

The existing Save & Publish API, authorization and error handling are reused.
English remains the canonical required content. Translated repeatable items
without canonical English are rejected before saving instead of being silently
filtered out. Saving requires an explicit owner action; implementation QA does
not write to owner records.

The builder and public detail pages use the saved manual ES/IT maps, with
English fallback for missing public translations. This is not automatic
translation. Overview, itinerary description and itinerary note additionally
support explicitly marked HTML-v1 content; the resolved language and format
must always travel together. Other fields retain their existing plain formats.
See `trip-builder-rich-text.md` for the security, serialization and rollout
contract. Arabic remains disabled.

Verification: `tests/tour-translations.test.ts` covers language isolation,
JSON round trips, reverting changes and repeatable item ordering. Browser QA
requires a working browser connector; code checks do not establish visual or
authenticated MySQL save verification.
