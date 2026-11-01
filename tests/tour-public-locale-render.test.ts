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
import { TourDetailPage, TourLocationMap } from '@/components/tour-detail'

const records = [translationTour]
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
