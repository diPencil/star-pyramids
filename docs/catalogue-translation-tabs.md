# Catalogue translation tabs

The destination, multi-day category, event, offer, story and vehicle editors
use the existing Trip Builder tab appearance with Base UI keyboard semantics.
Each editable content board has its own EN/ES/IT selection. Arabic inputs are
dormant; their stored values remain in the canonical payload. Shared images,
URLs, slugs, dates, prices, capacities, publication flags and relationships
remain single controls, independent of the selected content language.

Translations contain manual text only. Missing translations fall back to
English on public catalogue surfaces. Admin catalogue hooks always return
canonical English records, regardless of visitor language. The six public
catalogues, details and their homepage consumers use the translated client
hooks. Existing rich story bodies are preserved; this task does not add a new
article-body editor or automatic translation. Trip Builder's separate manual
translation maps are not changed by this feature.

## Persistence

Migration `20261009150000_catalogue_translations` adds one table, keyed by entity
type and canonical slug. It does not modify existing catalogue rows. The existing
authorized API mutations save the record and translation payload in a single
Prisma transaction. Updates omitting translations preserve them; explicit empty
maps clear them. Renaming moves the translation identity, intentional owner
deletion removes its translation row atomically, and fresh creation cannot inherit
an old payload. SQL identifiers are fixed and values are parameterized.

The repository uses parameterized raw queries through the existing Prisma client
for this small table; the new generated delegate is not required at runtime.
No dependency installation or Prisma engine regeneration is necessary.

English owns repeatable event structure. Add/remove actions are available in the
English tab; other tabs edit corresponding text. Removing rows shifts translation
keys in every locale. Saving rejects translated rows with incomplete canonical
English instead of silently dropping their text. Blank untranslatable rows are
filtered with matching translation reindexing. Event date strings remain canonical
because existing date/status logic may parse them.

## Verification

- TypeScript and production build must be checked separately.
- `tests/catalogue-translations.test.ts`: text allowlists, bounds, fallback,
  shared-value protection, lists and repeatable deletion/save alignment.
- `tests/catalogue-language.test.ts`: public locale overlays, canonical admin
  isolation, fallback, tab markup and a single shared control.
- Existing `tests/tour-translations.test.ts` remains a regression check.
- `node --conditions=react-server --import tsx scripts/verify-catalogue-translations.mjs`:
  36 MySQL scenarios across six kinds. All transactions roll back deliberately;
  no canonical records are written and no test rows remain.
- Unauthenticated API reads and mutations can be checked without owner data writes.

Browser connector currently reports `Transport closed`. Visual desktop/mobile,
keyboard interaction and authenticated save/reopen QA remain owner acceptance
checks. Server rendering and transaction tests do not substitute for browser QA.
