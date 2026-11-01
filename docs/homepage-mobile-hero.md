# Homepage mobile hero

1 November 2026. Owner-selected layout: a shorter landscape media area with the heading centered over it; the three search tabs and original engine follow underneath. After reviewing the initial square, the owner requested less space above and below the video: the preferred ratio is now **8:5 (width 4, height 2.5)**. A 400px-wide frame is normally 250px tall instead of 400px.

## Implementation contract

- At widths up to 760px, `.home-hero-visual` establishes a preferred 8:5 grid frame and centers the whole CMS heading/eyebrow block. Its intrinsic minimum lets unusually long configured text or enlarged text grow rather than truncating it. Normal headings render within the shorter frame.
- `.home-hero-media` contains image/picture, video and overlay, with absolute bounds inside that frame. Media crop continues using the existing `position` setting. On larger screens the visual wrapper uses `display:contents`, preserving the previous text/flex flow and media bounds. The inner positioned media wrapper remains a real box for Next Image fill behavior.
- The existing `TripSearchEngine` is passed as the same sibling child after the frame. No engine fields, tabs, state, callbacks, navigation, pricing or booking code changed. The existing mobile shell keeps the engine in normal flow and the fixed-navigation clearance unchanged.
- All content still comes from the existing Hero Settings: image/video type, optional mobile URL, poster fallback, crop position, overlay and EN/ES/IT text. No new CMS property or database write was introduced.
- Hidden/unavailable hero states omit the media/text frame and retain the engine without an empty media frame. Original media fallback remains supported.
- Existing video source selection, reduced-motion/data-saver fallback, visibility pause/resume and inline autoplay behavior are untouched.
- CMS preview still uses the same component and remains inert. Preview/publish permissions and storage contracts are unchanged.

## Files

`components/homepage-hero.tsx` owns structure; `app/globals.css` contains only the two new base wrapper rules; the new phone layout is isolated to `app/mobile-shell.css` at max-width 760px. Existing unrelated working-tree edits were preserved.

`tests/homepage-mobile-hero.test.ts` checks actual server markup, EN/ES/IT copy, image/mobile-image and video-poster settings, overlay/crop, hidden/error/default states, maximum text, the real engine's three tabs, and parsed CSS at 320/375/390/430/760 and 761/1024/1440 widths. Those CSS checks verify the breakpoint contract, not real browser pixels or interactive playback.

The 21st UI Build workflow was read and the project's existing design context reused. Its CLI/connector was unavailable; no tooling or components were installed. The existing project component was sufficient for this selected direction.

No browser automation is permitted by project instructions. Final verification results are recorded below; device screenshots, client interactions and visual layout remain unverified in a real browser. No database, connection, publishing or deployment changes are part of this task.

## Verification results

- Vitest: **9 files / 67 tests passed**. Included the new mobile hero contract, existing hero lifecycle/preview/API/storage/media, mobile CSS, public controls and homepage mobile cards.
- TypeScript: `node node_modules/typescript/bin/tsc --noEmit --incremental false` passed, exit 0. For the 8:5 revision it was rerun after the build completed; an initial overlapping run encountered transient missing generated `.next/types` files while Next rebuilt them.
- Compile-only build: `node node_modules/next/dist/bin/next build --webpack --experimental-build-mode compile` passed, exit 0; the 8:5 revision compiled in 28.0 seconds. No generate/prerender phase, finalized release build or deployment was performed.
- Changed-file `git diff --check` passed. The pre-existing unrelated stylesheet comment edit was preserved.
- Existing video effects, CMS schema/editor, preview wiring, TripSearchEngine and fixed bottom-navigation rules were left intact. Self-review confirmed the new media box excludes the engine, and larger viewports retain the previous flattened flow.
- The 21st CLI/connector was unavailable, so its CLI search/review commands were not run. No component download, dependency or lockfile change occurred.
