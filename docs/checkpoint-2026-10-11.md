# Local development checkpoint: 2026-10-11

This checkpoint preserves the current implementation before further repairs.
The owner explicitly requested committing and pushing to main as a reference
backup, with automatic deployment disabled. This is not a release or a claim
that every feature is complete.

## Verification at checkpoint

- Full Vitest suite: 265 tests passed in 21 files.
- TypeScript check passed; latest production build passed.
- Prisma schema validation passed; all 33 migrations applied locally.
- Latest local HTTP checks returned 200 for contact, special offers, tour detail,
  the Trip Builder route and both tours/offers APIs; both API responses were
  valid JSON. The earlier stale Prisma runtime HTTP 500 was no longer reproduced
  after the development server process changed.
- Local database read confirmed 59 tours and 3 offers. No owner data changed by
  the checkpoint operation. Git does not back up MySQL or ignored uploaded media.

## Known outstanding work

1. Tour JSON fields are stored as LONGTEXT. Read paths currently leave several
   fields as JSON strings while consumers assume objects/arrays. Correct the
   API and shared mapper boundaries before relying on full edit/reopen behavior.
2. Tour create/update paths pass some object/array values directly into those
   text columns. Correct serialization and verify the save lifecycle safely.
3. Trip Builder language tabs have been restored and switching languages/steps
   was browser-tested without saving owner records. Storefront consumers still
   need complete support for the new manual Spanish/Italian translation maps.
4. Some tour requests parse responses as JSON without handling empty/non-JSON
   error bodies. Add safe error handling.
5. Complete authenticated end-to-end save/reopen and linked offer booking QA
   after those repairs. Passing unit tests/build does not establish that QA.

Historical reports describe their own earlier verification state; this document
records the current checkpoint limitations.

## Files deliberately left local

Environment files and uploaded storage remain ignored. Untracked Lighthouse
outputs, TypeScript output text, duplicate backup files, VERIFICATION_REPORT.txt
and ad hoc test-apis.js/test-runtime.js are excluded from the checkpoint without
being deleted. Source, migrations, automated tests and implementation docs are
included.
