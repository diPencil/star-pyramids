# Mobile catalogue heroes

Rent Car and the One Day Tours, Multi Days Tours, Nile Cruises and Shore Excursions directories share `PageShowcaseHero` (directly, through `TourCategoryHero`, or through the empty-fleet hero). Events has its own composition with the same base visual classes and a separate rail/summary.

The shipped `/egypt-hero.png` is a square image with white bands above and below the actual photograph (about 17% each). Those bands appeared gray under the hero overlay. A minimum 530px hero aligned to the bottom also left excessive space above shorter copy when no published featured record existed.

At up to 760px, shared catalogue heroes now grow with their content, use the Events top/bottom content spacing, keep a single fluid column, and wrap headings and actions. The rail remains conditional on real records. Empty directories do not receive fabricated featured content or statistics. The homepage hero, desktop styles and Events composition remain unchanged.

`data-mobile-letterbox` identifies only the effective mobile source equal to the known square fallback. CSS overscan trims its baked-in bands on phones. Custom uploads are not scaled, including when the mobile and desktop CMS sources differ. Existing CMS source selection, alt text, object position, overlay, localization and visibility remain owned by the existing renderer. No media file is edited.

Verification: renderer tests exercise the fallback, custom uploads, mobile source precedence, CMS crop and empty states. CSS tests enforce the phone breakpoint, content-driven height, action wrapping and the fallback crop factor. No browser automation, database writes, deployment or push is part of this change. A real-device visual check remains outstanding.
