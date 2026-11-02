import { translationTour } from './fixtures/translation-tour'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import type { Tour } from '@/data/types'

const state = vi.hoisted(() => ({ locale: 'es' as 'en' | 'es' | 'it' }))
vi.mock('next/navigation', () => ({ useRouter:()=>({push:vi.fn()}), usePathname:()=>'/egypt-tours/test' }))
vi.mock('@/components/locale', async () => ({ ...await vi.importActual<typeof import('@/components/locale')>('@/components/locale'), useLocale:()=>({locale:state.locale,currency:'USD'}) }))
vi.mock('@/lib/customer-account',()=>({useCustomerFavorites:()=>({has:()=>false,toggle:vi.fn()})}))
vi.mock('@/lib/catalogue-client',()=>({useDbDestinations:()=>[]}))
vi.mock('@/components/reviews',()=>({TourReviewsSection:()=>null}))
vi.mock('@/components/tour-video-gallery',()=>({TourVideoGallery:()=>null}))
vi.mock('@/components/ask-question',()=>({AskQuestionButton:()=>null}))
vi.mock('@/components/mobile-booking-shortcut',()=>({MobileBookingShortcut:()=>null}))

import { DayTourDetailPage } from '@/components/day-tour-detail'
import { TourRichText } from '@/components/tour-rich-text'
import { TripPreviewContent } from '@/components/admin/trip-builder-preview'
import { buildTripPreview } from '@/lib/trip-builder-preview'
import { editorData } from '@/components/admin/trip-builder'
import { TourDetailPage, TourLocationMap } from '@/components/tour-detail'

const records = [translationTour]

it.each(['one-day-tours', 'multi-days-tours', 'nile-cruises', 'shore-excursions'] as const)('renders safe narrative HTML in the actual %s page and preview', category => {
  state.locale = 'en'
  const content = { overview: ['<h3>Rich heading</h3><p><strong>Formatted overview</strong></p>\n<ol><li>Visit</li></ol>'], itineraryNote: '<p><u>Formatted note</u></p>', contentFormats: { overview: { en: 'html-v1' as const }, itineraryNote: { en: 'html-v1' as const } },
    highlights: [], locations: [], itinerary: [{ day: 'Day 1', title: 'Plain day', description: '<p><em>Formatted description</em></p>', contentFormats: { description: { en: 'html-v1' as const } } }], stops: [{ day: 'Stop 1', title: 'Plain stop', description: '<p><em>Formatted description</em></p>', contentFormats: { description: { en: 'html-v1' as const } } }], included: ['Plain lunch'], excluded: [] }
  const source: Tour = { ...translationTour, category, image: '/fixture.jpg', gallery: ['/fixture.jpg'],
    detail: category === 'one-day-tours' ? undefined : content,
    dayDetail: category === 'one-day-tours' ? { ...content, highlights: [] } : undefined }
  const html = renderToStaticMarkup(createElement(category === 'one-day-tours' ? DayTourDetailPage : TourDetailPage, { tour: source, related: [] }))
  expect(html).toContain('<h3>Rich heading</h3>')
  expect(html).toContain('<strong>Formatted overview</strong>')
  expect(html).toContain('<u>Formatted note</u>')
  expect(html).toContain('<em>Formatted description</em>')
  expect(html).not.toContain('&lt;strong&gt;')
  const loaded = editorData(source)
  const preview = buildTripPreview(source, { ...loaded, catSlugs: loaded.categorySlugs }, 'en')
  const previewHtml = renderToStaticMarkup(createElement(TripPreviewContent, { preview, counts: { adult: 1, child: 0, infant: 0 } }))
  expect(previewHtml).toContain('<strong>Formatted overview</strong>')
  expect(previewHtml).toContain('<u>Formatted note</u>')
})

it('keeps unmarked markup escaped and sanitizes marked HTML even when persistence was bypassed', () => {
  const plain = renderToStaticMarkup(createElement(TourRichText, { value: '<b>literal</b>' }))
  expect(plain).toBe('<p>&lt;b&gt;literal&lt;/b&gt;</p>')
  const rich = renderToStaticMarkup(createElement(TourRichText, { value: '<p onclick="bad()"><strong>Safe</strong><script>bad()</script><a href="javascript:bad()">Link</a></p>', format: 'html-v1' }))
  expect(rich).toContain('<strong>Safe</strong>')
  expect(rich).not.toMatch(/onclick|script|javascript|bad\(\)/)
  expect(rich).not.toMatch(/<p><div|<p><p/)
})
it.each(['en','es','it'] as const)('renders saved %s day-tour content in the actual public template', locale => {
  state.locale=locale
  const source={...records[0],image:'/fixture.jpg',gallery:['/fixture.jpg']}
  const raw=source.dayDetail!, text=raw.translations?.[locale]
  const html=renderToStaticMarkup(createElement(DayTourDetailPage,{tour:source,related:[]}))
  for(const value of [text?.title??source.title,text?.summary??source.summary,text?.overview?.split('\n')[0]??raw.overview[0],raw.stops![0].translations?.[locale]?.title??raw.stops![0].title,raw.stops![0].translations?.[locale]?.meals??raw.stops![0].meals]) {
    expect(html).toContain(renderToStaticMarkup(createElement('span',null,value)).replace(/^<span>|<\/span>$/g,''))
  }
  expect(html).toContain('day-tour-detail')
})

it.each(['multi-days-tours','nile-cruises','shore-excursions'] as const)('renders manual translations in the %s template', category => {
  state.locale='it'
  const source: Tour={...records[0],category,image:'/fixture.jpg',gallery:['/fixture.jpg'],dayDetail:undefined,
    detail:{overview:['English overview'],highlights:[],itinerary:[],locations:[],included:['Lunch'],translations:{it:{title:'Titolo italiano',summary:'Riepilogo italiano',overview:'Panoramica italiana',included:'Pranzo incluso'}}}}
  const html=renderToStaticMarkup(createElement(TourDetailPage,{tour:source,related:[]}))
  for(const text of ['Titolo italiano','Riepilogo italiano','Panoramica italiana','Pranzo incluso'])expect(html).toContain(text)
})

it('uses saved highlight group headings and travel style in the existing day-tour sections',()=>{
  state.locale='es'
  const source:Tour={...records[0],image:'/fixture.jpg',dayDetail:{...records[0].dayDetail!,highlightGroups:[
    {title:'First group',items:['First item'],translations:{es:{title:'Primer grupo',items:'Primer punto'}}},
    {title:'Second group',items:['Second item'],translations:{es:{title:'Segundo grupo',items:'Segundo punto'}}},
  ]}}
  const html=renderToStaticMarkup(createElement(DayTourDetailPage,{tour:source,related:[]}))
  for(const text of ['Primer grupo','Segundo grupo','Primer punto','Segundo punto',source.dayDetail!.translations!.es!.travelStyle])expect(html).toContain(text)
})

it('translates map labels while preserving the exact canonical place search',()=>{
  const html=renderToStaticMarkup(createElement(TourLocationMap,{locations:['Canonical fixture'],locationTranslations:[{it:{name:'Nome tradotto'}}],locale:'it'}))
  expect(html).toContain('Nome tradotto')
  expect(html).toContain('Canonical%20fixture%2C%20Egypt')
  expect(html).not.toContain('Nome%20tradotto%2C')
  const known=renderToStaticMarkup(createElement(TourLocationMap,{locations:['Giza'],locationTranslations:[{it:{name:'Guiza tradotta'}}],locale:'it'}))
  expect(known).toContain('Guiza tradotta')
  expect(known).toContain('mlat=30.0131')
})
