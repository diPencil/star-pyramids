import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({find:vi.fn(),update:vi.fn(),create:vi.fn(),tour:vi.fn(),destination:vi.fn(),blog:vi.fn(),event:vi.fn(),offer:vi.fn(),getSetting:vi.fn(),readShared:vi.fn()}))
vi.mock('@/lib/server/db',()=>({db:{siteSetting:{findUnique:mocks.find,updateMany:mocks.update,create:mocks.create},tour:{findMany:mocks.tour},destination:{findMany:mocks.destination},blog:{findMany:mocks.blog},event:{findMany:mocks.event},offer:{findMany:mocks.offer}}}))
vi.mock('@/lib/server/settings',()=>({getSetting:mocks.getSetting}))
vi.mock('@/lib/server/page-sections',()=>({readPublishedPage:mocks.readShared}))
import { changeNavigation, readNavigation, publishedNavigation, resolveNavigation, navigationDefaults, recordNavigationOptions } from '@/lib/server/navigation'
import { defaultNavigation, initialNavigation, NAVIGATION_KEY, type NavigationContent } from '@/lib/navigation'
const refContent=():NavigationContent=>({primaryLocale:'en',items:[{id:'trip',type:'link',labels:{en:'A tour',es:'',it:''},enabled:true,visibility:'both',newTab:false,target:{type:'record',kind:'tour',id:'immutable-tour-id'},children:[]}]})
beforeEach(()=>{vi.resetAllMocks();mocks.find.mockResolvedValue(null);mocks.update.mockResolvedValue({count:1});mocks.create.mockResolvedValue({});for(const method of [mocks.tour,mocks.destination,mocks.blog,mocks.event,mocks.offer])method.mockResolvedValue([]);mocks.getSetting.mockResolvedValue('en');mocks.readShared.mockResolvedValue({content:null})})
describe('navigation SiteSetting persistence and public resolution',()=>{
 it('returns the original fallback without creating storage',async()=>{expect(await readNavigation()).toEqual(initialNavigation());expect(await publishedNavigation()).toBeNull();expect(mocks.create).not.toHaveBeenCalled()})
 it('writes one dedicated key, saves drafts privately and compares exact prior document',async()=>{
  const state=await changeNavigation(0,'save-draft',defaultNavigation());expect(state.published).toBeNull();expect(mocks.create.mock.calls[0][0].data.key).toBe(NAVIGATION_KEY)
  const value=JSON.stringify(state);mocks.find.mockResolvedValue({value});const published=await changeNavigation(1,'publish');expect(published.published).not.toBeNull();expect(mocks.update.mock.calls[0][0].where).toEqual({key:NAVIGATION_KEY,value})
 })
 it('rejects stale revision, concurrent update and first-create races',async()=>{
  await expect(changeNavigation(3,'save-draft',defaultNavigation())).rejects.toThrow('changed')
  mocks.find.mockResolvedValue({value:JSON.stringify(initialNavigation())});mocks.update.mockResolvedValue({count:0});await expect(changeNavigation(0,'save-draft',defaultNavigation())).rejects.toThrow('changed')
  mocks.find.mockResolvedValue(null);mocks.create.mockRejectedValue({code:'P2002'});await expect(changeNavigation(0,'save-draft',defaultNavigation())).rejects.toThrow('changed')
 })
 it('resolves current slug by immutable ID, selecting only published records and no private fields',async()=>{
  mocks.tour.mockResolvedValue([{id:'immutable-tour-id',slug:'new-slug',title:'New title'}]);let publicMenu=await resolveNavigation(refContent());expect(publicMenu.items[0].href).toBe('/egypt-tours/new-slug');expect(publicMenu.items[0]).not.toHaveProperty('target');expect(mocks.tour.mock.calls[0][0].where).toEqual({id:{in:['immutable-tour-id']},status:'published'})
  mocks.tour.mockResolvedValue([]);publicMenu=await resolveNavigation(refContent());expect(publicMenu.items).toEqual([])
 })
 it('omits unpublished/deleted links and empty groups instead of restoring defaults',async()=>{
  const content=defaultNavigation();content.items=[{...content.items[1],children:refContent().items}];expect((await resolveNavigation(content)).items).toEqual([])
  mocks.find.mockResolvedValue({value:JSON.stringify({...initialNavigation(),published:content})});expect((await publishedNavigation())!.items).toEqual([])
 })
 it('does not read drafts for public output',async()=>{mocks.find.mockResolvedValue({value:JSON.stringify({...initialNavigation(),draft:refContent(),published:{primaryLocale:'en',items:[]}})});expect((await publishedNavigation())!.items).toEqual([]);expect(mocks.tour).not.toHaveBeenCalled()})
 it('resolves destination/blog/event canonical links with publication guards',async()=>{
  for(const [kind,method,prefix] of [['destination',mocks.destination,'destinations'],['blog',mocks.blog,'blogs'],['event',mocks.event,'events']] as const){method.mockResolvedValue([{id:'stable',slug:'current',title:'Public'}]);const options=await recordNavigationOptions(kind,['stable']);expect(options[0].href).toBe(`/${prefix}/current`);expect(method.mock.lastCall![0].where.isPublished).toBe(true)}
 })
 it('excludes inactive/expired offers and unavailable tour-linked offers',async()=>{
  mocks.offer.mockResolvedValue([{id:'a',slug:'a',title:'expired',isPublished:true,deadline:'2020-01-01',startsAt:null,tourSlug:null,tour:null},{id:'b',slug:'b',title:'missing trip',isPublished:true,startsAt:null,deadline:null,tourSlug:'private',tour:null},{id:'c',slug:'c',title:'public',isPublished:true,startsAt:null,deadline:null,tourSlug:null,tour:null}]);expect((await recordNavigationOptions('offer')).map(row=>row.key)).toEqual(['offer:c'])
 })
 it('inherits configured fallback language and original/shared localized labels',async()=>{
  mocks.getSetting.mockResolvedValue('it');mocks.readShared.mockResolvedValue({content:{sections:[{id:'navigation',text:{en:{home:'Start'},es:{home:'Comenzar'},it:{home:'Inizio'}}}]}});const content=await navigationDefaults();expect(content.primaryLocale).toBe('it');expect(content.items[0].labels).toEqual({en:'Start',es:'Comenzar',it:'Inizio'});expect(content.items[1].children[1].labels.it).toBeTruthy()
 })
})
