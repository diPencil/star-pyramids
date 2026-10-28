# Destination Builder & Public Page Parity — Verification

## 1. Actual public page section inventory

Reference: `components/extended-pages.tsx`, DestinationDetailView, extracted directly from the existing detail renderer. No public destination-detail redesign.

Public order is Hero → Facts → Destination story → Experiences → Journey rhythm → Practical information → Related tours → Planning CTA. Hero and facts are fixed at the top. The six existing optional presentation sections use PresentationSection/PresentationOrder and the published destination-detail template. Related tours additionally require at least one eligible published tour. The directory hero/card follow-up from the previous task remains intact.

The existing detail page has images, not a video field. No video, per-record section visibility, icon selection, booking form, or additional record section was invented.

## 2. Public-to-admin field mapping

| Public area | Record fields | Builder controls | Other source, order, visibility and fallback |
| --- | --- | --- | --- |
| Hero | title, copy, detail.heroImage, heroAlt, eyebrow | Hero group: translated name, summary, eyebrow, alt; existing ImageField upload/URL/remove | Name/copy also drive directory cards. Missing legacy media is normalized on read; explicit empty media is not replaced. Hero actions/labels use the existing shared destination-story template. |
| Facts at a glance | detail.facts[].label/value | Add/edit/remove/up/down, EN/ES/IT fields | Positional icons remain fixed existing design; array order is rendered order. An empty list stays empty. |
| Destination story | detail.intro, detail.bestFor[] | Translated introduction, repeatable audience/interest items | Shared headings and supporting paragraph remain CMS template-owned. Story visibility/order remain template-owned. |
| Signature experiences | detail.experiences[].title/copy/image/alt | Add/edit/remove/up/down, translated text, per-item secure ImageField | First item remains the original featured visual; no new layout flag. Blank image is not rendered. |
| Journey rhythm | detail.rhythm[].label/title/copy; detail.heroImage | Add/edit/remove/up/down and translated text | Reuses the hero image as on the actual public page. Section labels/visibility/order remain template-owned. |
| Practical information | detail.practical[].title/copy | Add/edit/remove/up/down and translated text | Existing shared headings and section visibility/order remain CMS-owned. |
| Related tours | detail.tourSlugs; Tour.destinationSlug | Editorial canonical-slug selections with resolved titles/status; authorized existing one-day-tour association controls | Public union is published, canonicalized, deduplicated. The original association transactions/locks and permission checks are preserved. |
| Planning CTA | image and title | Separate cover/CTA ImageField with replacement/removal | Same cover is used by directory cards. Shared CTA text/link/visibility/order belongs to Website CMS → Destination template. |
| SEO | Existing reserved destination record SEO and catalogue localization | Link to existing per-record SEO editor; available after first save | No competing SEO fields. Existing metadata/canonical/OG rules remain authoritative and protected by the API. |
| Publishing/discovery | isPublished, showInDestinations, showInOneDayTours, displayOrder | Existing independent toggles and integer ordering field | Full directory shows all published destinations per the owner's latest decision. Curated/homepage and one-day discovery retain their separate flags. Flags never detach tours. |

Ordinary missing locale text falls back to the existing English content. Existing legacy title/copy translation behavior is retained. A more specific detail translation wins over a broad legacy alias.

## 3. Missing fields/controls discovered

The old editor grouped content generically, exposed existing repeatable rows without structural controls, omitted experience image editing, duplicated the first fact as a suggested-stay field, treated audience tags as an unrelated multiline field, and had no unsaved public-style preview. New destinations could not construct most of the rich sections. Truthy defaults on create could differ from intentionally cleared form values. The raw editorial tour slug input lacked resolved review context.

## 4. Implemented builder changes

One shared create/edit builder now follows the real public content order, with numbered section groups and the existing STAR PYRAMIDS Card/form/toast/media controls. All five actual repeatable arrays support add/remove/up/down. Text fields expose EN/ES/IT through existing ContentLanguageTabs. Structural array changes are managed in English so the canonical row structure stays consistent across locales. Media is shared across languages.

The duplicated suggested-stay control was removed: administrators now edit its actual fact label/value in place. The old audience alias is represented as translated indexed audience items. Cover/CTA and hero media are grouped by their actual roles; experience cards each expose their own image.

Slug, publishing, catalogue placement, tour associations and SEO remain separate administrative settings. Empty lists stay empty. Existing unmodeled detail fields are retained through object spreads and the existing normalization/save contract. No Prisma/schema/API architecture change or migration was needed.

The underlying public body and TourCard presentation were shared without changing public content or appearance. Active public favorites/share behavior remains in the original wrapper; previews use the same presentation with disabled actions and no account hooks.

## 5. Live preview architecture

DestinationBuilderPreview projects current React form state through destinationPreview; no save or preview API is called. It uses the same DestinationDetailView as the public route. Opening is explicitly labeled “Unsaved destination preview / Read-only current form”. Draft records can be previewed without changing their publication flag.

A Base UI modal provides focus/close behavior and EN/ES/IT plus desktop/mobile-width controls. A same-origin sandboxed iframe creates an actual independent responsive viewport (390px mobile, available-width desktop). Its document contains no scripts. Existing project CSS/font classes are copied from the owner document; current data is rendered through a React portal, never interpolated into srcDoc HTML. Live changes remain a projection of the form.

Published presentation context crosses the portal, preserving current shared CMS headings/section visibility/order. A separate read-only published Appearance context exposes the already-server-read published tokens to preview even on an admin route; no new request, draft exposure or styling of admin pages occurs. Validated appearanceCss is scoped inside the public preview wrapper.

The iframe content is inert/read-only. SiteShell, chat/provider integrations, booking, customer favorites hooks and catalogue-fetch hooks are not mounted. Related cards share the actual public card presentation, including gallery, labels, prices and duration, with disabled account/share actions. Preview locale providers skip persistent preference effects/cookie changes. Image/CSS retrieval still uses normal browser GETs; it is not an offline renderer.

## 6. Create/edit behavior

Both routes use the same state projection and section components. Identity resolution finishes before editor initialization, avoiding an empty create form being mistaken for an edit record. Edit records retain private revision, content, flags and original media; empty new records initialize with empty lists, with no invented fact or truthy image/introduction default.

Saving sends the current detail object directly, with the original optimistic expectedUpdatedAt token. Explicit blank images/introduction and removed arrays are not restored. Normal server trimming/validation remains in place. The current publication checkbox determines save behavior; preview never changes it. Reopening is covered by actual API handlers backed by isolated in-memory storage.

## 7. Media and translation handling

All actual destination record images are controllable: hero (also rhythm), cover (also CTA/card), and each experience image. ImageField retains existing secure upload/selection/replacement/removal logic and media scope. Upload activity is tracked by field, and save/structural edits are disabled while uploads run. No existing uploads or storage configuration were changed.

Preview media uses the existing project image allowlist. Invalid unsaved URLs are omitted from the preview; server validation rejects them on save. Empty media areas do not create broken src placeholders. No real upload was performed during this task.

Legacy stay/bestFor aliases are projected into the existing corresponding indexed text rows. Specific nested translations are retained. Removing/reordering rows reindexes every enabled locale with the same operation, and stale out-of-range keys are pruned before adding a new row. This prevents a previously removed item's translation from reappearing on a newly added row. Nested detail.bestFor.N is now an allowlisted text key; media, identity, amounts and flags remain non-translatable. Arabic remains disabled. No demo translations were authored or written.

## 8. Save/publish integrity

Existing destination RBAC, same-origin protection, validation, duplicate-slug handling, optimistic revision checks, reserved SEO protection and atomic translation persistence remain intact. The previous destination/tour SELECT ... FOR UPDATE protections are unchanged. Editorial references are displayed with canonical resolution and publication/unavailable information. Existing one-day associations are saved as explicit transaction deltas; published tours cannot be silently detached from a required destination. Listing flags do not change associations.

Read-only preview projects pending associations onto a copy of loaded tours, then filters/deduplicates with the public destinationTours selector. No mutation occurs on open, locale change, resizing or rendering. Staff without tour-view/edit rights do not gain those rights through preview; unavailable tour records are not fabricated.

## 9. Files changed for this task

- app/admin/destinations/new/page.tsx — same create/edit lifecycle, grouped editor, projection and preview integration.
- components/admin/destination-sections-editor.tsx (new) — actual field/row/media controls.
- components/admin/destination-builder-preview.tsx (new) — isolated unsaved public-style preview.
- components/admin/destination-builder.css (new) — scoped admin controls/modal/frame styles.
- lib/destination-builder.ts (new) — field inventory, aligned row operations and safe preview projection.
- lib/catalogue-translations.ts — supported indexed audience text and orphan-index guard.
- components/extended-pages.tsx — shared DestinationDetailView with unchanged public page body.
- components/site.tsx — shared passive TourCardPresentation; active wrapper behavior retained.
- components/public-appearance.tsx — read-only published-token context for preview, without private-page styling.
- tests/destination-builder-parity.test.ts (new) — projection, parity, controls, locale, media and passive safety.
- tests/destination-write-crud.test.ts — full builder save/reopen/reorder/remove regression through mocked real handlers.
- DESTINATION_BUILDER_PARITY_VERIFICATION.md — this report.

Earlier uncommitted directory/hero/card follow-up changes and unrelated AGENTS/skill/scratch files were preserved. No staging, commit, push or cleanup occurred.

## 10. Tests and build results

- pnpm typecheck: passed.
- pnpm exec prisma validate: passed; no schema change.
- Relevant builder/create-edit tests: passed (including actual handlers with in-memory persistence).
- Full available safe suite: 143 files, 1842 tests passed.
- Targeted shared preview/appearance/public rendering checks: 127 tests passed across 3 matching files.
- pnpm build: blocked before Next by Windows EPERM while renaming the existing Prisma query_engine-windows.dll.node. No generated binary was deleted and no process was stopped.
- pnpm exec next build --webpack using the existing generated Prisma Client: passed, including TypeScript and 282/282 generated pages.
- git diff --check: passed.

Nine database-writing suites remain excluded by the existing safe configuration: eight documents suites (commercial-access, commercial-issuance, commercial-pdf, document-access, document-issuance, document-lists, document-numbering, pdf-download) and payment-proofs-concurrency. None was enabled. All persistence/moderation/concurrency test data in this task was mocked/in-memory.

Independent read-only review found and then confirmed resolution of the preview Appearance and simplified-related-card gaps. No additional substantive defect was reported in that review.

## 11. Remaining limitations

No browser tests or automation were performed, as requested. Real admin click/upload/save flows, iframe responsiveness/focus across target browsers and visual fidelity remain manual acceptance work. No real database records were created/edited/deleted by verification. No production operation, migration, reset, seed, environment edit, media deletion or deployment occurred.

Regenerating Prisma still requires the local DLL to be released by its owner before the standard pnpm build can finish. Existing-client Next compilation succeeded. No unnecessary permissions/process workaround was applied.

Template section visibility/order, shared CTA text, and SEO intentionally remain in their original editors rather than introducing competing per-destination fields. Preview uses published shared configuration, not unpublished drafts from separate CMS editors. Real media upload permissions/storage reachability and browser screenshot parity are not claimed verified.

## 12. Manual acceptance checklist

1. Open create and existing edit pages; check Hero → Facts → Story → Experiences → Rhythm → Practical → Related trips → CTA grouping.
2. Add/edit/remove/reorder each repeatable list in English. Translate ES/IT fields; move/remove the English item and confirm translations follow it.
3. Upload/select/replace/clear hero, cover and experience images. Confirm save is disabled during upload and cleared media does not return.
4. Open unsaved preview before saving; switch EN/ES/IT and desktop/mobile widths. Confirm unsaved text/media/items and current published Appearance/template settings match.
5. Confirm preview cannot navigate, favorite, share, book, save or publish; close via the dialog controls/Escape and verify focus returns.
6. Save an intentionally approved test record and reopen it; verify empty fields and removed rows remain empty. Do not use existing business records for destructive test steps.
7. Confirm editorial/assigned related tours resolve canonically and only published tours appear. Test authorized association deltas; published-tour detach protection must remain.
8. Check independent publish/curated/one-day flags, duplicate slug feedback, stale-save conflict, restricted roles and invalid media errors.
9. Use the linked CMS template and SEO editors for their shared fields; verify those changes through the existing draft/publish flow.
10. After the local Prisma DLL is released, rerun pnpm build. No commit/push/deploy is included in this task.
