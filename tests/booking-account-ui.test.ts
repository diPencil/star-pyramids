import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import type {ReactElement,ReactNode} from 'react'
const h=vi.hoisted(()=>({index:0,values:[] as unknown[],effect:null as null|(()=>void|(()=>void)),fetch:vi.fn(),replace:vi.fn(),locale:'en' as 'en'|'es'|'it'}))
vi.mock('react',async()=>({...await vi.importActual<typeof import('react')>('react'),useState:(initial:unknown)=>{const i=h.index++;if(!(i in h.values))h.values[i]=initial;return[h.values[i],(v:unknown)=>{h.values[i]=v}]},useRef:(initial:unknown)=>{const i=h.index++;if(!(i in h.values))h.values[i]={current:initial};return h.values[i]},useEffect:(fn:()=>void)=>{h.effect??=fn}}))
vi.mock('@/components/site',()=>({SiteShell:({children}:{children:ReactNode})=>children}))
vi.mock('@/components/locale',async()=>({...await vi.importActual<typeof import('@/components/locale')>('@/components/locale'),useLocale:()=>({locale:h.locale})}))
import {BookingAccountSetup} from '@/components/booking/booking-account-setup'
function render(){h.index=0;return BookingAccountSetup()}
function find(node:ReactNode,predicate:(e:ReactElement<Record<string,any>>)=>boolean):ReactElement<Record<string,any>>|undefined{if(Array.isArray(node)){for(const n of node){const found=find(n,predicate);if(found)return found}return}if(!node||typeof node!=='object'||!('props'in node))return;const e=node as ReactElement<Record<string,any>>;return predicate(e)?e:find(e.props.children,predicate)}
const info={email:'owner@example.com',needsPassword:true}
const response=(body:unknown)=>({ok:true,status:200,headers:new Headers(),json:async()=>body})
beforeEach(()=>{vi.clearAllMocks();h.index=0;h.values=[];h.effect=null;h.locale='en';const location={hash:'#reference=SP-BK-ABC123&token='+'a'.repeat(43),pathname:'/booking-account'};h.replace.mockImplementation(()=>{location.hash=''});vi.stubGlobal('window',{location,history:{replaceState:h.replace}});vi.stubGlobal('fetch',h.fetch);h.fetch.mockImplementation(async()=>response(info))})
afterEach(()=>vi.unstubAllGlobals())
it('removes credentials from the address and survives StrictMode effect replay without consuming a token',async()=>{
  render();const cleanup=h.effect!();if(typeof cleanup==='function')cleanup();h.effect!()
  await vi.waitFor(()=>expect(h.fetch).toHaveBeenCalledTimes(2))
  expect(h.replace).toHaveBeenCalledExactlyOnceWith(null,'','/booking-account')
  const sent=h.fetch.mock.calls.map(call=>JSON.parse(call[1].body))
  expect(sent[0]).toEqual(sent[1]);expect(sent[0].mode).toBe('inspect');expect(sent[0].token).toHaveLength(43)
})
it.each(['en','es','it'] as const)('offers a password setup with matching supported limits in %s',async locale=>{
  h.locale=locale;render();h.effect!();await vi.waitFor(()=>expect(find(render(),e=>e.type==='input'&&e.props.type==='password')).toBeDefined())
  const input=find(render(),e=>e.type==='input'&&e.props.type==='password')!
  expect(input.props.minLength).toBe(6);expect(input.props.maxLength).toBe(64);expect(input.props.autoComplete).toBe('new-password')
})
it('blocks duplicate confirmation clicks and accepts only the known account redirect',async()=>{
  render();h.effect!();await vi.waitFor(()=>expect(find(render(),e=>e.type==='form')).toBeDefined())
  let tree=render();find(tree,e=>e.type==='input'&&e.props.type==='password')!.props.onChange({target:{value:'SafePass123!'}})
  // Both password fields are controlled; collect the second through its different value after rerender.
  tree=render();find(tree,e=>e.type==='input'&&e.props.type==='password'&&e.props.value==='')!.props.onChange({target:{value:'SafePass123!'}})
  h.fetch.mockImplementation(async()=>response({success:true,redirectTo:'/account'}))
  const submit=find(render(),e=>e.type==='form')!.props.onSubmit
  await Promise.all([submit({preventDefault:vi.fn()}),submit({preventDefault:vi.fn()})])
  expect(h.fetch.mock.calls.filter(call=>JSON.parse(call[1].body).mode==='complete')).toHaveLength(1)
  expect(find(render(),e=>e.props.href==='/account')).toBeDefined()
})
it.each([['network',0],['rate',429],['service',503]] as const)('distinguishes %s failure from an expired link and offers retry',async(kind,status)=>{
  if(status===0)h.fetch.mockRejectedValue(Error('connection failed'))
  else h.fetch.mockResolvedValue(new Response('{}',{status,headers:status===429?{'Retry-After':'17'}:{}}))
  render();h.effect!()
  await vi.waitFor(()=>expect(find(render(),e=>e.props.role==='alert')).toBeDefined())
  const text=find(render(),e=>e.props.role==='alert')!.props.children.join(' ')
  expect(text).not.toContain('link is invalid')
  expect(text).toContain(kind==='network'?'connection':kind==='rate'?'Too many attempts':'temporarily unavailable')
  expect(find(render(),e=>e.type==='button'&&e.props.children==='Retry checking this link')).toBeDefined()
})
