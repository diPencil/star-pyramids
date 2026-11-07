import {afterEach,beforeEach,expect,it,vi} from 'vitest'
vi.mock('react',()=>({useSyncExternalStore:(_subscribe:unknown,get:()=>unknown)=>get()}))
vi.mock('@/lib/booking-funnel',()=>({recordCartAddition:vi.fn()}))
import {addToCart,clearCart,removeCartItems,sanitizeCartItem,useCart} from '@/lib/cart'
import {recordCartAddition} from '@/lib/booking-funnel'
import {customerErrorText} from '@/lib/customer-error-copy'
it.each(['en','es','it'] as const)('localizes the cart capacity failure in %s',locale=>{
  const text=customerErrorText(locale,'Your cart can contain at most 20 trip selections. Remove a selection before adding another.','fallback')
  expect(text).not.toBe('fallback');expect(text).toContain('20')
})
const values=new Map<string,string>()
const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}}
beforeEach(()=>{values.clear();vi.stubGlobal('window',{});vi.stubGlobal('localStorage',storage);clearCart()})
afterEach(()=>vi.unstubAllGlobals())
const item=(slug:string)=>sanitizeCartItem({tourSlug:slug,title:slug,date:'',adults:2,children:0,infants:0,addons:[]})!
it('preserves unsaved in-memory selections when reads succeed but writes are denied',()=>{
  vi.stubGlobal('localStorage',{...storage,setItem:()=>{throw Error('quota exceeded')}})
  const first=item('first'),second=item('second')
  addToCart(first);addToCart(second)
  expect(useCart().items.map(line=>line.tourSlug)).toEqual(['first','second'])
  removeCartItems([first.key])
  expect(useCart().items.map(line=>line.tourSlug)).toEqual(['second'])
})
it('rejects a twenty-first configuration before mutating or persisting the cart',()=>{
  vi.mocked(recordCartAddition).mockClear()
  for(let i=0;i<20;i++)addToCart(item(`trip-${i}`))
  const before=JSON.stringify(useCart().items)
  expect(()=>addToCart(item('overflow'))).toThrow(/20/)
  expect(JSON.stringify(useCart().items)).toBe(before)
  expect(JSON.parse([...values.values()][0])).toHaveLength(20)
  expect(()=>addToCart(item('trip-0'))).not.toThrow() // replacing an identical configuration remains possible
  expect(recordCartAddition).toHaveBeenCalledTimes(20)
})
it('persists the complete in-memory cart after storage becomes writable again',()=>{
  vi.stubGlobal('localStorage',{...storage,setItem:()=>{throw Error('quota exceeded')}})
  addToCart(item('first'));addToCart(item('second'))
  vi.stubGlobal('localStorage',storage)
  addToCart(item('third'))
  const saved=JSON.parse([...values.values()][0])
  expect(saved.map((line:{tourSlug:string})=>line.tourSlug)).toEqual(['first','second','third'])
  removeCartItems([item('second').key])
  expect(useCart().items.map(line=>line.tourSlug)).toEqual(['first','third'])
})
