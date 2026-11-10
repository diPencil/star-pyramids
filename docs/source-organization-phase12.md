# Branding ownership — Phase 12

Six cohesive source relocations, with import/reference updates only. This phase
preserves the existing branding source, provider identity/state, React cache,
fallbacks, favicon effects, SVG markup and all previous local work. It does not
redesign branding, change settings, enable a language or modify authentication.

## Before/after and exact paths

| Original path | Destination |
| --- | --- |
| `components/brand-context.tsx` | `components/branding/brand-context.tsx` |
| `components/brand-favicon.tsx` | `components/branding/brand-favicon.tsx` |
| `components/brand-icons.tsx` | `components/branding/brand-icons.tsx` |
| `components/brand-mark.tsx` | `components/branding/brand-mark.tsx` |
| `lib/brand-settings.ts` | `lib/cms/brand-settings.ts` |
| `lib/server/brand-settings.ts` | `lib/server/cms/brand-settings.ts` |

Root direct-file counts: components/ **16 → 12**, lib/ **10 → 9**, lib/server/
**16 → 15**. The existing CMS folders own the shared public branding settings
contract and its server projection; branding/ is a four-module identity group.
No wrapper, barrel, duplicate implementation or new service abstraction is added.

```text
components/branding/
  brand-context.tsx     # existing server-seeded client provider
  brand-favicon.tsx     # existing document icon synchronization
  brand-icons.tsx       # existing third-party brand SVG primitives
  brand-mark.tsx        # existing shared company identity rendering
lib/cms/brand-settings.ts
lib/server/cms/brand-settings.ts
```

All consumers, including root layout, auth/admin social icons, account shells,
print documents, support widgets, reviews and tests use the new paths. The
admin-store facade remains at its public entry and re-exports the same brand
contract. BrandProvider keeps exactly the same ownership and mount order in
app/layout.tsx. The server module still imports server-only and selects only
public brand keys. No asset URL or filesystem directory is relocated.

## Intentionally retained roots

- components/: auth-pages.tsx is the established public authentication page
  entry; authenticated-user.tsx and locale.tsx are global providers; consent-manager
  and its CSS Module plus site-measurement are the established sitewide tracking
  mounts; staff-preview-bootstrap.tsx and impersonation-banner.tsx preserve the
  security/preview mount contracts; site.tsx and extended-pages.tsx are public
  compatibility entries; README.md is the ownership guide; homepage_backup.txt
  is protected user backup content and is not inspected or modified here.
- lib/: admin-store.ts remains a mixed public facade; auth-types.ts is the
  shared authentication contract; documents.ts spans commercial UI/services;
  json-text.ts is pinned by a protected Prisma importer; query.ts spans catalogue
  and search; staff-preview-client.ts and use-current-user.ts are shared security
  integrations; utils.ts is pinned by components.json; README.md is the guide.
- lib/server/: central auth/auth-navigation/session/guards/staff-preview/users
  and CSRF entry points remain stable; db.ts, errors.ts, logging.ts, rate-limit.ts
  and request-json.ts are shared infrastructure; locale.ts owns global server
  language detection; payments.ts remains the central payment transaction owner;
  settings.ts spans public/secret settings across features. See Phase 11 for
  individual reasons, superseded only for the branding projection moved here.

## Verification and limits

The first batch passed 43 focused tests across five files; the second passed
41 across five files (overlapping checks, not unique-test totals). TypeScript
passed after each batch. The full default suite ran once: **3,313 passed,
zero failed, one skipped**, across 244 passed test files and one skipped file
(126.05 seconds). The count includes the new sidebar-release tests committed
since Phase 11. The existing database-backed integration exclusions and opt-in
skip remain in effect; a process-only unreachable database URL guarded execution.

The static graph inspected 950 files and 3,831 local references: no unresolved
imports, filename-case mismatches, runtime cycles or detected client/server
leaks. Source reconstruction verified 950 existing code files; 18 changed only
in approved import/reference literals. Four moved files are byte-identical and
the other two reconstruct exactly after reverting import paths. All 349 live
manifest digests match, and all 343 previous relocation records retain their
historical from/to and before/after digests. Sixty-five protected Prisma,
configuration and dependency files, the GTM fix, sidebar-release code, Git HEAD
and the empty staging index are unchanged. git diff --check passed.

Sixteen external operational source files were inspected for the original paths;
none referenced them. No operational tool was run or changed. Existing historical
reports retain original path descriptions; the cumulative manifest supplies live
paths. The sidebar-release implementation and its two local commits remain intact.

No DB connection, Prisma/schema/migration change, environment/dependency/config
change, build, browser, commit, push or deployment. Builds remain unrun because
static generation may query the operational database; browsers are prohibited by
project instructions. Mocked tests do not prove deployed database/UI behavior.
