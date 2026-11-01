import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import postcss, { type AtRule } from 'postcss'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomepageHero, type PublicHomeHero } from '@/components/homepage-hero'
import { InitialLocaleProvider, LocaleProvider } from '@/components/locale'
import { originalHomeHero, validateHomeHero } from '@/lib/website-heroes'
import type { EnabledLocale } from '@/lib/locale-config'
import { TripSearchEngine } from '@/components/site'

vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()}),usePathname:()=>'/'}))
vi.mock('@/lib/tours-client',async()=>({...await vi.importActual<typeof import('@/lib/tours-client')>('@/lib/tours-client'),useDbTours:()=>[]}))
beforeEach(()=>vi.stubGlobal('fetch',vi.fn(()=>{throw Error('Hero rendering must not read or write the database')})))
afterEach(()=>vi.unstubAllGlobals())
function render(state:PublicHomeHero,locale:EnabledLocale='en',realEngine=false){
 return renderToStaticMarkup(createElement(InitialLocaleProvider,{locale,preview:true,children:createElement(LocaleProvider,{children:createElement(HomepageHero,{
  state,heading:'Fallback heading',eyebrow:'Fallback eyebrow',children:realEngine?createElement(TripSearchEngine):createElement('form',{'data-unchanged-engine':'true'},'Existing engine'),
 })})}))
}
const globals=postcss.parse(readFileSync('app/globals.css','utf8'))
const mobile=postcss.parse(readFileSync('app/mobile-shell.css','utf8'))
function frameStyle(width:number){
 const result:Record<string,string>={}
 for(const sheet of [globals,mobile])sheet.walkRules(rule=>{
  if(!['.home-hero-visual','.home-hero .home-hero-visual'].includes(rule.selector))return
  let enabled=true
  for(let parent=rule.parent;parent;parent=parent.parent){if(parent.type==='atrule'&&(parent as AtRule).name==='media'){
   const max=(parent as AtRule).params.match(/max-width:\s*(\d+)px/);if(max&&width>Number(max[1]))enabled=false
  }}
  if(enabled)rule.walkDecls(decl=>{result[decl.prop]=decl.value})
 })
 return result
}

describe('mobile CMS hero frame with unchanged engine',()=>{
 it.each(['en','es','it'] as const)('uses the saved %s heading and keeps search outside the media/text frame',locale=>{
  const content=originalHomeHero(),markup=render({hidden:false,content},locale)
  expect(markup).toContain(content.text[locale].heading)
  expect(markup).toContain(content.text[locale].eyebrow)
  expect(markup).toContain('class="home-hero-visual"')
  expect(markup).toContain('class="home-hero-media"')
  expect(markup).toMatch(/<\/h1><\/div><\/div><form data-unchanged-engine/)
  expect(fetch).not.toHaveBeenCalled()
 })
 it('retains desktop/mobile image selection, media crop and custom zero overlay',()=>{
  const content=validateHomeHero({...originalHomeHero(),mediaUrl:'https://cdn.example.test/desktop.jpg',mobileUrl:'https://cdn.example.test/mobile.jpg',position:'bottom',overlay:0})
  const markup=render({hidden:false,content})
  expect(markup).toContain('media="(max-width: 760px)" srcSet="https://cdn.example.test/mobile.jpg"')
  expect(markup).toContain('src="https://cdn.example.test/desktop.jpg"')
  expect(markup).toContain('object-position:bottom')
  expect(markup).toContain('background:rgba(10,32,76,0)')
 })
 it('preserves the video poster fallback and keeps one unchanged video effect path',()=>{
  const content=validateHomeHero({...originalHomeHero(),mediaType:'video',mediaUrl:'https://cdn.example.test/hero.mp4',mobileUrl:'https://cdn.example.test/mobile.webm',poster:'https://cdn.example.test/poster.jpg',position:'left',overlay:0.4})
  const markup=render({hidden:false,content})
  expect(markup).toContain('src="https://cdn.example.test/poster.jpg"')
  expect(markup).toContain('object-position:left')
  expect(markup).not.toContain('<video') // SSR poster; source selection remains in the existing client effect.
  const source=readFileSync('components/homepage-hero.tsx','utf8')
  expect(source).toContain('reduced.matches || connection?.saveData')
  expect(source).toContain('mobile.matches && content.mobileUrl ? content.mobileUrl : content.mediaUrl')
  expect(source).toContain('autoPlay muted loop playsInline')
  expect(source.match(/<video /g)).toHaveLength(1)
 })
 it.each([{hidden:true,content:null},{hidden:false,content:null,unavailable:true}])('leaves the engine accessible without a blank square for hidden/unavailable state',state=>{
  const markup=render(state)
  expect(markup).toContain('data-unchanged-engine')
  expect(markup).not.toContain('home-hero-visual')
  expect(markup).not.toContain('Fallback heading')
 })
 it('retains the original media when CMS custom content is absent',()=>{
  const markup=render({hidden:false,content:null})
  expect(markup).toContain('Fallback heading')
  expect(markup).toContain('egypt-hero.png')
  expect(markup).toMatch(/<\/h1><\/div><\/div><form data-unchanged-engine/)
 })
 it('renders the real three-tab engine once below the heading and media wrappers',()=>{
  const markup=render({hidden:false,content:originalHomeHero()},'en',true)
  expect(markup.indexOf('class="search-wrap"')).toBeGreaterThan(markup.indexOf('</h1></div></div>'))
  for(const text of ['Make Your Trip','Find your trip','Rent Car'])expect(markup).toContain(text)
  expect(markup.match(/class="search-wrap"/g)).toHaveLength(1)
  expect(fetch).not.toHaveBeenCalled()
 })
 it('preserves maximum-length configured text without introducing line clamps or truncation',()=>{
  const content=originalHomeHero();content.text.en.heading='W'.repeat(160);content.text.en.eyebrow='Small heading '.repeat(7).trim()
  const markup=render({hidden:false,content:validateHomeHero(content)})
  expect(markup).toContain(content.text.en.heading)
  expect(markup).toContain('overflow-wrap:anywhere')
  expect(frameStyle(320)['min-block-size']).toBe('min-content')
 })
 it.each([320,375,390,430,760])('scopes square media and centered copy to phone width %i',width=>{
  expect(frameStyle(width)).toMatchObject({display:'grid',position:'relative','aspect-ratio':'1 / 1','place-items':'center',width:'100%'})
 })
 it.each([761,1024,1440])('retains existing flattened desktop/tablet hero layout at width %i',width=>{
  expect(frameStyle(width)).toEqual({display:'contents'})
 })
})
