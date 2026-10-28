# Saved branding on refresh — 2026-10-28

## Verified causes

`useBrandSettings` originally initialized every client with `/logo.png` and `/favicon.png`, then replaced them after `/api/settings` returned. The favicon effect could therefore overwrite the correct server metadata with the default icon during hydration. The public settings endpoint also permitted a 60-second cache, and an old in-flight response could overwrite a newer settings refresh.

## Fix

- Added an allowlisted server branding reader and a shared initial BrandProvider. Initial HTML and client hydration now use saved branding; icon metadata uses the same request-scoped snapshot.
- Preserved the existing public hook exports and compact favicon-based dashboard identity behavior.
- Avoided synchronizing warm stale module data over the server seed. Explicit successful updates/clears still apply; unrelated storage events do not reset branding.
- Settings requests/responses use no-store. Request generations prevent stale completions from replacing new reads or releasing a newer single-flight guard. A changed server seed invalidates earlier requests once; multiple logo consumers share the same fresh request.
- Existing public assets remain fallback resources for unconfigured installations and other existing references. No images, database records, environment configuration or media storage were deleted or changed.

## Files

New: `components/brand-context.tsx`, `lib/brand-settings.ts`, `lib/server/brand-settings.ts`, and four `tests/brand-*.test.ts` regression files.
Updated: `app/layout.tsx`, `app/api/settings/route.ts`, `lib/admin-store.ts`, `lib/storefront-settings.ts`.

## Verification

- TypeScript passed.
- Full safe suite: 160 files / 1993 tests passed.
- First-render SSR tests contain the saved image URLs and no default src URLs. Node tests cover updates, explicit clears, no-store headers, public key allowlisting and request/seed races. Independent review confirmed the race fix.
- No real browser testing or live database-writing tests were performed. Production browser favicon caches and hosting behavior have not been inspected.
- No commit, push or deployment performed for this change.

Manual acceptance: save distinct logo/favicon uploads via Settings, refresh public/admin/customer pages and verify the saved assets appear immediately; replace them again and verify no old response restores prior branding. Verify intentional clearing/default restoration. Missing configuration or a server settings outage still uses the original fallback resources by design.

Final production validation: pnpm exec next build --webpack passed (exit 0), including TypeScript and 282/282 generated pages. The existing generated Prisma client was reused; no schema changed. git diff --check passed.
