import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import postcss from 'postcss'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InitialLocaleProvider, LocaleProvider } from '@/components/locale'
import { LiveChatWidget } from '@/components/support/live-chat'
import { WhatsAppWidget } from '@/components/support/whatsapp-chat'

const state=vi.hoisted(()=>({mobile:true}))
// Exercise the real widget content for both presentations without a browser.
// Portal/focus/keyboard lifecycle is tested directly in mobile-chat-screen.test.
vi.mock('@/components/support/support-chat-panel',()=>({SupportChatPanel:({className,label,children}:{className:string;label:string;children:(mobile:boolean)=>React.ReactNode})=>createElement('section',{className:className+' support-chat-screen',role:'dialog','aria-label':label,'aria-modal':state.mobile},children(state.mobile))}))
vi.mock('@/lib/tours/tours-client',()=>({useDbTours:()=>[]}))
beforeEach(()=>{state.mobile=true;vi.stubGlobal('fetch',vi.fn(()=>{throw Error('Rendering chat must not send messages or write the database')}))})
afterEach(()=>vi.unstubAllGlobals())

function render(channel:'live'|'wa',locale:'en'|'es'|'it'='en'){
 const Component=channel==='live'?LiveChatWidget:WhatsAppWidget
 return renderToStaticMarkup(createElement(InitialLocaleProvider,{locale,preview:true,children:createElement(LocaleProvider,{children:createElement(Component,{open:true,onOpen:vi.fn(),onClose:vi.fn()})})}))
}
describe('existing chats presented as mobile conversation screens',()=>{
 it.each(['live','wa'] as const)('renders %s with mobile dialog semantics and a back button',channel=>{
  const html=render(channel)
  expect(html).toContain('aria-modal="true"')
  expect(html).toContain('aria-label="Back to page"')
  expect(html).toContain('support-chat-screen')
  expect(html).toContain('maxLength="500"')
  expect(html).toContain('aria-live="polite"')
  expect(fetch).not.toHaveBeenCalled()
 })
 it.each([['es','Volver a la página'],['it','Torna alla pagina']] as const)('retains %s labels for both channels', (locale,label)=>{
  expect(render('live',locale)).toContain(label);expect(render('wa',locale)).toContain(label)
 })
 it('retains the WhatsApp handoff explanation rather than suggesting a new in-site WhatsApp backend',()=>{
  expect(render('wa')).toContain('Pressing send opens WhatsApp with your message ready.')
 })
 it('preserves desktop close controls and nonmodal floating semantics',()=>{
  state.mobile=false
  expect(render('live')).toContain('aria-label="Close live chat"')
  expect(render('wa')).toContain('aria-label="Close WhatsApp chat"')
  expect(render('live')).toContain('aria-modal="false"')
  expect(render('wa')).not.toContain('Back to page')
 })
 it('uses the same shared panel without changing routes or duplicating widget state',()=>{
  const panel=readFileSync('components/support/support-chat-panel.tsx','utf8')
  expect(panel).toContain('createPortal(<PublicAppearancePortal>')
  expect(panel).toContain('bindMobileChatScreen(window,document,panel.current')
  expect(panel).toContain('bindDesktopChatPanel(document,panel.current')
  expect(panel).not.toMatch(/fetch\(|localStorage|pushState|router\./)
 })
 it('keeps full-screen rules inside the existing mobile breakpoint and overrides old floating bounds',()=>{
  const css=postcss.parse(readFileSync('app/mobile-shell.css','utf8'))
  let found=false
  css.walkRules(rule=>{
   if(rule.selector!=='body .support-chat-screen:is(.livechat-panel,.wa-panel)')return
   expect(rule.parent?.type).toBe('atrule')
   expect((rule.parent as postcss.AtRule).params).toBe('screen and (max-width:1024px)')
   const values:Record<string,string>={};rule.walkDecls(d=>{values[d.prop]=d.value})
   expect(values).toMatchObject({height:'var(--support-chat-height,100dvh)',width:'var(--support-chat-width,100%)','min-height':'0',bottom:'auto','border-radius':'0',animation:'none'})
   found=true
  })
  expect(found).toBe(true)
 })
})
