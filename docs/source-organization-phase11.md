# Server infrastructure ownership — Phase 11

This phase groups cohesive server services without splitting implementations, changing business logic, or altering database/storage behavior. Previous organization and local work are preserved. Paths are relative to the application root.

## Exact moves

| Original path | Current path | Ownership |
| --- | --- | --- |
| `lib/server/email.ts` | `lib/server/email/email.ts` | Transactional templates, delivery and delivery-history service |
| `lib/server/email-smtp.ts` | `lib/server/email/email-smtp.ts` | Server-only SMTP provider and diagnostics |
| `lib/server/documents.ts` | `lib/server/documents/documents.ts` | Issuance, numbering, snapshots and document authorization |
| `lib/server/document-pdf.ts` | `lib/server/documents/document-pdf.ts` | Authorized document model assembly and PDF response |
| `lib/server/fx.ts` | `lib/server/payments/fx.ts` | Authoritative server-side exchange-rate service |
| `lib/server/media.ts` | `lib/server/media/media.ts` | Managed media validation, storage and metadata |
| `lib/server/upload-form.ts` | `lib/server/media/upload-form.ts` | Bounded multipart stream parsing |

Seven new moves in three batches. Direct files: components/ 16 → 16; lib/ 10 → 10; lib/server/ **23 → 16**. No barrel, wrapper, duplicate implementation or new abstraction was introduced. The new email/, documents/ and media/ groups each contain two related files. payments/ already existed; reusable PDF rendering stays in pdf/.

```text
Before: lib/server/
  email.ts, email-smtp.ts
  documents.ts, document-pdf.ts
  fx.ts
  media.ts, upload-form.ts
  payments/, pdf/, [other existing features and infrastructure]

After: lib/server/
  email/
    email.ts
    email-smtp.ts
  documents/
    documents.ts
    document-pdf.ts
  media/
    media.ts
    upload-form.ts
  payments/
    fx.ts
    payment-proofs.ts
  pdf/ [unchanged]
  [other existing features and infrastructure unchanged]
```

## Remaining direct files

| File under lib/server/ | Decision and reason |
| --- | --- |
| `auth.ts` | KEEP: central authentication/RBAC contract used across route families and services. |
| `auth-navigation.ts` | KEEP: shared authenticated-redirect boundary; retain with central auth in this batch. |
| `brand-settings.ts` | KEEP: root/public metadata, branding and settings integration shared across features. |
| `csrf.ts` | KEEP: central cookie-authenticated request protection. |
| `db.ts` | KEEP: sole Prisma singleton entry; stable operational and mocking contract. |
| `errors.ts` | KEEP: shared API error contract and sanitized response helpers. |
| `guards.ts` | KEEP: cross-feature route authorization entry with auth/preview dependencies. |
| `locale.ts` | KEEP: small global server locale boundary for root HTML and metadata. |
| `logging.ts` | KEEP: shared sanitized operational logging. |
| `payments.ts` | KEEP: central payment persistence/transaction entry, not the neutral client payment contract or proof module. No relocation required to group FX. |
| `rate-limit.ts` | KEEP: shared request/abuse protection across features. |
| `request-json.ts` | KEEP: shared bounded JSON reader, independent of multipart uploads. |
| `session.ts` | KEEP: central HttpOnly authentication session contract. |
| `settings.ts` | KEEP: mixed cross-feature public/secret settings and validation service. |
| `staff-preview.ts` | KEEP: shared staff impersonation/preview security boundary. |
| `users.ts` | KEEP: central user/role service shared by authentication, support and administration. |

These are retention decisions for this phase, not claims that future organization is impossible. Moving security entry points merely to reduce root counts adds no necessary benefit here.

## Preservation and verification

All static/dynamic imports, re-exports, mocks and exact source-reader references were updated where affected. Historical reports retain their original paths; the cumulative manifest records currentPath separately. Sixteen external operational source files were inspected for references to the seven original paths; no conflict was found and no operational script was executed or changed.

Storage still resolves from MEDIA_STORAGE_DIR or process.cwd()/storage/media; PDF logos still resolve under process.cwd()/public. No __dirname-relative asset contract is introduced. server-only markers, exports, SMTP lazy initialization, permissions, guest ownership, document numbering, SQL/query strings, transaction boundaries, query execution order and error behavior are preserved. The email-to-SMTP import remains a runtime dependency and SMTP-to-email remains type-only.

TypeScript passed after every batch. Focused checks: email/recovery/support 95 passed (7 files), documents/FX/settings 84 passed (5 files), media/upload routes 37 passed (4 files). Database-backed document integration tests remain excluded by the existing configuration; their import paths were updated without running them.

The complete default suite passed: **3,283 passed, zero failed, one skipped** across 243 passed test files and one skipped file (120.84 seconds). Tests used a process-only unreachable database URL, with database integration opt-ins disabled; no environment file was changed. SMTP transport is mocked, and filesystem tests use isolated temporary roots.

Static import inspection covered 947 files and 3,825 local references, including read-only Prisma-script references: no missing modules, filename-case mismatches, runtime dependency cycles or detected client/server leaks. The SMTP type-only backlink does not form a runtime cycle. This static graph is not a production bundler or end-to-end deployment test.

Preservation verification reconstructed 947 baseline source files byte-for-byte after reversing only approved import/reference literals. Sixty-nine source files changed only in those literals; all seven source moves are mapped and no existing baseline file was lost. All 343 live manifest digests match; all 336 historical relocation records preserve their original from/to and before/after digests. Sixty-five protected Prisma/configuration/dependency files, GTM fix 7993c03, Git HEAD and the staging index are unchanged. git diff --check passed.

No database connection, migration, Prisma change, environment/dependency/deployment configuration change, real email, booking or payment occurred. No production build was run because static generation can query the application database. Browser checks are prohibited by project instructions. Mocked/local filesystem tests are not evidence of live SMTP delivery, deployed media persistence or database integration. No staging, commit, push or deployment.
