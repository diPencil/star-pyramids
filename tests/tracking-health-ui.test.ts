import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ index: 0, values: [] as unknown[], effects: [] as (() => void)[] }))
const observe = vi.hoisted(() => vi.fn())
const toasts = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }))
vi.mock('react', async original => ({ ...await original<typeof import('react')>(),
  useId: () => 'fixture-health',
  useEffect: () => {},
  useRef: (initial: unknown) => { const i = hooks.index++; return hooks.values[i] ??= { current: initial } },
  useState: (initial: unknown) => { const i = hooks.index++; if (!(i in hooks.values)) hooks.values[i] = initial; return [hooks.values[i], (v: unknown) => { hooks.values[i] = v }] },
}))
vi.mock('@/lib/tracking/health/tracking-health-browser', () => ({ observeTrackingBrowser: observe }))
vi.mock('@/components/admin/admin-toaster', () => ({ toast: toasts }))
import { TrackingHealthPanel } from '@/components/admin/seo/tracking-health'
type Element = ReactElement<Record<string, unknown>>
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const element = node as Element
  return [element, ...elements(element.props.children as ReactNode)]
}
function render(blocked = false) { hooks.index = 0; return elements(TrackingHealthPanel({ canVerify: true, blocked, revision: 'fixture' })) }
function click(nodes: Element[], text: string) {
  const button = nodes.find(n => n.type === 'button' && (n.props.children === text || Array.isArray(n.props.children) && n.props.children.includes(text)))!
  return (button.props.onClick as () => void)()
}
const pass = { status: 'verified', code: 'configuration_valid' }
const result = { checkedAt: '2026-11-08T12:00:00Z', config: { enabled: true, containerId: 'GTM-KQ8GR36H', measurementId: 'G-ABC1234567' }, configuration: pass, published: { status: 'not_verified', code: 'google_credentials_missing' }, ga4: { status: 'not_verified', code: 'google_credentials_missing' }, browser: { status: 'not_verified', code: 'browser_no_observation' }, overall: 'not_verified' }
beforeEach(() => {
  hooks.index = 0; hooks.values = []
  for (const mock of Object.values(toasts)) mock.mockReset()
  observe.mockReset().mockResolvedValue({ status: 'verified', code: 'browser_observed' })
  vi.stubGlobal('window', { setTimeout, clearTimeout })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(result)))
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

it('starts unverified, supports EN/AR and logical RTL without requesting data on mount', () => {
  let nodes = render()
  expect(fetch).not.toHaveBeenCalled()
  expect(observe).not.toHaveBeenCalled()
  expect(nodes.find(n => n.type === 'a' && n.props.children === 'Open public homepage in a new tab')?.props).toMatchObject({ href: '/', target: '_blank', rel: 'noopener noreferrer' })
  expect(nodes.filter(n => n.props['data-status'] === 'verified')).toHaveLength(0)
  click(nodes, 'العربية')
  nodes = render()
  expect(nodes.find(n => n.type === 'section')?.props).toMatchObject({ lang: 'ar', dir: 'rtl' })
  expect(nodes.some(n => n.type === 'button' && Array.isArray(n.props.children) && n.props.children.includes('التحقق من الاتصال'))).toBe(true)
  expect(nodes.filter(n => n.type === 'button').every(n => n.props.type === 'button')).toBe(true)
})

it('never shows green overall success from IDs and a loaded browser alone', async () => {
  click(render(), 'Verify Connection')
  await vi.waitFor(() => expect(toasts.warning).toHaveBeenCalledOnce())
  const nodes = render()
  expect(nodes.find(n => n.props.role === 'status')?.props.children).toBeDefined()
  expect(toasts.success).not.toHaveBeenCalled()
  expect(nodes.filter(n => n.props['data-status'] === 'not_verified').length).toBeGreaterThanOrEqual(3)
})

it('ignores previously loaded tabs when the saved GTM configuration is disabled', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ...result, config: { ...result.config, enabled: false }, configuration: { status: 'action_required', code: 'gtm_disabled' }, browser: { status: 'not_verified', code: 'gtm_disabled' } }))
  click(render(), 'Verify Connection')
  await vi.waitFor(() => expect(toasts.warning).toHaveBeenCalledOnce())
  expect(observe).not.toHaveBeenCalled()
  expect(render().filter(n => n.props['data-status'] === 'verified')).toHaveLength(0)
})

it('reports a timeout if the deadline passes during browser observation', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('window', { setTimeout, clearTimeout })
  let finish!: (check: unknown) => void
  observe.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  click(render(), 'Verify Connection')
  await vi.advanceTimersByTimeAsync(0)
  expect(observe).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(35000)
  finish({ status: 'verified', code: 'browser_observed' })
  await vi.advanceTimersByTimeAsync(0)
  expect(render().find(n => n.props.role === 'alert')?.props.children).toBe('Verification timed out. No success was established.')
  expect(toasts.success).not.toHaveBeenCalled()
})

it('shows a busy state and suppresses duplicate verification submissions', async () => {
  let finish!: (response: Response) => void
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  click(render(), 'Verify Connection')
  const pending = render()
  expect(pending.find(n => n.type === 'section')?.props['aria-busy']).toBe(true)
  const button = pending.find(n => n.type === 'button' && Array.isArray(n.props.children) && n.props.children.includes('Verifying…'))!
  expect(button.props.disabled).toBe(true)
  ;(button.props.onClick as () => void)()
  expect(fetch).toHaveBeenCalledOnce()
  finish(Response.json(result))
  await vi.waitFor(() => expect(toasts.warning).toHaveBeenCalledOnce())
  expect(render().find(n => n.type === 'section')?.props['aria-busy']).toBe(false)
})

it('shows a successful overall check only with all four independent pieces of evidence', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ...result, published: { status: 'verified', code: 'published_destination_matched' }, ga4: { status: 'verified', code: 'ga4_data_received' } }))
  click(render(), 'Verify Connection')
  await vi.waitFor(() => expect(toasts.success).toHaveBeenCalledOnce())
  expect(render().filter(n => n.props['data-status'] === 'verified')).toHaveLength(5)
})

it('blocks unsaved verification and does not display server error content', async () => {
  expect(render(true).find(n => n.type === 'button' && Array.isArray(n.props.children) && n.props.children.includes('Verify Connection'))?.props.disabled).toBe(true)
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ error: 'secret credential value' }, { status: 503 }))
  click(render(), 'Verify Connection')
  await vi.waitFor(() => expect(toasts.error).toHaveBeenCalledOnce())
  expect(JSON.stringify(render())).not.toContain('secret credential value')
})
