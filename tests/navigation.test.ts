import { describe, it, expect } from 'vitest'
import { defaultNavigation, validateNavigation, transitionNavigation, initialNavigation, moveNavigation, navigationLabel, visibleNavigation, safeNavigationUrl, decodeNavigation, navigationActive, type NavigationContent, type ResolvedNavigationItem } from '@/lib/navigation'
const fixture = () => defaultNavigation()
const resolved = (content = fixture()): ResolvedNavigationItem[] => content.items.map(item => ({ ...item, href: item.target?.type === 'internal' ? item.target.href : undefined, children: item.children.map(child => ({ ...child, href: child.target?.type === 'internal' ? child.target.href : undefined, children: [] })) }))
describe('Navigation CMS document and tree operations', () => {
  it('preserves initial desktop order and mobile group order without duplicate routes on each surface', () => {
    const content = validateNavigation(fixture()); const items = resolved(content)
    expect(visibleNavigation(items, 'desktop').map(item => item.id)).toEqual(['home','tours','rent','events','company','blogs','offer','make'])
    expect(visibleNavigation(items, 'mobile').map(item => item.id)).toEqual(['tours','mobile-plan','mobile-help'])
    expect(visibleNavigation(items,'desktop')[1].children.map(item=>item.href)).toEqual(['/trips','/egypt-tours/one-day-tours','/egypt-tours/multi-days-tours','/egypt-tours/nile-cruises','/egypt-tours/shore-excursions','/destinations'])
    for(const device of ['desktop','mobile'] as const) { const rows = visibleNavigation(items,device).flatMap(row=>row.type === 'link' ? [row] : row.children); expect(new Set(rows.map(row=>row.href)).size).toBe(rows.length) }
  })
  it('creates, edits, removes and reorders items without mutating prior state', () => {
    const content = fixture(); const old = JSON.stringify(content)
    const moved = moveNavigation(content,'blogs',null,0); expect(moved.items[0].id).toBe('blogs'); expect(JSON.stringify(content)).toBe(old)
    moved.items[0].labels.es = 'Historias'; expect(validateNavigation(moved).items[0].labels.es).toBe('Historias')
    moved.items = moved.items.filter(row=>row.id!=='blogs'); expect(validateNavigation(moved).items.some(row=>row.id==='blogs')).toBe(false)
  })
  it('moves links into and out of groups and reorders siblings', () => {
    let content = moveNavigation(fixture(),'blogs','company',0)
    expect(content.items.find(row=>row.id==='company')!.children[0].id).toBe('blogs')
    content = moveNavigation(content,'blogs','tours',0)
    expect(content.items.find(row=>row.id==='tours')!.children[0].id).toBe('blogs')
    content = moveNavigation(content,'blogs',null,2); expect(content.items[2].id).toBe('blogs')
    content = moveNavigation(content,'make','company',0); expect(content.items.find(row=>row.id==='company')!.children[0].placement).toBeUndefined()
  })
  it('rejects circular nesting, missing groups, duplicate IDs and second-level groups', () => {
    expect(()=>moveNavigation(fixture(),'tours','tours',0)).toThrow()
    expect(()=>moveNavigation(fixture(),'home','missing',0)).toThrow()
    const duplicate=fixture(); duplicate.items[0].id='tours'; expect(()=>validateNavigation(duplicate)).toThrow()
    expect(()=>moveNavigation(fixture(),'company','tours',0)).toThrow()
    const nested=fixture(); nested.items[1].children.push({...nested.items[4],id:'nested'}); expect(()=>validateNavigation(nested)).toThrow()
  })
  it.each(['javascript:alert(1)','data:text/html,test','//evil.test','/admin','/account','/api/navigation','/destinations/draft','/gallery-videos','/\\evil.test','/%2f/evil.test','https://a.test@evil.test'])('rejects invalid internal destinations %s',value=>{expect(safeNavigationUrl(value)).toBe(false)})
  it.each(['javascript:alert(1)','data:text/html,a','ftp://host/path','https://user:pass@example.test','https://example.test/\nfoo'])('rejects unsafe external URLs %s',value=>{expect(safeNavigationUrl(value,true)).toBe(false)})
  it('accepts canonical public routes, harmless fragments, and safe external links',()=>{expect(safeNavigationUrl('/trips?destination=cairo#results')).toBe(true);expect(safeNavigationUrl('https://example.test/tours',true)).toBe(true)})
  it('validates stable references, layout bounds and locale fallback',()=>{
    const value=fixture(); value.items[0].target={type:'record',kind:'tour',id:'stable-tour'}; expect(validateNavigation(value).items[0].target).toEqual(value.items[0].target)
    value.items[0].labels.it='';value.items[0].labels.es='Inicio';value.primaryLocale='es';expect(navigationLabel(value.items[0],'it','es')).toBe('Inicio')
    expect(()=>validateNavigation({...value,primaryLocale:'ar'})).toThrow(); value.items[0].labels.es='';expect(()=>validateNavigation(value)).toThrow()
  })
  it('honors visibility, disabling, empty groups and active links',()=>{
    const items=resolved();items[1].enabled=false;expect(visibleNavigation(items,'mobile').some(row=>row.id==='tours')).toBe(false)
    items[4].children=[];expect(visibleNavigation(items,'desktop').some(row=>row.id==='company')).toBe(false)
    expect(navigationActive(items[1],'/egypt-tours/public-tour')).toBe(true);expect(navigationActive(items[2],'/rent-car/request')).toBe(true);expect(navigationActive(items[0],'/rent-car')).toBe(false)
  })
  it('keeps drafts and local edits isolated until publish, and restores previous publication',()=>{
    let state=initialNavigation();const draft=fixture();state=transitionNavigation(state,'save-draft',draft);expect(state.published).toBeNull()
    draft.items[0].labels.en='Changed locally';expect(state.draft!.items[0].labels.en).toBe('Home')
    state=transitionNavigation(state,'publish');expect(state.published!.items[0].labels.en).toBe('Home');expect(state.draft).toBeNull()
    state=transitionNavigation(state,'save-draft',{...fixture(),items:[]});expect(state.published!.items.length).toBeGreaterThan(0)
    state=transitionNavigation(state,'publish');expect(state.published!.items).toEqual([])
    state=transitionNavigation(state,'restore');expect(state.published!.items[0].labels.en).toBe('Home')
    expect(decodeNavigation(JSON.stringify(state))).toEqual(state)
  })
  it('resets drafts without affecting publication and can restore original only explicitly',()=>{
    let state=transitionNavigation(initialNavigation(),'save-draft',fixture());state=transitionNavigation(state,'reset-draft');expect(state.draft).toBeNull()
    state=transitionNavigation(state,'save-draft',fixture());state=transitionNavigation(state,'publish');state=transitionNavigation(state,'restore');expect(state.published).toBeNull()
    expect(()=>transitionNavigation(initialNavigation(),'publish')).toThrow();expect(()=>transitionNavigation(initialNavigation(),'restore')).toThrow()
  })
})
