import { describe, expect, it, vi } from 'vitest'
import { bindDesktopChatPanel, bindMobileChatScreen, chatViewport } from '@/lib/support/mobile-chat-screen'

function fixture(withVisualViewport=true){
 const viewport=Object.assign(new EventTarget(),{height:780,width:390,offsetTop:0,offsetLeft:0})
 const win=Object.assign(new EventTarget(),{visualViewport:withVisualViewport?viewport:null,innerHeight:800,innerWidth:390,scrollX:0,scrollY:245,scrollTo:vi.fn()})
 let active:unknown
 const control=()=>{
  const node={isConnected:true,getClientRects:()=>[{}],focus:vi.fn(()=>{active=node}),blur:vi.fn()}
  return node
 }
 const back=control(),input=control(),send=control(),trigger=control()
 active=trigger
 const root={tagName:'DIV',inert:false,contains:()=>false},existingInert={tagName:'DIV',inert:true,contains:()=>false},script={tagName:'SCRIPT',inert:false,contains:()=>false}
 const properties=new Map<string,string>()
 const messages={scrollHeight:1000,scrollTop:600,clientHeight:400}
 const panel={
  tagName:'SECTION',style:{setProperty:(key:string,value:string)=>properties.set(key,value),removeProperty:(key:string)=>properties.delete(key)},
  querySelector:(selector:string)=>selector==='input'?input:messages,
  querySelectorAll:()=>[back,input,send],contains:(node:unknown)=>[back,input,send,panel].includes(node as typeof back),
  focus:vi.fn(()=>{active=panel}),
 }
 const attrs=new Map<string,string>()
 const style={overflow:'auto',position:'',top:'',left:'',width:''}
 const doc=Object.assign(new EventTarget(),{body:{children:[root,existingInert,panel,script],style,getAttribute:(key:string)=>attrs.get(key)??null,setAttribute:(key:string,value:string)=>attrs.set(key,value),removeAttribute:(key:string)=>attrs.delete(key)},documentElement:{style:{scrollBehavior:'smooth'}}})
 Object.defineProperty(doc,'activeElement',{get:()=>active})
 const close=vi.fn()
 const key=(value:string,shiftKey=false,isComposing=false)=>{
  const event=Object.assign(new Event('keydown',{cancelable:true}),{key:value,shiftKey,isComposing})
  doc.dispatchEvent(event);return event
 }
 const mobile=()=>bindMobileChatScreen(win as unknown as Window,doc as unknown as Document,panel as unknown as HTMLElement,close)
 const desktop=()=>bindDesktopChatPanel(doc as unknown as Document,panel as unknown as HTMLElement,close)
 return {win,viewport,doc,panel,root,existingInert,script,properties,messages,back,input,send,trigger,close,key,mobile,desktop,get active(){return active}}
}
describe('mobile conversation viewport and lifecycle',()=>{
 it('uses the actual visual viewport above the keyboard, including pan offsets',()=>{
  const f=fixture();const release=f.mobile()
  expect(f.properties.get('--support-chat-height')).toBe('780px')
  f.viewport.height=340;f.viewport.offsetTop=80;f.viewport.offsetLeft=3;f.viewport.width=380
  f.viewport.dispatchEvent(new Event('resize'))
  expect(Object.fromEntries(f.properties)).toMatchObject({'--support-chat-height':'340px','--support-chat-top':'80px','--support-chat-left':'3px','--support-chat-width':'380px'})
  f.viewport.height=700;f.viewport.dispatchEvent(new Event('scroll'))
  expect(f.properties.get('--support-chat-height')).toBe('700px')
  release()
 })
 it('falls back to window sizing when visualViewport is unavailable',()=>{
  const f=fixture(false),release=f.mobile()
  expect(f.properties.get('--support-chat-height')).toBe('800px')
  f.win.innerHeight=360;f.win.dispatchEvent(new Event('resize'))
  expect(f.properties.get('--support-chat-height')).toBe('360px')
  release()
 })
 it('keeps the themed portal wrapper interactive while making the page behind it inert',()=>{
  const f=fixture(),portal={tagName:'DIV',inert:false,contains:(node:unknown)=>node===f.panel}
  f.doc.body.children.push(portal as typeof f.root)
  const release=f.mobile()
  expect(portal.inert).toBe(false);expect(f.root.inert).toBe(true)
  release();expect(portal.inert).toBe(false)
 })
 it('locks background scrolling and focus, then restores exact state and the opener',()=>{
  const f=fixture(),release=f.mobile()
  expect(f.doc.body.style).toMatchObject({position:'fixed',top:'-245px',overflow:'hidden',width:'100%'})
  expect(f.root.inert).toBe(true);expect(f.existingInert.inert).toBe(true);expect(f.script.inert).toBe(false)
  expect(f.active).toBe(f.back);expect(f.input.focus).not.toHaveBeenCalled()
  expect(f.key('Tab',true).defaultPrevented).toBe(true);expect(f.active).toBe(f.send)
  expect(f.key('Tab').defaultPrevented).toBe(true);expect(f.active).toBe(f.back)
  expect(f.key('Escape').defaultPrevented).toBe(true);expect(f.close).toHaveBeenCalledOnce()
  release()
  expect(f.root.inert).toBe(false);expect(f.existingInert.inert).toBe(true)
  expect(f.doc.body.style).toEqual({position:'',top:'',left:'',width:'',overflow:'auto'})
  expect(f.doc.body.getAttribute('data-support-chat-open')).toBeNull()
  expect(f.win.scrollTo).toHaveBeenCalledWith(0,245);expect(f.active).toBe(f.trigger)
  expect(f.doc.documentElement.style.scrollBehavior).toBe('smooth')
 })
 it('follows the latest message on keyboard changes without pulling a reader from older messages',()=>{
  const f=fixture();f.messages.scrollTop=0;const release=f.mobile()
  expect(f.messages.scrollTop).toBe(1000)
  f.messages.scrollTop=100;f.viewport.height=340;f.viewport.dispatchEvent(new Event('resize'))
  expect(f.messages.scrollTop).toBe(100)
  release()
 })
 it('removes every viewport/key listener and supports repeated mount/cleanup without stuck locks',()=>{
  const f=fixture();const one=f.mobile();one();const two=f.mobile();two()
  expect(f.properties.size).toBe(0)
  f.viewport.height=200;f.viewport.dispatchEvent(new Event('resize'));f.win.dispatchEvent(new Event('orientationchange'));f.key('Escape')
  expect(f.properties.size).toBe(0);expect(f.close).not.toHaveBeenCalled();expect(f.root.inert).toBe(false)
 })
 it('does not dismiss an IME composition and clamps transient viewport offsets',()=>{
  const f=fixture(),release=f.mobile();f.key('Escape',false,true);expect(f.close).not.toHaveBeenCalled();release()
  expect(chatViewport({visualViewport:null,innerHeight:700,innerWidth:390})).toEqual({top:0,left:0,width:390,height:700})
 })
 it('preserves desktop composer focus and Escape without mobile body locks or viewport bindings',()=>{
  const f=fixture(),release=f.desktop()
  expect(f.active).toBe(f.input);expect(f.root.inert).toBe(false);expect(f.doc.body.style.overflow).toBe('auto');expect(f.properties.size).toBe(0)
  f.key('Escape');expect(f.close).toHaveBeenCalledOnce();release();f.key('Escape');expect(f.close).toHaveBeenCalledOnce()
 })
})
