import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { sanitizeTourHtml, safeRichLink, normalizeTourPaste, normalizeTourRichText, richTextPlain, writeNarrative, resolveNarrative, overviewFromEditor, overviewToEditor, legacyEditorHtml, readTourWriteRequest, RICH_LIMITS, type RichOwner } from '@/lib/tours/tour-rich-text'
import { encodeTourJson, decodeTourJson } from '@/lib/tours/tour-json'
import { validateTourWrite, validateTourPublication } from '@/lib/tours/tour-write'
import { localizePublicTour } from '@/lib/tours/tour-public-locale'
import { buildTripPreview } from '@/lib/trip-builder/trip-builder-preview'
import { editorData } from '@/components/admin/trip-builder'
import { generateTouristTripJsonLd } from '@/lib/seo/structured-data'
import type { Tour } from '@/data/types'

export const richFixture = (): Tour => ({ slug: 'rich-trip', title: 'Plain title', category: 'one-day-tours', location: 'Cairo', duration: 'Full day', image: '/fixture.jpg', gallery: ['/fixture.jpg'], summary: 'Plain summary', price: 1, destinationSlug: 'cairo', status: 'draft',
  dayDetail: { overview: ['<h2>English heading</h2><p><strong>English</strong> visit.</p>\n<ul><li>A</li><li>B</li></ul>'], itineraryNote: '<p><u>Confirm the route</u>.</p>',
    contentFormats: { overview: { en: 'html-v1', es: 'html-v1' }, itineraryNote: { en: 'html-v1' } },
    translations: { es: { overview: '<p><em>Visita española</em>.</p>', itineraryNote: 'Nota sin formato' }, it: { overview: 'Panoramica semplice' } },
    stops: [{ day: 'Stop 1', title: 'Plain stop', description: '<p>Description &amp; details.</p>', meals: 'Lunch', contentFormats: { description: { en: 'html-v1', it: 'html-v1' } }, translations: { es: { description: 'Descripción simple' }, it: { description: '<p><strong>Descrizione italiana</strong>.</p>' } } }],
    included: ['Lunch'], excluded: [], travelerPrices: [{ travelers: 1, adultPrice: 1, childPrice: 1, infantPrice: 1 }] } })

describe('HTML-v1 trust boundary', () => {
  it.each(['javascript:alert(1)', 'jav&#x61;script:alert(1)', 'data:text/html,bad', '//evil.test', '/%2fevil.test', '/\\evil', 'https://user:pass@evil.test', 'https:%0a//evil.test', 'file:///x', 'http://old.test'])('rejects unsafe href %s', href => {
    expect(() => sanitizeTourHtml(`<p><a href="${href}">Link</a></p>`, true)).toThrow()
    expect(sanitizeTourHtml(`<p><a href="${href}">Link</a></p>`)).not.toContain('href=')
  })
  it.each(['https://example.test/path?q=yes&x=1', '/egypt-tours/test', '/#reviews'])('accepts safe links %s', url => expect(safeRichLink(url)).toBe(true))
  it.each(['<script>alert(1)</script>', '<p onclick="x()">X</p>', '<svg><a onload="x()"/></svg>', '<iframe srcdoc="bad"></iframe>', '<p contenteditable="true">x</p>'])('rejects executable source on writes: %s', html => {
    expect(() => sanitizeTourHtml(html, true)).toThrow()
    expect(sanitizeTourHtml(html)).not.toMatch(/script|onclick|onload|iframe|svg|contenteditable/)
  })
  it('keeps only the approved marks, blocks, alignment classes and safe links deterministically', () => {
    const safe = sanitizeTourHtml('<h1>Title</h1><p id="x" style="color:red" class="evil sp-rich-align-center"><b>B</b><i>I</i><u>U</u><a target="_blank" href="https://example.test">link</a></p><img src="x"><h3>H3</h3><ol><li>One</li></ol>')
    expect(safe).toContain('<strong>B</strong><em>I</em><u>U</u>')
    expect(safe).toContain('class="sp-rich-align-center"')
    expect(safe).not.toMatch(/style=|id=|evil|target=|<h1|<img/)
    expect(sanitizeTourHtml(safe)).toBe(safe)
  })
  it('rejects byte, node and nesting excess without truncation', () => {
    expect(() => sanitizeTourHtml('é'.repeat(32769))).toThrow('64 KiB')
    expect(() => sanitizeTourHtml('<ul><li>'.repeat(5) + 'x' + '</li></ul>'.repeat(5))).toThrow('nesting')
    expect(() => sanitizeTourHtml('<br>'.repeat(2001))).toThrow('nodes')
  })
  it.each([
    { contentFormats: { summary: { en: 'html-v1' } } },
    { dayDetail: { overview: ['x'], contentFormats: { summary: { en: 'html-v1' } } } },
    { dayDetail: { overview: ['x'], contentFormats: { overview: { ar: 'html-v1' } } } },
    { dayDetail: { overview: ['x'], contentFormats: { overview: { en: 'html-v2' } } } },
    { dayDetail: { overview: ['x', 'y'], contentFormats: { overview: { en: 'html-v1' } } } },
    { dayDetail: { included: [{ contentFormats: {} }] } },
    { dayDetail: { overview: ['x'], contentFormats: { overview: { es: 'html-v1' } }, translations: { es: { overview: 3 } } } },
  ])('rejects unknown metadata paths/locales/versions/types', payload => expect(() => normalizeTourRichText(payload)).toThrow())
  it('bounds streamed requests before parsing and rejects invalid JSON shapes', async () => {
    await expect(readTourWriteRequest(new Request('https://example.test', { method: 'POST', body: 'x'.repeat(RICH_LIMITS.requestBytes + 1) }))).rejects.toThrow('1 MiB')
    await expect(readTourWriteRequest(new Request('https://example.test', { method: 'POST', body: '[]' }))).rejects.toThrow('JSON')
  })
})

describe('semantic clipboard normalization', () => {
  it('retains inline spaces, marks and approved alignment while stripping Word styles', () => {
    const result = normalizeTourPaste('<p style="text-align:center;color:red"><strong>One</strong> <em>two</em> <span style="font-weight:bold;text-decoration:underline">three</span></p>')
    expect(result).toContain('<strong>One</strong> <em>two</em> ')
    expect(result).toContain('<u><strong>three</strong></u>')
    expect(result).toContain('class="sp-rich-align-center"')
    expect(result).not.toContain('style=')
  })
  it('turns Word list paragraphs into semantic lists without duplicate marker text', () => {
    const result = normalizeTourPaste('<p style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">1. </span>Giza</p>\n<p style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">2. </span>Cairo</p>')
    expect(result).toBe('<ol><li>Giza</li><li>Cairo</li></ol>')
    expect(richTextPlain(result, 'html-v1')).toBe('1. Giza\n2. Cairo')
  })
  it('removes clipboard executable content/unsafe links and preserves table text without embeds', () => {
    const result = normalizeTourPaste('<script>bad()</script><table><tr><td>Cairo</td><td>Giza</td></tr></table><iframe src="https://evil.test"></iframe><a href="javascript:bad()">Read</a>')
    expect(result).not.toMatch(/script|table|iframe|href/)
    expect(richTextPlain(result, 'html-v1')).toContain('Cairo')
    expect(richTextPlain(result, 'html-v1')).toContain('Giza')
    expect(result).toContain('Read')
  })
})

describe('plain/rich and locale serialization', () => {
  it('keeps every existing prepared tour and its text format unchanged under the new contract', () => {
    const rows = JSON.parse(readFileSync('../REAL_TOURS_IMPORT_PACKAGE/all-26-tours.json', 'utf8')) as Tour[]
    expect(rows).toHaveLength(26)
    for (const row of rows) {
      const before = JSON.stringify(row)
      expect(normalizeTourRichText(row)).toEqual(row)
      expect(JSON.stringify(row)).toBe(before)
      expect(() => validateTourWrite(row)).not.toThrow()
    }
  })
  it('leaves unmarked HTML-looking legacy strings and empty arrays untouched', () => {
    const source = { dayDetail: { overview: ['Use <b> literally', 'Second\nline'], included: [], stops: [{ title: 'X', description: '<p>literal</p>' }] } }
    expect(normalizeTourRichText(source)).toEqual(source)
    expect(legacyEditorHtml('Use <b> literally')).toBe('<p>Use &lt;b&gt; literally</p>')
    expect(richTextPlain('<p>literal</p>', undefined)).toBe('<p>literal</p>')
  })
  it('isolates locale edits, clears empty markup and leaves untouched canonical text plain', () => {
    const original: RichOwner & { overview: string; price: number } = { overview: 'Original', price: 15 }
    const es = writeNarrative(original, 'overview', '<p><strong>Español</strong></p>', 'es')
    const it = writeNarrative(es, 'overview', '<p><u>Italiano</u></p>', 'it')
    expect(it.overview).toBe('Original'); expect(it.price).toBe(15)
    expect(it.translations?.es?.overview).toContain('Español')
    expect(it.translations?.it?.overview).toContain('Italiano')
    expect(resolveNarrative(it, 'overview', it.overview, 'es').format).toBe('html-v1')
    expect(writeNarrative(es, 'overview', '<p><br></p>', 'es')).toEqual(original)
    expect(original.contentFormats).toBeUndefined()
  })
  it.each(['en', 'es', 'it'] as const)('round-trips %s marked overview without newline damage and matches preview/public fallbacks', locale => {
    const source = richFixture(), encoded = encodeTourJson(normalizeTourRichText(source))
    const reopened = decodeTourJson(encoded) as unknown as Tour
    const loaded = editorData(reopened), draft = { ...loaded, catSlugs: loaded.categorySlugs }
    expect(overviewToEditor(reopened.dayDetail!.overview, reopened.dayDetail!)).toBe(source.dayDetail!.overview[0])
    expect(overviewFromEditor(loaded.form.overview, loaded.form)).toEqual(source.dayDetail!.overview)
    const actual = localizePublicTour(reopened, locale).dayDetail!
    const preview = buildTripPreview(reopened, draft, locale).tour.dayDetail!
    expect(preview.overview).toEqual(actual.overview)
    expect(preview.contentFormats?.overview?.en).toEqual(actual.contentFormats?.overview?.en)
    expect(preview.stops?.[0].description).toEqual(actual.stops?.[0].description)
    expect(preview.stops?.[0].contentFormats?.description?.en).toEqual(actual.stops?.[0].contentFormats?.description?.en)
    expect(JSON.stringify(source)).toBe(JSON.stringify(richFixture()))
  })
  it('falls back with the English format but never interprets a plain translated string as HTML', () => {
    const source = richFixture()
    const it = localizePublicTour(source, 'it').dayDetail!
    expect(it.contentFormats?.overview?.en).toBeUndefined()
    const es = localizePublicTour(source, 'es').dayDetail!
    expect(es.contentFormats?.itineraryNote?.en).toBeUndefined()
    expect(es.stops?.[0].contentFormats?.description?.en).toBeUndefined()
    delete source.dayDetail!.translations!.es!.overview
    expect(localizePublicTour(source, 'es').dayDetail!.contentFormats?.overview?.en).toBe('html-v1')
  })
  it('keeps metadata with stable rows through editing, reordering and deletion', () => {
    const loaded = editorData(richFixture())
    const row = loaded.itinerary[0]
    const second = { ...row, id: 'second', title: 'Second', description: 'Plain', contentFormats: undefined, translations: undefined }
    const updated = [second, writeNarrative(row, 'description', '<p><u>Updated</u></p>', 'it')]
    expect(updated[1].id).toBe(row.id)
    expect(updated[1].translations?.it?.description).toContain('Updated')
    expect(updated.filter(item => item.id !== row.id)).toEqual([second])
  })
  it('normalizes empty marked documents and validates content at status-only publication boundaries', () => {
    const source = richFixture()
    source.dayDetail!.overview = ['<p>&nbsp;<br></p>']
    const normalized = normalizeTourRichText(source)
    expect(normalized.dayDetail!.overview).toEqual([])
    expect(normalized.dayDetail!.contentFormats?.overview?.en).toBeUndefined()
    const bad = richFixture(); bad.dayDetail!.stops![0].description = '<script>bad()</script>'
    expect(() => validateTourWrite(bad)).toThrow('Executable')
    expect(() => validateTourPublication({ ...bad, status: 'published' })).toThrow('Executable')
  })
  it('exports decoded readable text and JSON-LD without tags, preserving plain metadata', () => {
    const source = richFixture(), stop = source.dayDetail!.stops![0]
    source.category = 'multi-days-tours'; source.detail = { overview: [], highlights: [], itinerary: [{ ...stop, day: 'Day 1' }], locations: [] }
    expect(richTextPlain(stop.description, 'html-v1')).toBe('Description & details.')
    const json = generateTouristTripJsonLd(source) as { itinerary: { itemListElement: { description: string }[] }; description: string }
    expect(json.itinerary.itemListElement[0].description).toBe('Description & details.')
    expect(json.description).toBe('Plain summary')
  })
})
