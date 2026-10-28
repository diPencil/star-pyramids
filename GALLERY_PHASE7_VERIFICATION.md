# Journey Gallery — Phase 7 local verification

Date: 2026-10-27. Local implementation only. No browser testing, production access, database mutations, migrations, record deletion, commit, push or deployment. Phase 8 was not started. Existing Rent Cars, Reviews and Destinations implementation changes were preserved.

## Root causes

- The expanded homepage image used Next Image `fill` directly inside the full-screen backdrop, without a correctly sized/positioned media container. Absolute positioning and max dimensions did not center the image or establish contain sizing; portrait/landscape images could stretch or sit incorrectly.
- Image and video overlays were separate inline subtrees within the animated/CMS page section, vulnerable to parent stacking/overflow constraints. Images lacked Escape handling; both overlays lacked a complete focus trap, focus restoration, scroll lock and collection navigation.
- Feed failures were swallowed as empty arrays and cached as successful empty galleries. Cache invalidation could race an older response; mounted tour consumers did not refetch after invalidation.
- Public homepage reads returned every published placement, and assignment arrays could disclose unrelated/unpublished tour slugs. Tour gallery reads did not verify publication of the target tour.
- Gallery-only editors could upload gallery videos but not images/posters because catalogue image-upload permissions omitted gallery permissions. The assignment picker additionally required unrelated `tours.view` permission.
- Publication submitted a stale complete table-row payload through PUT, risking overwriting newer content. Reorder silently discarded malformed entries and accepted duplicate IDs or missing records.
- Local URL validation accepted protocol-relative/backslash-style paths and treated local JPEGs as playable videos. An existing test explicitly expected JPEG-as-video behavior; that regression expectation was corrected.

## Implemented behavior

- One reusable body-level portal lightbox for selected image/video, retaining the current homepage's two marquee rows, directions, timing and CMS wrapper.
- Viewport-constrained grid stage; images/native videos use intrinsic width/height with `object-fit:contain`, never expanded `fill`/cover. Safe-area padding, touch-sized controls, long captions with scrolling and reduced-motion styles are included.
- Close button, Escape, backdrop/stage-background click, initial focus, Tab/Shift-Tab trapping, focus restoration and reversible body scroll locking.
- Selected item/caption and counter, previous/next buttons and arrow navigation with safe wrapping. One item has no redundant navigation controls. Native player arrow keys are preserved.
- Native videos retain controls, poster, playsInline and metadata preload, with no autoplay. Keyed media remounts pause/unload the previous native player and remove the prior iframe on change/close. Existing approved social resolver/storage conventions remain authoritative; embeds have an original-platform fallback link.
- Loading/error states for media; invalid video sources render a safe error. A failed feed is not cached as a real empty gallery; Homepage has explicit load/retry feedback and intentionally hides a successful empty gallery. Old pre-invalidation responses cannot overwrite new published data.
- Homepage ordering continues to use the existing shared selectors (sortOrder, createdAt, id). Visual marquee clones are retained for animation and hidden from the accessibility tree; they are not duplicate API/database records.
- Public homepage SQL requires both publication and homepage placement. Public tour SQL requires published target tour, VIDEO type, publication, tour placement and matching global/selected assignment. Only the requested tour association is returned; homepage public responses carry no private assignment list.
- Admin's existing create/edit/delete, dedicated editor, filters, pagination and preview composition remain. Visibility is now a narrow authenticated PATCH that cannot rewrite title/caption/URL/assignments. Mutation/save guards and upload-aware disabling prevent overlapping clicks/saving an unfinished upload.
- Reorder validates the entire request, locks existing item rows in stable ID order inside one transaction, rejects missing IDs and writes positions atomically. Existing unique mediaHash identity prevents duplicate stored records; no aggregation creates new rows.
- A gallery-authorized minimal tour-choice feed replaces the unrelated tours-admin API dependency. Image/poster uploads reuse the existing catalogue image pipeline; gallery-video keeps the existing 5 MB MP4/WebM signature-validated pipeline. Storage architecture and stored files were not replaced/deleted.
- Gallery-specific EN/ES/IT UI copy and accessible controls are provided. Optional locale/upload-state props on the shared ImageField preserve its existing defaults for other consumers. Arabic remains disabled; pre-existing titleAr values are retained. Saved titles/captions are shown verbatim (English fallback where no ES/IT content exists), never fabricated or automatically rewritten.

## API and database

- Existing models `JourneyGalleryItem` and `JourneyGalleryTour`, unique mediaHash and unique item/tour assignment remain unchanged. No migration was introduced.
- Public `GET /api/journey-gallery` and `?tour=slug` remain read-only. `?admin=1` and item GET require gallery.view. New `?tourChoices=1` requires an appropriate gallery permission and returns only slug/title with private/no-store response headers.
- POST requires gallery.create, PUT/PATCH/reorder gallery.edit, DELETE gallery.delete; all mutations enforce same-origin. New PATCH accepts only `{isPublished:boolean}`. Payload validation rejects invalid booleans, invalid integer order, unsafe local URLs and known mismatched image/video sources.
- Public feed failure retains the compatible `{items:[],unavailable:true}` shape; the new client treats it as error/retry, not a successful empty cache.
- Delete retains existing append-only media-file policy. No actual create/edit/publish/delete/upload action was executed against business storage during this task.
- SELECT-only before/after evidence: **5 gallery items, 0 assignments**, identical SHA-256 `55cd8ff71e6fe32afd633a2c9d6cd6043d92b68a3328dd167ff1f2dc2a2a750f` over all record/assignment fields. The read-only script rejects non-local database targets and prints no media URLs/content.
- CMS `gallery` placement/visibility/order and heading/subtitle remain owned by the existing CMS wrapper; media records remain owned by Gallery. No second source of truth or fallback demo records were introduced.

## Verification

- TypeScript: passed.
- Focused Gallery suite: **6 files, 82 tests passed**.
- Official full unit subset: **24 files, 264 passed**.
- Full available safe suite: **120 files, 1533 passed**.
- `git diff --check`: passed.
- Production build: `pnpm exec next build --webpack` **passed, exit 0, 282/282 pages**, including TypeScript and build traces. Direct Next compilation separates validation from the previously documented default Prisma DLL replacement lock; Gallery requires no schema/client regeneration.
- Independent static review reported no unresolved concrete safety/correctness finding. Its observed tour-cache invalidation issue was resolved in the reviewed snapshot.
- Tests use mock-backed API/repository operations, deterministic DOM stand-ins and actual React SSR. They exercise navigation, selected media/counter, keyboard/focus/scroll lifecycle, native video cleanup, image sizing CSS contracts, API authorization, gallery-only image/video upload permission, public filtering/order, narrow publishing, atomic reorder validation and cache races. Existing signature/media tests and CMS compatibility tests passed in the full suite.

## Files changed

- `components/homepage.tsx` — Gallery section only and its imports.
- `components/gallery-lightbox.tsx` (new)
- `components/gallery-lightbox.css` (new)
- `lib/gallery-lightbox.ts` (new)
- `lib/journey-gallery.ts`
- `lib/journey-gallery-client.ts`
- `lib/server/journey-gallery.ts`
- `app/api/journey-gallery/route.ts`
- `app/api/journey-gallery/[id]/route.ts`
- `app/api/media/route.ts` — gallery permission additions only.
- `app/admin/gallery/page.tsx`
- `app/admin/gallery/new/page.tsx`
- `components/admin/gallery-form.tsx`
- `components/admin/gallery-text.tsx` (new)
- `components/admin/image-field.tsx` — optional Gallery locale/upload-state support and safe error handling; existing defaults retained.
- `tests/journey-gallery.test.ts`
- `tests/gallery-lightbox.test.ts` (new)
- `tests/gallery-lightbox-render.test.ts` (new)
- `tests/gallery-api.test.ts` (new)
- `tests/gallery-repository.test.ts` (new)
- `tests/gallery-feed-cache.test.ts` (new)
- `scripts/verify-gallery-readonly.cjs` (new)
- `GALLERY_PHASE7_VERIFICATION.md` (new)

## Unverified boundaries / user acceptance checklist

No browser visual/interaction result is claimed. No real upload, publication or CRUD mutation was tested against the demo database/media directory. Hostinger persistence/configuration was not accessed or changed. Real social embeds depend on provider availability, permissions, cookies and embedding policy; cross-origin iframe keyboard events cannot be intercepted by the parent. Close/previous/next controls and original-platform link remain available outside the frame.

1. Open portrait and landscape images on desktop/tablet/mobile; check centering, contain sizing, captions, safe-area controls and unchanged gallery rows.
2. Test close, Escape, clicking outside the media, Tab/Shift-Tab, focus return, background scroll lock, arrows/wrapping/counter, and a single-item gallery.
3. Play a native MP4/WebM and navigate/close; ensure sound/playback stops. Verify poster and provider embeds/original links; try a missing image/video source.
4. With intentional test content, exercise image/poster/video upload, create/edit, publish/hide, ordering and deletion. Stored shared media files must remain. Verify gallery-only staff permissions and invalid/mismatched/oversize files are rejected by the existing pipelines.
5. Verify Homepage-only, global tour, selected tour, draft/hidden tour exclusion, no duplicate records and CMS section visibility/order. Check EN/ES/IT and reduced-motion behavior.

Stopped at Phase 7; no production readiness or deployment claim before manual acceptance.
