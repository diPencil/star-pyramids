import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { checkoutAttemptKey, finishCheckoutAttempt } from '@/lib/checkout-attempt'
import { addToCart, cartKey, clearCart, removeCartAddons, removeCartItems, sanitizeCartItem } from '@/lib/cart'
import type { BookingCheckoutDraft } from '@/lib/booking'
const stored = new Map<string,string>()
const storage={getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value),removeItem:(key:string)=>stored.delete(key)}
const intent:Omit<BookingCheckoutDraft,'idempotencyKey'>={lines:[{tourSlug:'current-tour',date:'',adults:2,children:0,infants:0,addons:['Ticket','Transfer']}],contact:{name:'Test Customer',email:'test@example.com',phone:'+201234567890'},notes:'A note',currency:'USD'}
beforeEach(()=>{stored.clear();vi.stubGlobal('window',{sessionStorage:storage});vi.stubGlobal('localStorage',storage);clearCart()})
afterEach(()=>vi.unstubAllGlobals())
it('migrates a pre-consent fingerprint without replacing its unresolved key',async()=>{
  const lines=[{...intent.lines[0],tourSlug:'legacy-migration-test',addons:[...intent.lines[0].addons].sort()}]
  const oldIntent={lines,contact:{name:intent.contact.name,email:intent.contact.email,phone:intent.contact.phone},notes:intent.notes,currency:'USD'}
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(oldIntent)))
  const fingerprint=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')
  storage.setItem('sp-checkout-key',JSON.stringify({attempts:[{fingerprint,key:'legacy-migration-key'}]}))
  const key=await checkoutAttemptKey({...intent,lines,acceptedTerms:true})
  expect(key).toBe('legacy-migration-key');finishCheckoutAttempt(key)
})
it('reuses retries and normalizes order/email/phone without persisting raw contact information',async()=>{
  const key=await checkoutAttemptKey(intent)
  expect(await checkoutAttemptKey({...intent,contact:{...intent.contact,email:'TEST@EXAMPLE.COM',phone:'+20 1234567890'},lines:[{...intent.lines[0],addons:['Transfer','Ticket']}]})).toBe(key)
  const json=JSON.stringify([...stored]);expect(json).not.toContain('test@example.com');expect(json).not.toContain('Test Customer');expect(json).not.toContain('A note')
  finishCheckoutAttempt(key)
})
it('uses a new attempt when the customer edits contact, notes or actual selections',async()=>{
  const first=await checkoutAttemptKey(intent),second=await checkoutAttemptKey({...intent,notes:'Different request'})
  expect(second).not.toBe(first)
  expect(await checkoutAttemptKey({...intent,notes:'Different request'})).toBe(second)
  expect(await checkoutAttemptKey(intent)).toBe(first)
  finishCheckoutAttempt(first)
  expect(await checkoutAttemptKey({...intent,notes:'Different request'})).toBe(second)
  finishCheckoutAttempt(second)
})
it('preserves a legacy attempt during upgrade so a previously lost response is not duplicated',async()=>{
  storage.setItem('sp-checkout-key','legacy-attempt-key')
  expect(await checkoutAttemptKey(intent)).toBe('legacy-attempt-key');finishCheckoutAttempt('legacy-attempt-key')
})
it('keeps retry identity when sessionStorage is denied',async()=>{
  vi.stubGlobal('window',{sessionStorage:{getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')}}})
  const key=await checkoutAttemptKey({...intent,notes:'Storage blocked'})
  expect(await checkoutAttemptKey({...intent,notes:'Storage blocked'})).toBe(key);finishCheckoutAttempt(key)
})
const item=(addons:string[]=[])=>sanitizeCartItem({tourSlug:'current-tour',title:'Current',date:'',adults:2,children:0,infants:0,addons})!
it('keeps the same retry key regardless of object property insertion order',async()=>{
  const key=await checkoutAttemptKey(intent)
  const reordered={addons:['Transfer','Ticket'],infants:0,children:0,adults:2,date:'',tourSlug:'current-tour'}
  expect(await checkoutAttemptKey({...intent,lines:[reordered]})).toBe(key)
  finishCheckoutAttempt(key)
})
it('treats addon order/duplicates as the same selection but never collides delimiter-containing addon names',()=>{
  expect(cartKey(item(['A','B']))).toBe(cartKey(item(['B','A','A'])))
  expect(cartKey(item(['A+B']))).not.toBe(cartKey(item(['A','B'])))
})
it('clears submitted selections while preserving a new selection added by another tab during submission',()=>{
  const submitted=item();addToCart(submitted)
  const other=sanitizeCartItem({...item(),tourSlug:'another-tour'})!
  const key=[...stored.keys()].find(key=>key!=='sp-checkout-key')!
  storage.setItem(key,JSON.stringify([submitted,other]))
  removeCartItems([submitted.key])
  expect(JSON.parse(storage.getItem(key)!)).toEqual([other])
})
it('removes only unavailable extras and merges an identical existing configuration',()=>{
  const selected=item(['Ticket','Removed']),existing=item(['Ticket']);addToCart(selected);addToCart(existing)
  removeCartAddons(selected.key,['Removed'])
  const key=[...stored.keys()].find(key=>key!=='sp-checkout-key')!
  const values=JSON.parse(storage.getItem(key)!);expect(values).toHaveLength(1);expect(values[0].addons).toEqual(['Ticket'])
})
