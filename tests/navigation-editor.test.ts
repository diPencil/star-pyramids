import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
const harness=vi.hoisted(()=>({slots:[] as unknown[],cursor:0,effects:[] as {deps:unknown[];cleanup?:()=>void}[],effect:0,fetch:vi.fn()}))
vi.mock('react',async()=>{
 const actual=await vi.importActual<typeof import('react')>('react')
 return {...actual,
 useState:(initial:unknown)=>{const slot=harness.cursor++;if(!(slot in harness.slots))harness.slots[slot]=typeof initial==='function'?(initial as ()=>unknown)():initial;return[harness.slots[slot],(next:unknown)=>{harness.slots[slot]=typeof next==='function'?(next as (current:unknown)=>unknown)(harness.slots[slot]):next}]},
 useRef:(initial:unknown)=>{const slot=harness.cursor++;if(!(slot in harness.slots))harness.slots[slot]={current:initial};return harness.slots[slot]},
 useCallback:(callback:unknown,deps:unknown[])=>{const slot=harness.cursor++;const old=harness.slots[slot] as {deps:unknown[];callback:unknown}|undefined;if(!old||deps.some((dep,i)=>dep!==old.deps[i]))harness.slots[slot]={deps,callback};return(harness.slots[slot] as {callback:unknown}).callback},
 useEffect:(effect:()=>void|(()=>void),deps:unknown[])=>{const index=harness.effect++,old=harness.effects[index];if(!old||deps.some((dep,i)=>dep!==old.deps[i])){old?.cleanup?.();harness.effects[index]={deps,cleanup:effect()||undefined}}}
 }
})
vi.mock('@/components/admin/admin-shell',()=>({PageHead:()=>null}))
vi.mock('@/components/admin/admin-toaster',()=>({toast:{success:vi.fn(),error:vi.fn()}}))
import { NavigationManager } from '@/components/admin/navigation-manager'
import { defaultNavigation, initialNavigation } from '@/lib/navigation'
type Element=ReactElement<Record<string,any>>
function elements(node:ReactNode):Element[]{return Children.toArray(node).flatMap(child=>isValidElement(child)?[child as Element,...elements((child as Element).props.children)]:[])}
function text(node:ReactNode):string{return Children.toArray(node).map(child=>typeof child==='string'||typeof child==='number'?String(child):isValidElement(child)?text((child as Element).props.children):'').join('')}
const render=()=>{harness.cursor=0;harness.effect=0;return NavigationManager()}
const button=(tree:ReactNode,label:string)=>elements(tree).find(node=>node.type==='button'&&text(node.props.children).trim()===label)!
const settle=()=>new Promise(resolve=>setTimeout(resolve,0))
beforeEach(()=>{
 vi.clearAllMocks();harness.slots=[];harness.effects=[];harness.cursor=0;harness.effect=0
 vi.stubGlobal('window',Object.assign(new EventTarget(),{confirm:vi.fn(()=>true)}));vi.stubGlobal('document',new EventTarget());vi.stubGlobal('fetch',harness.fetch)
 harness.fetch.mockImplementation(async(url:string)=>url.includes('/options')?Response.json({options:[]}):Response.json({state:initialNavigation(),defaults:defaultNavigation(),canEdit:true}))
})
afterEach(()=>{harness.effects.forEach(effect=>effect.cleanup?.());vi.unstubAllGlobals()})
it('loads protected draft state, adds/selects dropdowns, and keeps every action explicitly separate',async()=>{
 render();await settle();let tree=render();button(tree,'Add Dropdown').props.onClick();tree=render();expect(text(tree)).toContain('New dropdown')
 expect(button(tree,'Publish').props.disabled).toBe(true)
 const fields=elements(tree).filter(node=>node.type==='label');const label=fields.find(node=>text(node).startsWith('Label (EN)'))!;elements(label).find(node=>node.type==='input')!.props.onChange({target:{value:'Discover more'}})
 tree=render();expect(text(tree)).toContain('Discover more');expect(harness.fetch).toHaveBeenCalledTimes(1)
 button(tree,'Save Draft').props.onClick();await settle();const call=harness.fetch.mock.calls.find(([,options])=>options?.method==='PATCH')!;const body=JSON.parse(call[1].body);expect(body.action).toBe('save-draft');expect(body.revision).toBe(0);expect(body.content.items.at(-1).labels.en).toBe('Discover more')
})
it('does not mutate public state while previewing unsaved content',async()=>{
 render();await settle();let tree=render();button(tree,'Add Item').props.onClick();tree=render();harness.fetch.mockImplementationOnce(async()=>Response.json({navigation:{revision:0,primaryLocale:'en',items:[]}}))
 button(tree,'Preview unsaved menu').props.onClick();await settle();tree=render();expect(elements(tree).some(node=>node.props.title==='Read-only navigation preview')).toBe(true);expect(harness.fetch.mock.calls.filter(([,options])=>options?.method==='PATCH')).toHaveLength(0)
 const preview=harness.fetch.mock.calls.find(([url])=>url.endsWith('/preview'))!;expect(preview[1].method).toBe('POST');expect(JSON.parse(preview[1].body).content.items).toHaveLength(defaultNavigation().items.length+1)
})
it('disables mutation controls for read-only viewers',async()=>{
 harness.fetch.mockResolvedValueOnce(Response.json({state:initialNavigation(),defaults:defaultNavigation(),canEdit:false}));render();await settle();const tree=render();expect(button(tree,'Add Item').props.disabled).toBe(true);expect(button(tree,'Add Dropdown').props.disabled).toBe(true);expect(button(tree,'Save Draft').props.disabled).toBe(true);expect(button(tree,'Preview unsaved menu').props.disabled).toBe(false)
})
it('keeps local edits when the server reports a revision conflict',async()=>{
 render();await settle();let tree=render();button(tree,'Add Item').props.onClick();tree=render();harness.fetch.mockResolvedValueOnce(Response.json({error:'Navigation changed. Reload before saving.'},{status:409}));button(tree,'Save Draft').props.onClick();await settle();tree=render();expect(text(tree)).toContain('Reload before saving');expect(text(tree)).toContain('New link');expect(button(tree,'Publish').props.disabled).toBe(true)
})
