import {afterEach,beforeEach,expect,it,vi} from 'vitest'
vi.mock('react',()=>({useSyncExternalStore:(_subscribe:unknown,get:()=>unknown)=>get()}))
import {addToCart,clearCart,removeCartItems,sanitizeCartItem,useCart} from '@/lib/cart'
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
