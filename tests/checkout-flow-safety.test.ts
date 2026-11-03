import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import type { CartItem } from '@/lib/cart'
import type { Tour } from '@/data/types'
import type { AuthenticatedUser } from '@/lib/auth-types'

const harness=vi.hoisted(()=>({index:0,values:[] as unknown[],items:[] as CartItem[],user:null as AuthenticatedUser|null,fetch:vi.fn(),remove:vi.fn(),finish:vi.fn(),key:vi.fn()}))
vi.mock('@/lib/use-current-user',()=>({useCurrentUser:()=>({user:harness.user,loading:false})}))
vi.mock('react',async()=>{
  const actual=await vi.importActual<typeof import('react')>('react')
  return {...actual,useState:(initial:unknown)=>{const index=harness.index++;if(!(index in harness.values))harness.values[index]=typeof initial==='function'?initial():initial;return[harness.values[index],(next:unknown)=>{harness.values[index]=typeof next==='function'?next(harness.values[index]):next}]},useRef:(initial:unknown)=>{const index=harness.index++;if(!(index in harness.values))harness.values[index]={current:initial};return harness.values[index]}}
})
vi.mock('@/lib/cart',()=>({useCart:()=>({items:harness.items}),removeCartItems:harness.remove,clearCart:vi.fn(),removeFromCart:vi.fn(),removeCartAddons:vi.fn()}))
vi.mock('@/lib/checkout-attempt',()=>({checkoutAttemptKey:harness.key,finishCheckoutAttempt:harness.finish}))
vi.mock('@/components/locale',async()=>({...await vi.importActual<typeof import('@/components/locale')>('@/components/locale'),useLocale:()=>({locale:'en',currency:'USD'})}))
vi.mock('@/lib/cart-catalogue',async()=>{
  const {estimateCart}=await import('@/lib/booking')
  const tour:Tour={slug:'db-only',status:'published',category:'one-day-tours',title:'DB only',price:100,summary:'',image:'',location:'Cairo',duration:'Full day',dayDetail:{overview:[],addOns:[],travelerPrices:[{travelers:2,adultPrice:100,childPrice:0,infantPrice:0}]}}
  return {useCartCatalogue:()=>({ready:true,error:null,retry:vi.fn(),estimate:estimateCart(harness.items,[tour])})}
})
import { CheckoutPage } from '@/components/checkout-page'
function render(){harness.index=0;return CheckoutPage()}
function find(node:ReactNode,test:(element:ReactElement<Record<string,any>>)=>boolean):ReactElement<Record<string,any>>|undefined {
  if(Array.isArray(node)){for(const child of node){const result=find(child,test);if(result)return result}return}
  if(!node||typeof node!=='object'||!('props'in node))return
  const element=node as ReactElement<Record<string,any>>
  return test(element)?element:find(element.props.children,test)
}
function contact(){let tree=render();find(tree,e=>e.props.autoComplete==='name')!.props.onChange({target:{value:'Test Customer'}});find(tree,e=>e.props.autoComplete==='email')!.props.onChange({target:{value:'test@example.com'}});find(tree,e=>e.props.invalid===false&&typeof e.props.onChange==='function'&&e.props.locale==='en')!.props.onChange('+201234567890');return render()}
const response=(data:unknown,status=201)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}})
beforeEach(()=>{vi.clearAllMocks();harness.index=0;harness.values=[];harness.user=null;harness.items=[{key:'submitted',tourSlug:'db-only',title:'DB only',date:'',adults:2,children:0,infants:0,addons:[],image:'',adultUnit:999,childUnit:999,infantUnit:999,addonTotal:0,total:999}];harness.key.mockResolvedValue('stable-attempt-key');vi.stubGlobal('fetch',harness.fetch)})
afterEach(()=>vi.unstubAllGlobals())
const signedInUser=():AuthenticatedUser=>({publicId:'customer-public-id',email:' test@example.com ',firstName:' Test ',lastName:'Customer ',username:'test',countryCode:'EG',phone:' +201234567890 ',status:'ACTIVE',emailVerifiedAt:null,lastLoginAt:null,roles:['CUSTOMER'],permissions:[]})
function fields(tree:ReactNode){return {name:find(tree,e=>e.props.autoComplete==='name')!,email:find(tree,e=>e.props.autoComplete==='email')!,phone:find(tree,e=>e.props.invalid===false&&typeof e.props.onChange==='function'&&e.props.locale==='en')!}}
it('prefills current account contact data and submits it as editable contact, never ownership',async()=>{
  harness.user=signedInUser()
  const tree=render(),inputs=fields(tree)
  expect([inputs.name.props.value,inputs.email.props.value,inputs.phone.props.value]).toEqual(['Test Customer','test@example.com','+201234567890'])
  harness.fetch.mockResolvedValue(response({reference:'SP-BK-ABC123',total:200,guest:false,guestAccessUrl:null}))
  await find(tree,e=>e.type==='form')!.props.onSubmit({preventDefault:vi.fn()})
  const sent=JSON.parse(harness.fetch.mock.calls[0][1].body)
  expect(sent.contact).toEqual({name:'Test Customer',email:'test@example.com',phone:'+201234567890'})
  expect(sent).not.toHaveProperty('userId');expect(sent).not.toHaveProperty('publicId')
})
it('fills untouched fields when account data arrives late without replacing a typed name',()=>{
  fields(render()).name.props.onChange({target:{value:'Different passenger'}})
  harness.user=signedInUser()
  const inputs=fields(render())
  expect([inputs.name.props.value,inputs.email.props.value,inputs.phone.props.value]).toEqual(['Different passenger','test@example.com','+201234567890'])
})
it('preserves edits and explicit clearing after account data refresh',()=>{
  harness.user=signedInUser();const inputs=fields(render())
  inputs.name.props.onChange({target:{value:''}})
  inputs.email.props.onChange({target:{value:'other@example.com'}})
  inputs.phone.props.onChange('+441234567890')
  harness.user={...signedInUser(),firstName:'Refreshed',email:'refreshed@example.com',phone:'+201111111111'}
  const next=fields(render())
  expect([next.name.props.value,next.email.props.value,next.phone.props.value]).toEqual(['','other@example.com','+441234567890'])
})
it('keeps guest fields blank and never reads a previous locally stored profile',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({fullName:'Previous visitor',email:'old@example.com'})})
  const inputs=fields(render())
  expect([inputs.name.props.value,inputs.email.props.value,inputs.phone.props.value]).toEqual(['','',''])
})
it('handles missing account names and phone without fabricating values',()=>{
  harness.user={...signedInUser(),firstName:null,lastName:null,phone:null}
  const inputs=fields(render())
  expect([inputs.name.props.value,inputs.email.props.value,inputs.phone.props.value]).toEqual(['','test@example.com',''])
})
it('sends selections only, synchronously blocks duplicate clicks and removes only the submitted cart keys',async()=>{
  const tree=contact(),submit=find(tree,e=>e.type==='form')!.props.onSubmit
  let resolve!:(response:Response)=>void;harness.fetch.mockReturnValue(new Promise<Response>(yes=>{resolve=yes}))
  const first=submit({preventDefault:vi.fn()}),duplicate=submit({preventDefault:vi.fn()})
  await vi.waitFor(()=>expect(harness.fetch).toHaveBeenCalledTimes(1))
  const sent=JSON.parse(harness.fetch.mock.calls[0][1].body)
  expect(sent.lines[0]).toEqual({tourSlug:'db-only',date:'',adults:2,children:0,infants:0,addons:[]})
  expect(sent).not.toHaveProperty('total');expect(sent).not.toHaveProperty('userId')
  harness.items=[...harness.items,{...harness.items[0],key:'new-selection'}]
  resolve(response({reference:'SP-BK-ABC123',total:200,guest:true,guestAccessUrl:'/booking/'+'a'.repeat(43)}));await Promise.all([first,duplicate])
  expect(harness.remove).toHaveBeenCalledExactlyOnceWith(['submitted']);expect(harness.finish).toHaveBeenCalledExactlyOnceWith('stable-attempt-key')
})
it('retains the cart and retry identity after a lost response',async()=>{
  harness.fetch.mockRejectedValue(Error('network lost'))
  await find(contact(),e=>e.type==='form')!.props.onSubmit({preventDefault:vi.fn()})
  expect(harness.remove).not.toHaveBeenCalled();expect(harness.finish).not.toHaveBeenCalled()
  harness.fetch.mockResolvedValue(response({reference:'SP-BK-ABC123',total:200,guest:true,guestAccessUrl:null},200))
  await find(render(),e=>e.type==='form')!.props.onSubmit({preventDefault:vi.fn()})
  expect(harness.fetch).toHaveBeenCalledTimes(2)
  const first=JSON.parse(harness.fetch.mock.calls[0][1].body),second=JSON.parse(harness.fetch.mock.calls[1][1].body)
  expect(second.idempotencyKey).toBe(first.idempotencyKey)
  expect(harness.fetch.mock.calls.some(call=>String(call[0]).includes('/api/account/'))).toBe(false)
  const tree=render(),button=find(tree,e=>e.type==='button'&&typeof e.props.onClick==='function')!
  harness.fetch.mockResolvedValue(response({accepted:true},200));await button.props.onClick()
  expect(harness.fetch.mock.lastCall![0]).toBe('/api/bookings/request-access')
  expect(JSON.parse(harness.fetch.mock.lastCall![1].body)).toEqual({reference:'SP-BK-ABC123',email:'test@example.com'})
})
it('does not clear selections on malformed successful responses or display an untrusted private URL',async()=>{
  harness.fetch.mockResolvedValue(response({reference:'invalid',total:200,guest:true,guestAccessUrl:'https://evil.example/'}))
  await find(contact(),e=>e.type==='form')!.props.onSubmit({preventDefault:vi.fn()})
  expect(harness.remove).not.toHaveBeenCalled();expect(harness.finish).not.toHaveBeenCalled()
  harness.fetch.mockResolvedValue(response({reference:'SP-BK-ABC123',total:200,guest:true,guestAccessUrl:'https://evil.example/'}))
  await find(render(),e=>e.type==='form')!.props.onSubmit({preventDefault:vi.fn()})
  expect(find(render(),e=>e.props.href==='https://evil.example/')).toBeUndefined()
})
it('uses authoritative account ownership without a second read that could fail after the booking commits',async()=>{
  harness.fetch.mockResolvedValue(response({reference:'SP-BK-ABC123',total:200,guest:false,guestAccessUrl:null}))
  await find(contact(),e=>e.type==='form')!.props.onSubmit({preventDefault:vi.fn()})
  expect(harness.fetch).toHaveBeenCalledTimes(1)
  expect(find(render(),e=>e.props.href==='/account/bookings/detail?ref=SP-BK-ABC123')).toBeDefined()
})
