import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const h=vi.hoisted(()=>({slots:[] as any[],cursor:0,effects:[] as {deps:unknown[];cleanup?:()=>void}[],effect:0,queued:[] as (()=>void)[],fetch:vi.fn()}))
vi.mock('react',async()=>{const actual=await vi.importActual<typeof import('react')>('react');return{...actual,
useState:(initial:any)=>{const slot=h.cursor++;if(!(slot in h.slots))h.slots[slot]=typeof initial==='function'?initial():initial;return[h.slots[slot],(next:any)=>{h.slots[slot]=typeof next==='function'?next(h.slots[slot]):next}]},
useRef:(initial:any)=>{const slot=h.cursor++;if(!(slot in h.slots))h.slots[slot]={current:initial};return h.slots[slot]},
useId:()=> 'review-text-hint',
useEffect:(callback:()=>void|(()=>void),deps:unknown[])=>{const index=h.effect++,old=h.effects[index];if(!old||deps.some((value,i)=>value!==old.deps[i])){h.queued.push(()=>{old?.cleanup?.();h.effects[index]={deps,cleanup:callback()||undefined}})}}
}})
vi.mock('react-dom',()=>({createPortal:(children:ReactNode)=>children}))
vi.mock('@/components/locale',()=>({useLocale:()=>({locale:'en'}),tx:(_locale:string,value:{en:string})=>value.en}))
import { ReviewWriteModal, type ReviewModalCopy } from '@/components/reviews'
type Element=ReactElement<Record<string,any>>
const copy:ReviewModalCopy={heading:'Write a review',reviewTitle:'Title',reviewTitlePh:'Title',rating:'Rating',review:'Your review',reviewPh:'Your experience',cancel:'Cancel',submit:'Submit review'}
const submitted=vi.fn(),closed=vi.fn()
let currentProps:{copy:ReviewModalCopy;tourSlug?:string;onSubmit:typeof submitted;onClose:typeof closed}
let doc:EventTarget&{body:{style:{overflow:string}};activeElement:FakeElement|null}
class FakeElement { tabIndex=0; focus=vi.fn(()=>{doc.activeElement=this}) }
let textarea:FakeElement,other:FakeElement,previous:FakeElement
const dialogNode={focus:vi.fn(),querySelector:vi.fn(),querySelectorAll:vi.fn()}
function nodes(node:ReactNode):Element[]{return Children.toArray(node).flatMap(child=>isValidElement(child)?[child as Element,...nodes((child as Element).props.children)]:[])}
function render(){h.cursor=0;h.effect=0;const tree=ReviewWriteModal(currentProps);const dialog=nodes(tree).find(node=>node.props.role==='dialog');if(dialog)dialog.props.ref.current=dialogNode;while(h.queued.length)h.queued.shift()!();return tree}
function mount(){render();return render()}
function text(tree:ReactNode,value:string){const field=nodes(tree).find(node=>node.type==='textarea')!;field.props.onChange({target:{value}});return render()}
const form=(tree:ReactNode)=>nodes(tree).find(node=>node.type==='form')!
beforeEach(()=>{vi.clearAllMocks();h.slots=[];h.effects=[];h.queued=[];h.cursor=0;h.effect=0;currentProps={copy,tourSlug:'@website',onSubmit:submitted,onClose:closed};doc=Object.assign(new EventTarget(),{body:{style:{overflow:''}},activeElement:null as FakeElement|null});previous=new FakeElement();textarea=new FakeElement();other=new FakeElement();doc.activeElement=previous;vi.stubGlobal('document',doc);vi.stubGlobal('HTMLElement',FakeElement);vi.stubGlobal('fetch',h.fetch);dialogNode.querySelector.mockReturnValue(textarea);dialogNode.querySelectorAll.mockReturnValue([textarea,other])})
afterEach(()=>{h.effects.forEach(effect=>effect.cleanup?.());vi.unstubAllGlobals()})
it('focuses the writing field once and does not steal focus when parent close callbacks change',()=>{
 let tree=mount();expect(textarea.focus).toHaveBeenCalledTimes(1);tree=text(tree,'A genuine experience');other.focus();const newClose=vi.fn();currentProps={...currentProps,onClose:newClose};tree=render();expect(doc.activeElement).toBe(other);expect(textarea.focus).toHaveBeenCalledTimes(1);expect(nodes(tree).find(node=>node.type==='textarea')!.props.value).toBe('A genuine experience');doc.dispatchEvent(Object.assign(new Event('keydown'),{key:'Escape'}));expect(newClose).toHaveBeenCalledTimes(1);expect(closed).not.toHaveBeenCalled()
})
it('shows actionable short-text validation rather than silently disabling submission',async()=>{
 let tree=text(mount(),'short');expect(nodes(tree).find(node=>node.type==='button'&&node.props.type==='submit')!.props.disabled).toBe(false);await form(tree).props.onSubmit({preventDefault:vi.fn()});tree=render();expect(nodes(tree).some(node=>node.props.role==='alert')).toBe(true);expect(h.fetch).not.toHaveBeenCalled();expect(nodes(tree).find(node=>node.type==='textarea')!.props['aria-describedby']).toBe('review-text-hint')
})
it('submits a real website review to the API and calls success only after acceptance',async()=>{
 let tree=text(mount(),'This was a wonderful experience.');h.fetch.mockResolvedValue(Response.json({review:{status:'PENDING'}},{status:201}));await form(tree).props.onSubmit({preventDefault:vi.fn()});await new Promise(resolve=>setTimeout(resolve,0));expect(h.fetch).toHaveBeenCalledWith('/api/reviews',expect.objectContaining({method:'POST',credentials:'same-origin',body:JSON.stringify({scope:'website',rating:5,title:'',text:'This was a wonderful experience.'})}));expect(submitted).toHaveBeenCalledTimes(1)
})
it('preserves typed text on authentication failure and offers sign-in instead of false success',async()=>{
 let tree=text(mount(),'Please keep my review text.');h.fetch.mockResolvedValue(Response.json({error:'Authentication required.'},{status:401}));await form(tree).props.onSubmit({preventDefault:vi.fn()});await new Promise(resolve=>setTimeout(resolve,0));tree=render();expect(submitted).not.toHaveBeenCalled();expect(nodes(tree).find(node=>node.type==='textarea')!.props.value).toBe('Please keep my review text.');expect(nodes(tree).find(node=>node.type==='a')!.props.href).toBe('/login?next=%2F%23reviews')
})
it('keeps tour submissions associated with their tour and returns login to that review section',async()=>{
 currentProps.tourSlug='public-tour';let tree=text(mount(),'A great tour experience.');h.fetch.mockResolvedValue(Response.json({error:'Authentication required.'},{status:401}));await form(tree).props.onSubmit({preventDefault:vi.fn()});await new Promise(resolve=>setTimeout(resolve,0));tree=render();expect(JSON.parse(h.fetch.mock.calls[0][1].body).tourSlug).toBe('public-tour');expect(nodes(tree).find(node=>node.type==='a')!.props.href).toBe('/login?next=%2Fegypt-tours%2Fpublic-tour%23reviews')
})
it('does not fall back to fake local success when no tour slug is supplied',async()=>{
 currentProps.tourSlug=undefined;let tree=text(mount(),'Website feedback to moderate.');h.fetch.mockResolvedValue(Response.json({error:'Unavailable'},{status:503}));await form(tree).props.onSubmit({preventDefault:vi.fn()});await new Promise(resolve=>setTimeout(resolve,0));expect(h.fetch).toHaveBeenCalledTimes(1);expect(JSON.parse(h.fetch.mock.calls[0][1].body).scope).toBe('website');expect(submitted).not.toHaveBeenCalled()
})

it('keeps reverse keyboard traversal inside the modal when inactive stars have tabIndex -1',()=>{
 const inactiveStar=new FakeElement();inactiveStar.tabIndex=-1;const activeStar=new FakeElement();const lastButton=new FakeElement()
 dialogNode.querySelectorAll.mockReturnValue([inactiveStar,activeStar,textarea,lastButton]);mount();activeStar.focus()
 const event=Object.assign(new Event('keydown',{cancelable:true}),{key:'Tab',shiftKey:true});doc.dispatchEvent(event)
 expect(event.defaultPrevented).toBe(true);expect(doc.activeElement).toBe(lastButton)
})

it('prevents Tab escaping when all controls are disabled during a pending submission',()=>{
 dialogNode.querySelectorAll.mockReturnValue([]);mount()
 const event=Object.assign(new Event('keydown',{cancelable:true}),{key:'Tab',shiftKey:false});doc.dispatchEvent(event)
 expect(event.defaultPrevented).toBe(true);expect(dialogNode.focus).toHaveBeenCalledTimes(1)
})
