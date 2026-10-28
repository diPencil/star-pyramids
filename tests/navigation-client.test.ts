import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const h=vi.hoisted(()=>({slots:[] as unknown[],cursor:0,effects:[] as {deps:unknown[];cleanup?:()=>void}[],effect:0,fetch:vi.fn(),poll:undefined as (()=>void)|undefined}))
vi.mock('react',async()=>{const actual=await vi.importActual<typeof import('react')>('react');return {...actual,
 useState:(initial:unknown)=>{const slot=h.cursor++;if(!(slot in h.slots))h.slots[slot]=initial;return[h.slots[slot],(next:unknown)=>{h.slots[slot]=typeof next==='function'?(next as (value:unknown)=>unknown)(h.slots[slot]):next}]},
 useEffect:(effect:()=>void|(()=>void),deps:unknown[])=>{const index=h.effect++,old=h.effects[index];if(!old||deps.some((dep,i)=>dep!==old.deps[i])){old?.cleanup?.();h.effects[index]={deps,cleanup:effect()||undefined}}}
}})
import { NavigationProvider } from '@/components/navigation-context'
import type { PublicNavigation } from '@/lib/navigation'
const initial:PublicNavigation={revision:3,primaryLocale:'en',items:[]}
const render=(seed:PublicNavigation|null=initial)=>{h.cursor=0;h.effect=0;return NavigationProvider({initial:seed,children:null}).props.value as PublicNavigation|null}
const settle=()=>new Promise(resolve=>setTimeout(resolve,0))
beforeEach(()=>{h.slots=[];h.effects=[];h.cursor=0;h.effect=0;vi.clearAllMocks();vi.stubGlobal('window',Object.assign(new EventTarget(),{setInterval:vi.fn((callback:()=>void)=>{h.poll=callback;return 123})}));vi.stubGlobal('document',{visibilityState:'visible'});vi.stubGlobal('fetch',h.fetch)})
afterEach(()=>{h.effects.forEach(effect=>effect.cleanup?.());vi.unstubAllGlobals()})
it('refreshes published navigation on publish, focus and polling with no-store',async()=>{
 expect(render()).toEqual(initial);h.fetch.mockResolvedValue(Response.json({navigation:{...initial,revision:4}}));window.dispatchEvent(new Event('sp-navigation-published'));await settle();expect(render()!.revision).toBe(4)
 window.dispatchEvent(new Event('focus'));await settle();h.poll?.();await settle();expect(h.fetch).toHaveBeenCalledTimes(3);expect(h.fetch).toHaveBeenCalledWith('/api/navigation',{cache:'no-store'})
})
it('retains last confirmed publication if a refresh fails instead of restoring defaults',async()=>{render();h.fetch.mockResolvedValue(new Response('',{status:503}));window.dispatchEvent(new Event('focus'));await settle();expect(render()).toEqual(initial)})
it('discards older in-flight responses after a newer refresh and permits explicit restore to original',async()=>{
 render();let finish!:(value:Response)=>void;h.fetch.mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve})).mockResolvedValueOnce(Response.json({navigation:{...initial,revision:5}}));window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('sp-navigation-published'));await settle();finish(Response.json({navigation:{...initial,revision:4}}));await settle();expect(render()!.revision).toBe(5)
 h.fetch.mockResolvedValueOnce(Response.json({navigation:null}));window.dispatchEvent(new Event('sp-navigation-published'));await settle();expect(render()).toBeNull()
})

it('invalidates an in-flight refresh when newer server layout props arrive',async()=>{
 render();let finish!:(value:Response)=>void;h.fetch.mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve}));window.dispatchEvent(new Event('focus'))
 const newer={...initial,revision:9};render(newer);expect(render(newer)!.revision).toBe(9)
 finish(Response.json({navigation:{...initial,revision:4}}));await settle();expect(render(newer)!.revision).toBe(9)
})
