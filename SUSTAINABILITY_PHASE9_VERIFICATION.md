# Phase 9 — Travel With Purpose CMS media

## Integration and files
- `lib/page-sections.ts`: HOME_SECTIONS.sustainability registers optional `media.badgeImage`. Existing missing/null media is accepted without losing text, items, CTA, visibility or ordering; unknown fields and unsafe URLs are rejected. Other sections retain their existing media requirements.
- `components/admin/page-visual-editor.tsx`: existing media URL and upload controls now appear for sustainability; explicit Remove image action stores an empty string. Existing draft/publish/read authorization and upload locking are reused.
- `components/sustainability-badge.tsx`: validated image rendered inside existing sus-badge with absolute cover cropping and inherited radius. Original text remains invisibly in layout while image is shown, retaining original responsive dimensions and avoiding load/error shifts. Localized badge text supplies alt text. Invalid/missing images and image load errors render original decorative panel. Replacement source can load after a failure.
- `components/homepage.tsx`: only Phase 9 change is badge component import and sustainability panel connection; pre-existing Gallery modifications preserved.
- `tests/cms-page-content.test.ts`, `tests/cms-page-render.test.ts`, `tests/sustainability-badge.test.ts`: legacy payloads, lifecycle persistence, replacement/removal, URL validation, EN/ES/IT public render, hidden sections, image failure and fallback.

## Architecture / data safety
Storage is the existing SiteSetting JSON document `cms.page.homepage.v1`; no schema or migration changes. Public reads decode through the same validator, and read published content only. Existing media endpoint `/api/admin/website-cms/hero-media` requires same-origin authentication and settings.edit; existing file/signature/size checks and MEDIA_STORAGE_DIR storage are reused. No business records, media files, env or production were modified. No browser checks, commit, push or deployment.

## Verification
- TypeScript passed.
- Focused CMS/media authorization tests: 5 files / 55 tests passed before the final layout-only improvement; final complete suite includes those tests and the improved layout.
- Unit suite: 24 files / 264 tests passed.
- Final safe suite: 123 files / 1583 tests passed. Database-writing integration tests remain excluded by the existing Vitest configuration.
- Independent read-only review: no blocking findings.
- Initial sandbox test run had temporary-file ENOENT; the same checks passed outside that sandbox.
- Production Next build: final result recorded below. Direct `pnpm exec next build --webpack` avoids replacing the pre-existing locked Prisma DLL; combined Prisma-generate build was not attempted.

## Limits and manual acceptance
No browser QA or actual database-writing save/upload verification was performed, as requested. Upload authorization/storage safety relies on the existing tested media implementation; no test uploads were written. No new production readiness claim.

1. Open Website CMS → Pages & Sections → Homepage → Sustainability.
2. Upload/select a supported image URL; Save Draft, reopen, and verify the selection.
3. Preview desktop/mobile in EN/ES/IT, then publish and check the public image, unchanged statistics/text/CTA and section order.
4. Replace the image, publish, then remove it and publish: original decorative badge should return.
5. Try an unavailable HTTPS image: original badge should appear after load failure; invalid URLs should be rejected when saving.
6. Confirm read-only users cannot upload or save.

Final Next production build: passed, exit 0, 282/282 pages. Build TypeScript passed. git diff --check passed. No browser or live save/upload checks performed.
