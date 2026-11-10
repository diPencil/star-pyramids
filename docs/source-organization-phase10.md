# Pure utility and payment-contract ownership — Phase 10

Four modules moved into existing core/ and payments/ directories. Every moved file retains identical original bytes. Only consumer import/reference paths change. No new folders, wrappers, barrels, declarations or business logic. lib/ direct files: **14 → 10**, including README; components/ stays 16 and lib/server/ stays 23.

| Original | Destination |
| --- | --- |
| `lib/phone.ts` | `lib/core/phone.ts` |
| `lib/date-calendar.ts` | `lib/core/date-calendar.ts` |
| `lib/currency.ts` | `lib/payments/currency.ts` |
| `lib/payment.ts` | `lib/payments/payment.ts` |

## JSON preservation decision

The attempted JSON-helper move was caught by TypeScript: prisma/import-blogs.ts:7 still imports ../lib/json-text. That directory is protected by task scope. The helper was moved back and all affected references (including three external scripts) restored exactly. No Prisma file was changed, no compatibility wrapper was added, and no source or data was lost. lib/json-text.ts remains byte-identical at its original path. The temporary diagnostic is resolved; final TypeScript checks pass.

## Retained financial boundaries

The moved payment/currency files are neutral client/server contracts, not payment persistence. lib/server/payments.ts stays at its established service entry. Decimal arithmetic, status transitions, currency validation/formatting, transaction boundaries, ownership/RBAC and gateway behavior retain their existing definitions and call order. No payment, booking, email or database operation was invoked.

## Remaining direct root files: KEEP

| File under lib/ | Reason |
| --- | --- |
| `admin-store.ts` | Mixed public/admin settings, brand, catalogue and preview facade; splitting is outside move-only scope. |
| `auth-types.ts` | Established client/server authentication contract. |
| `brand-settings.ts` | Global brand defaults and validation shared by public/admin/bootstrap. |
| `documents.ts` | Stable commercial-document contract shared by booking UI and financial/document services. |
| `json-text.ts` | Protected Prisma import script consumes ../lib/json-text; external symbol readers also use this path. Preserve original path and bytes. |
| `query.ts` | Cross-feature query parsing entry spanning catalogue, forms and search. |
| `README.md` | Directory ownership guide. |
| `staff-preview-client.ts` | Shared security/preview integration; existing public entry stays stable. |
| `use-current-user.ts` | Shared authenticated-user hook spanning public/account/admin. |
| `utils.ts` | cn primitive pinned by components.json alias; no configuration changes permitted. |

## Verification

Final core batch: TypeScript and 159 focused tests passed; financial batch: TypeScript and 145 focused tests passed. The complete suite passed: **3,283 passed, 0 failed, 1 skipped** across 243 passed test files and one skipped file (125.45 seconds).

Import inspection covered 943 files and 3,851 local references, including read-only Prisma-script references: no missing modules, case errors, runtime cycles or detected client/server leaks. Source reconstruction checked 947 existing source files; 55 changed only in approved reference literals. All four moved modules retain their exact original bytes. All 336 live relocation-manifest digests match. Sixty protected Prisma/configuration/dependency files, three external tools, the JSON helper, Git HEAD/index and GTM fix 7993c03 are unchanged. git diff --check passed. Static checks and mocked tests do not verify deployed UI or operational persistence.

The previously noted randomized confirmation-tamper assertion is not modified by this phase. No database, migrations, Prisma/configuration/environment/dependency changes, operational scripts, production build, browser checks, staging, commit, push or deployment.
