# Trip Builder narrative HTML-v1

Only Overview, itinerary day/stop description and Itinerary Note support rich text. Titles, summaries, meals, highlights, checklists, pricing/booking labels, media, map names and SEO fields remain in their existing formats. There is no migration, automatic record conversion or new SEO owner.

## Storage and editing

The existing `detail` / `dayDetail` JSON strings in LONGTEXT carry optional `contentFormats`. On a detail object, only `overview` and `itineraryNote` are legal keys; on `itinerary[]` / `stops[]` rows, only `description` is legal. Each key maps `en`, `es` or `it` to `html-v1`. Arabic metadata and unknown fields/versions are rejected. Existing unmarked legacy Arabic content is retained, not enabled for editing.

```json
{
  "overview": ["<h3>Your visit</h3><p>Discover <strong>Giza</strong>.</p>"],
  "translations": { "es": { "overview": "<p>Descubre <strong>Guiza</strong>.</p>" } },
  "contentFormats": { "overview": { "en": "html-v1", "es": "html-v1" } }
}
```

A marked English overview array contains at most one entire HTML fragment. Newlines inside it are not paragraph separators at the serialization boundary. Other narrative values remain strings. Unmarked overview arrays retain their existing newline-based builder behavior. A string that looks like HTML but has no marker remains escaped plain text.

The reusable editor writes through parent state on document transactions, not on mount, step navigation, blur or language selection. Opening an old field does not convert it. A real edit converts only that field and locale. Empty markup becomes the existing empty-string/no-translation representation and its format marker is removed. Parent snapshots include metadata; successful saves rehydrate it. Translated row metadata travels with each row, not its displayed title or position.

The language tabs are unchanged. Editor instances are keyed by tour/field/row/locale; changing document resets local undo history but preserves content in parent state. Undo cannot restore another language's document. IME composition temporarily defers step/language switching and saving. A failed API save preserves parent state. Browser reload still loses unsaved changes: no new autosave is claimed.

`resolveNarrative` pairs text with its actual format, including English fallback. Public and preview display projections may temporarily place the resolved format in the canonical `en` slot of a copied object; these are **display-only values**, never persistence inputs. Explicitly cleared unsaved preview translations suppress fallback through the existing preview marker mechanism.

## Editor and paste

Tiptap is lazy-loaded only by the admin Trip Builder, with `immediatelyRender: false`. It supplies bold, italic, underline, paragraphs, H2/H3, bullet/number lists, links, left/center/right alignment, history and clear formatting. Other headings, code, tables, embeds, arbitrary styles and colors are not in the editing schema. The toolbar uses existing admin colors, native controls and Lucide icons. It wraps on narrow screens and keeps phone controls at 44px.

The alignment extension emits exact `sp-rich-align-left|center|right` classes rather than inline CSS. Hyperlinks are HTTPS or a site-root path; no credentials, protocol-relative URLs or unsafe schemes. Links open in the same tab and carry a fixed rel policy. The inline link controls do not submit the parent form.

Clipboard normalization keeps supported semantic text and finite alignment; converts simple Word `mso-list` paragraphs to real lists; converts supported Word span marks; discards scripts, embeds and external styling. Tables/complex layouts become readable text rather than imported layout. Nested complex Word numbering is not a pixel-faithful DOCX import. Oversize or too deeply nested input is rejected visibly, without replacing the current document or silently truncating it. An empty/unsupported clipboard does not delete the current selection.

## Security and validation

`lib/tour-rich-text.ts` is the shared policy boundary. API POST/PUT bound the streamed request to 1 MiB before parsing. Per-rich-field/per-locale limit: 64 KiB UTF-8, depth <=8, <=2,000 parsed nodes. Normalized size is checked too. Current prepared 26-tour package: maximum string 634 bytes, maximum serialized record 10,970 bytes; the new limits preserve all 26 unchanged in an offline test.

Server writes reject executable tags/event attributes and unsafe anchors, sanitize supported markup, and validate format paths/locales/value shapes. Status-only publication checks merged stored content. The same sanitizer runs at the rendering boundary to protect against API-bypassing imports. Client paste cleanup and a ProseMirror transaction guard are usability protections, not substitutes for the server.

Allowed tags: p, br, strong, em, u, h2, h3, ul, ol, li, a. No arbitrary style/class/id/data attributes, events, SVG, MathML, scripts, iframes, media or forms. Only exact alignment classes on paragraph/headings and safe anchor attributes survive. Normalization is deterministic/idempotent. Sanitizer failure never falls through to unsanitized HTML: the renderer uses escaped text, and plain-text exports/JSON-LD omit invalid marked fragments rather than leaking their tags.

One `TourRichText` component serves the public one-day/other templates and unsaved preview. Its plain branch retains the existing paragraph output; its rich branch uses block containers, safe typography and wrapping. Public pages do not import Tiptap. `richTextPlain` derives decoded readable text for itinerary download and JSON-LD (including day-tour stops). Summary stays plain and SEO Manager retains metadata ownership. Existing `preserveRecordSeo` and revision checks remain in place.

## Release, verification and rollback

No database record was changed during implementation. Tests use actual serialization helpers and handler functions with mocked persistence, not the application's database. Browser/device testing remains unperformed under project restrictions. Use the separate implementation report for commands/results, dependency versions and pre-existing dependency advisories.

Release compatible readers everywhere before permitting rich authoring. Refresh workers/caches and require staff to reload the builder; do not leave plain-only readers serving newly marked records. This local implementation includes reader and writer code together; an operational reader-first rollout must control staff access until the compatible release is complete. No deployment is authorized by implementation approval.

Runtime requirement for the installed sanitizer: Node >=22.12.0 (verified locally on 24.13.0); verify the eventual hosting runtime before release. Do not solve that by silently installing an older vulnerable sanitizer.

Before any marked data exists, rollback is code/dependency-only. After marked content exists, first disable authoring while keeping compatible readers. A plain-only rollback would expose tags; converting or restoring records requires separately approved backed-up data operations. Keep a reader for every stored format version. No reset/seed or automatic conversion is a rollback strategy.

Future Translation Manager integrations must translate text nodes while preserving supported structure and safe href values, then sanitize/validate under this same policy. They must retain the existing locale keys and field identity and must not treat formatted HTML as an unstructured plain string.

## Manual verification checklist (not executed)

Use unsaved preview for the non-persistence checks. Only use a separately approved isolated test database for Save/Reopen/Publish checks; never experiment with existing production records.

1. Open an existing plain tour in each category. Opening/focusing fields must not dirty it or show tags. Plain summaries, facts, checklists, meals, booking totals and media retain their appearance.
2. Exercise all toolbar controls and keyboard navigation, paragraph/H2/H3 selection, link add/remove and clear formatting. Check selection retention when opening the link controls. Verify disabled/busy behavior.
3. Type separate EN/ES/IT values; switch languages and steps immediately, including IME input. Return to each document; no characters or rows should be lost. Confirm language-specific undo boundaries are understandable.
4. Add/remove itinerary rows and check that each description keeps its own text/format. Change unrelated fields without reformatting narrative fields.
5. Paste actual Word and website examples: paragraphs, marks, lists, safe links and alignment; also complex tables/Office numbering. Check the readable fallback and clear rejection of oversized content. Ensure a rejected/unsupported paste leaves existing text selected/intact.
6. Compare live/full preview and actual detail for each locale/category at 360/390px phone, tablet, desktop and a short-height window. Check lists, heading hierarchy, long links, accordion bodies, shield note, toolbar wrapping/focus and vertical scrolling. Use mobile keyboard and screen-reader checks manually.
7. On an approved test DB only, Save Draft with HTML; reopen/edit/save again. Check raw JSON markers, translations and reserved SEO; test stale-revision rejection and an API failure without losing entered text.
8. On an approved test DB only, verify draft invisibility and publication gates/permissions, then explicitly approved test publication. Compare metadata/JSON-LD and itinerary text download: no HTML tags in text fields/exports. Verify old and new records side by side.
9. Use test fixtures for malicious HTML/URL cases; no scripts, arbitrary styles or remote embeds should appear even when bypassing the API. Do not inject malicious content into production to test this.
10. Verify the deployed Node version, compatible-reader rollout, clean dependency assessment and the rollback plan before enabling author access.
