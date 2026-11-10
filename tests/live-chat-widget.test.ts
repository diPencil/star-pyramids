import type { ReactElement, ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ index: 0, values: [] as unknown[], locale: 'en' as 'en' | 'es' | 'it', chat: { thread: null as any, error: false, errorCode: null as 'preview_read_only' | null, busy: false, send: vi.fn() } }))
const tracking = vi.hoisted(() => ({ event: vi.fn() }))
vi.mock('@/lib/tracking/tracking-events', () => ({ trackPublicInteraction: tracking.event }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useEffect: vi.fn(),
  useState(initial: unknown) { const i = state.index++; if (!(i in state.values)) state.values[i] = initial; return [state.values[i], (v: unknown) => { state.values[i] = v }] },
  useRef(initial: unknown) { const i = state.index++; return state.values[i] ??= { current: initial } },
}))
vi.mock('@/components/locale', () => ({ useLocale: () => ({ locale: state.locale }), tx: (locale: string, values: Record<string, string>) => values[locale] }))
vi.mock('@/lib/admin-store', () => ({ useBrandSettings: () => ({ whatsapp: '+12025550123' }) }))
vi.mock('@/lib/support/live-chat-client', () => ({ useLiveChat: () => state.chat }))
import { LiveChatWidget } from '@/components/support/live-chat'
type Element = ReactElement<Record<string, any>>
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const el = node as Element
  return [el, ...elements(typeof el.props.children === 'function' ? el.props.children(false) : el.props.children)]
}
function render() { state.index = 0; return elements(LiveChatWidget({ open: true, onOpen: vi.fn(), onClose: vi.fn() })) }
function button(nodes: Element[], label: string) { return nodes.find(n => n.type === 'button' && n.props.children === label)! }
beforeEach(() => { state.index = 0; state.values = []; state.locale = 'en'; state.chat.thread = null; state.chat.busy = false; state.chat.error = false; state.chat.errorCode = null; state.chat.send.mockReset() })
it('requests the live catalogue from the All trips chip instead of a fixed cruise answer', async () => {
  state.chat.send.mockResolvedValue(true)
  button(render(), 'All trips').props.onClick()
  await vi.waitFor(() => expect(state.chat.send).toHaveBeenCalledWith({ action: 'message', body: 'All trips', locale: 'en' }))
  expect(button(render(), 'Nile cruise prices')).toBeUndefined()
})
it('measures the live chat WhatsApp link as contact intent without sending guest text', () => {
  tracking.event.mockClear()
  state.chat.thread = { messages: [{ senderRole: 'customer', body: 'WhatsApp person@example.test' }], agentRequested: false }
  render().find(node => node.type === 'a' && node.props.href.startsWith('https://wa.me/'))!.props.onClick()
  expect(tracking.event.mock.calls).toEqual([[{ event: 'sp_contact_click', channel: 'whatsapp', placement: 'support_widget' }]])
  expect(state.chat.send).not.toHaveBeenCalled()
})
it('explains an actual preview restriction instead of suggesting a connectivity failure', () => {
  state.chat.error = true; state.chat.errorCode = 'preview_read_only'
  const alert = render().find(node => node.props.role === 'alert')!
  expect(alert.props.children).toContain('Exit customer preview')
  expect(alert.props.children).not.toContain('wait for reconnection')
})
it('opens an inline handoff form without claiming delivery, and retains it on failure', async () => {
  button(render(), 'Talk to an agent').props.onClick()
  let nodes = render()
  expect(state.chat.send).not.toHaveBeenCalled()
  expect(nodes.filter(n => n.type === 'input' && n.props.required)).toHaveLength(2)
  nodes.find(n => n.type === 'input' && n.props.autoComplete === 'name')!.props.onChange({ target: { value: 'Fixture Guest' } })
  nodes.find(n => n.type === 'input' && n.props.type === 'tel')!.props.onChange({ target: { value: '+12025550123' } })
  state.chat.send.mockResolvedValue(false)
  nodes = render()
  const form = nodes.find(n => n.type === 'form' && elements(n.props.children).some(c => c.type === 'h3'))!
  form.props.onSubmit({ preventDefault: vi.fn() })
  await vi.waitFor(() => expect(state.chat.send).toHaveBeenCalledWith({ action: 'handoff', body: '', name: 'Fixture Guest', phone: '+12025550123', locale: 'en' }))
  expect(render().some(n => n.type === 'input' && n.props.value === 'Fixture Guest')).toBe(true)
  state.chat.send.mockResolvedValue(true)
  form.props.onSubmit({ preventDefault: vi.fn() })
  await vi.waitFor(() => expect(render().some(n => n.type === 'input' && n.props.autoComplete === 'name')).toBe(false))
  expect(render().some(n => n.props.role === 'status')).toBe(true)
})
it('clears a message draft only after confirmed persistence', async () => {
  render().find(n => n.type === 'input' && n.props.maxLength === 500)!.props.onChange({ target: { value: 'Unsent fixture' } })
  state.chat.send.mockResolvedValue(false)
  render().find(n => n.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() })
  await vi.waitFor(() => expect(state.chat.send).toHaveBeenCalled())
  expect(render().some(n => n.type === 'input' && n.props.value === 'Unsent fixture')).toBe(true)
  state.chat.send.mockResolvedValue(true)
  render().find(n => n.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() })
  await vi.waitFor(() => expect(render().some(n => n.type === 'input' && n.props.value === 'Unsent fixture')).toBe(false))
})
it.each([['es', 'Hablar con un agente'], ['it', 'Parla con un operatore']] as const)('keeps %s handoff controls localized', (locale, label) => {
  state.locale = locale
  button(render(), label).props.onClick()
  expect(render().filter(n => n.type === 'input' && n.props.required)).toHaveLength(2)
})
