import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ cursor: 0, slots: [] as unknown[], effects: [] as (() => unknown)[], locale: 'en', track: vi.fn(), open: vi.fn(), timer: vi.fn(() => 1) }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useEffect(effect: () => unknown) { state.effects.push(effect) },
  useState(initial: unknown) {
    const i = state.cursor++
    if (!(i in state.slots)) state.slots[i] = typeof initial === 'function' ? initial() : initial
    return [state.slots[i], (value: unknown) => { state.slots[i] = typeof value === 'function' ? value(state.slots[i]) : value }]
  },
  useRef(initial: unknown) { const i = state.cursor++; return state.slots[i] ??= { current: initial } },
}))
vi.mock('react-dom', () => ({ createPortal: (children: ReactNode) => children }))
vi.mock('@/components/locale', () => ({ useLocale: () => ({ locale: state.locale }), tx: (locale: string, copy: Record<string, string>) => copy[locale] }))
vi.mock('@/lib/admin-store', () => ({ useBrandSettings: () => ({ whatsapp: '+201288222962' }) }))
vi.mock('@/lib/tracking/tracking-events', () => ({ trackPublicInteraction: state.track }))
import { WhatsAppWidget } from '@/components/support/whatsapp-chat'

type Element = ReactElement<Record<string, any>>
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const element = node as Element
  return [element, ...elements(typeof element.props.children === 'function' ? element.props.children(false) : element.props.children)]
}
function render(open = false, onOpen = vi.fn(), onClose = vi.fn()) {
  state.cursor = 0
  return elements(WhatsAppWidget({ open, onOpen, onClose }))
}
beforeEach(() => {
  state.cursor = 0; state.slots = []; state.effects = []; state.locale = 'en'
  state.track.mockClear(); state.open.mockClear(); state.timer.mockClear()
  vi.stubGlobal('window', { open: state.open, setTimeout: state.timer })
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() })
  vi.stubGlobal('document', { getElementById: () => ({ id: 'mobile-whatsapp-trigger' }) })
})
afterEach(() => vi.unstubAllGlobals())

describe('WhatsApp widget intent measurement', () => {
  it('tracks one desktop open without treating close as contact or conversion', () => {
    const onOpen = vi.fn(), onClose = vi.fn()
    render(false, onOpen, onClose).find(n => n.props.className === 'wa-fab')!.props.onClick()
    expect(onOpen).toHaveBeenCalledOnce()
    expect(state.track.mock.calls).toEqual([[{ event: 'sp_whatsapp_open', placement: 'support_widget' }]])
    render(true, onOpen, onClose).find(n => n.props.className === 'wa-fab')!.props.onClick()
    expect(onClose).toHaveBeenCalledOnce()
    expect(state.track).toHaveBeenCalledOnce()
    expect(state.open).not.toHaveBeenCalled()
  })
  it('tracks the mobile portal trigger through the same open handler', () => {
    render()
    state.effects[0]()
    render().find(n => n.props.className === 'mobile-support-trigger')!.props.onClick()
    expect(state.track.mock.calls).toEqual([[{ event: 'sp_whatsapp_open', placement: 'support_widget' }]])
  })
  it.each(['en', 'es', 'it'])('hands off synchronously and measures only safe contact intent in %s', locale => {
    state.locale = locale
    const privateText = 'Fixture visitor person@example.test +12025550123 notes'
    render(true).find(n => n.type === 'input')!.props.onChange({ target: { value: privateText } })
    const preventDefault = vi.fn()
    render(true).find(n => n.type === 'form')!.props.onSubmit({ preventDefault })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(state.open).toHaveBeenCalledExactlyOnceWith(`https://wa.me/201288222962?text=${encodeURIComponent(privateText)}`, '_blank', 'noopener')
    expect(state.timer).not.toHaveBeenCalled()
    expect(state.track.mock.calls).toEqual([[{ event: 'sp_contact_click', channel: 'whatsapp', placement: 'support_widget' }]])
    expect(JSON.stringify(state.track.mock.calls)).not.toContain(privateText)
    expect(render(true).find(n => n.type === 'input')!.props.value).toBe('')
  })
  it('does not open WhatsApp or measure an empty submission', () => {
    render(true).find(n => n.type === 'input')!.props.onChange({ target: { value: '   ' } })
    render(true).find(n => n.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() })
    expect(state.track).not.toHaveBeenCalled()
    expect(state.open).not.toHaveBeenCalled()
  })
})
