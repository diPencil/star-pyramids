import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ReactElement, ReactNode } from 'react'

type Effect = { deps?: readonly unknown[]; cleanup?: () => void; run: () => void | (() => void); pending: boolean }
const h = vi.hoisted(() => ({
  cursor: 0, values: [] as unknown[], effects: new Map<number, Effect>(),
  fetch: vi.fn(), replace: vi.fn(), locale: 'en',
}))
vi.mock('react', async () => ({
  ...await vi.importActual<typeof import('react')>('react'),
  useState: (initial: unknown) => {
    const index = h.cursor++
    if (!(index in h.values)) h.values[index] = typeof initial === 'function' ? initial() : initial
    return [h.values[index], (value: unknown) => { h.values[index] = typeof value === 'function' ? value(h.values[index]) : value }]
  },
  useEffect: (run: Effect['run'], deps?: readonly unknown[]) => {
    const index = h.cursor++
    const previous = h.effects.get(index)
    if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
      previous?.cleanup?.()
      h.effects.set(index, { deps, run, pending: true })
    }
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: h.replace }), useParams: () => ({}) }))
vi.mock('@/components/locale', async () => ({
  ...await vi.importActual<typeof import('@/components/locale')>('@/components/locale'),
  useLocale: () => ({ locale: h.locale, currency: 'USD' }),
}))
vi.mock('@/components/authenticated-user', () => ({ useAuthenticatedUser: () => ({ firstName: 'Test', lastName: 'Customer', email: 'customer@example.test', countryCode: 'US', phone: '' }) }))
vi.mock('@/lib/catalogue/catalogue-client', () => ({ useDbDestinations: () => [] }))
vi.mock('@/components/admin/admin-pagination', () => ({ usePagination: (rows: unknown[]) => ({ pageRows: rows, total: rows.length, page: 1, pageCount: 1, pageSize: 10, from: 1, to: rows.length, setPage: vi.fn(), setPageSize: vi.fn() }) }))

import { CustomerTripRequestsPage } from '@/components/account/account-custom-trip'
import { CustomerAccountPage } from '@/components/account/account-portal'

type Props = { startNew?: boolean; editRef?: string | null }
type Element = ReactElement<Record<string, any>>
const tripPage = CustomerTripRequestsPage({})
const TripSection = tripPage.props.children.props.children.type as (props: Props) => ReactNode
const passwordPage = CustomerAccountPage({ section: 'change-password' })
const PasswordSection = passwordPage.props.children.props.children.type as () => ReactNode
function renderTrip(props: Props = {}) { h.cursor = 0; return TripSection(props) }
function renderPassword() { h.cursor = 0; return PasswordSection() }
function effects() {
  for (const effect of h.effects.values()) {
    if (!effect.pending) continue
    effect.pending = false
    effect.cleanup = effect.run() || undefined
  }
}
function all(node: ReactNode, predicate: (element: Element) => boolean): Element[] {
  if (Array.isArray(node)) return node.flatMap(child => all(child, predicate))
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const element = node as Element
  return [...(predicate(element) ? [element] : []), ...all(element.props.children, predicate)]
}
const forms = (tree: ReactNode) => all(tree, e => e.type === 'form')
const inputs = (tree: ReactNode) => all(tree, e => e.type === 'input')
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const record = (reference = 'SP-TR-ABC123', status = 'new') => ({
  reference, status, timeMode: 'unsure', preferredFrom: '', preferredTo: '',
  destinationSlug: '', tourSlug: '', customTitle: 'Existing journey',
  contact: { name: 'Test Customer', email: 'customer@example.test', phone: '5551234567', dialCode: '+1', nationality: 'US' },
  adults: 2, children: 0, infants: 0, budgetMin: 1000, budgetMax: 3000, notes: '', flightOffer: false,
})
beforeEach(() => {
  vi.clearAllMocks(); h.cursor = 0; h.values = []; h.effects.clear(); h.locale = 'en'
  h.fetch.mockImplementation(async (url: string) => {
    if (url === '/api/account/trip-requests') return response({ requests: [] })
    throw Error('Unexpected request in isolated test')
  })
  vi.stubGlobal('fetch', h.fetch)
})
afterEach(() => {
  for (const effect of h.effects.values()) effect.cleanup?.()
  vi.unstubAllGlobals()
})

it('opens a new form, consumes its query once, and keeps the draft after the clean URL rerenders', () => {
  renderTrip({ startNew: true }); effects()
  let tree = renderTrip({ startNew: true })
  const title = inputs(tree).find(e => e.props['aria-label'] === 'Trip name')!
  title.props.onChange({ target: { value: 'My new journey' } })
  expect(h.replace).toHaveBeenCalledExactlyOnceWith('/account/trip-requests', { scroll: false })
  tree = renderTrip({ startNew: false }); effects()
  expect(forms(tree)).toHaveLength(1)
  expect(inputs(tree).find(e => e.props['aria-label'] === 'Trip name')!.props.value).toBe('My new journey')
  expect(h.replace).toHaveBeenCalledTimes(1)
})

it('does not navigate or expose a create form until the owner-only edit lookup finishes', async () => {
  let resolve!: (result: Response) => void
  const pending = new Promise<Response>(done => { resolve = done })
  h.fetch.mockImplementation(async (url: string) => url.endsWith('/SP-TR-ABC123') ? pending : response({ requests: [] }))
  renderTrip({ editRef: 'SP-TR-ABC123' }); effects()
  expect(forms(renderTrip({ editRef: 'SP-TR-ABC123' }))).toHaveLength(0)
  expect(h.replace).not.toHaveBeenCalled()
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(2))
  await new Promise(done => setTimeout(done, 0))
  const pendingTree = renderTrip({ editRef: 'SP-TR-ABC123' })
  expect(all(pendingTree, e => e.props.role === 'status')).toHaveLength(1)
  expect(all(pendingTree, e => e.type === 'button')).toHaveLength(0)
  resolve(response(record()))
  await vi.waitFor(() => expect(h.replace).toHaveBeenCalledTimes(1))
  const tree = renderTrip({ editRef: null }); effects()
  expect(forms(tree)).toHaveLength(1)
  expect(inputs(tree).find(e => e.props['aria-label'] === 'Trip name')!.props.value).toBe('Existing journey')
  expect(h.fetch).toHaveBeenCalledWith('/api/account/trip-requests/SP-TR-ABC123', { credentials: 'same-origin' })
})

it.each([401, 403, 404, 500])('keeps edit failures (%s) out of the create flow', async status => {
  h.fetch.mockImplementation(async (url: string) => url.endsWith('/SP-TR-ABC123') ? response({ error: 'Trip request not found.' }, status) : response({ requests: [] }))
  renderTrip({ editRef: 'SP-TR-ABC123' }); effects()
  await vi.waitFor(() => expect(h.replace).toHaveBeenCalledTimes(1))
  expect(forms(renderTrip({ editRef: null }))).toHaveLength(0)
  expect(h.fetch.mock.calls.every(call => !call[1]?.method)).toBe(true)
})

it('preserves noneditable status rules and never opens an unauthorized edit form', async () => {
  h.fetch.mockImplementation(async (url: string) => url.endsWith('/SP-TR-ABC123') ? response(record('SP-TR-ABC123', 'confirmed')) : response({ requests: [] }))
  renderTrip({ editRef: 'SP-TR-ABC123' }); effects()
  await vi.waitFor(() => expect(h.replace).toHaveBeenCalledTimes(1))
  expect(forms(renderTrip({ editRef: null }))).toHaveLength(0)
})

it('ignores an old edit response after navigating to a new request', async () => {
  let resolve!: (result: Response) => void
  const pending = new Promise<Response>(done => { resolve = done })
  h.fetch.mockImplementation(async (url: string) => url.endsWith('/SP-TR-ABC123') ? pending : response({ requests: [] }))
  renderTrip({ editRef: 'SP-TR-ABC123' }); effects()
  renderTrip({ startNew: true, editRef: null }); effects()
  resolve(response(record()))
  await pending; await new Promise(done => setTimeout(done, 0))
  const tree = renderTrip({ startNew: true, editRef: null })
  expect(inputs(tree).find(e => e.props['aria-label'] === 'Trip name')!.props.value).toBe('')
  expect(h.replace).toHaveBeenCalledTimes(1)
})

it('resets an existing edit draft when a new-request link is selected', async () => {
  h.fetch.mockImplementation(async (url: string) => url.endsWith('/SP-TR-ABC123') ? response(record()) : response({ requests: [] }))
  renderTrip({ editRef: 'SP-TR-ABC123' }); effects()
  await vi.waitFor(() => expect(h.replace).toHaveBeenCalledTimes(1))
  renderTrip({ editRef: null }); effects()
  renderTrip({ startNew: true }); effects()
  expect(inputs(renderTrip({ startNew: true })).find(e => e.props['aria-label'] === 'Trip name')!.props.value).toBe('')
})

it('keeps the edit reference after query cleanup and saves through PATCH, not create', async () => {
  h.fetch.mockImplementation(async (url: string) => url.endsWith('/SP-TR-ABC123') ? response(record()) : response({ requests: [] }))
  renderTrip({ editRef: 'SP-TR-ABC123' }); effects()
  await vi.waitFor(() => expect(h.replace).toHaveBeenCalledTimes(1))
  const tree = renderTrip({ editRef: null }); effects()
  await forms(tree)[0].props.onSubmit({ preventDefault: vi.fn() })
  await vi.waitFor(() => expect(h.fetch.mock.calls.some(call => call[1]?.method === 'PATCH')).toBe(true))
  const [url, options] = h.fetch.mock.calls.find(call => call[1]?.method === 'PATCH')!
  expect(url).toBe('/api/account/trip-requests/SP-TR-ABC123')
  expect(options.credentials).toBe('same-origin')
  expect(JSON.parse(options.body)).toMatchObject({ action: 'update', draft: { customTitle: 'Existing journey' } })
  expect(h.fetch.mock.calls.some(call => call[1]?.method === 'POST')).toBe(false)
})

it('handles a rejected edit lookup without opening or submitting a blank form', async () => {
  h.fetch.mockImplementation(async (url: string) => {
    if (url.endsWith('/SP-TR-ABC123')) throw Error('Network unavailable')
    return response({ requests: [] })
  })
  renderTrip({ editRef: 'SP-TR-ABC123' }); effects()
  await vi.waitFor(() => expect(h.replace).toHaveBeenCalledTimes(1))
  expect(forms(renderTrip({ editRef: null }))).toHaveLength(0)
  expect(h.fetch.mock.calls.every(call => !call[1]?.method)).toBe(true)
})

it('survives effect cleanup/replay without consuming the query for a cancelled lookup', async () => {
  const pending: ((result: Response) => void)[] = []
  h.fetch.mockImplementation(async (url: string) => url.endsWith('/SP-TR-ABC123')
    ? new Promise<Response>(resolve => pending.push(resolve)) : response({ requests: [] }))
  renderTrip({ editRef: 'SP-TR-ABC123' }); effects()
  for (const effect of h.effects.values()) { effect.cleanup?.(); effect.pending = true }
  effects()
  expect(pending).toHaveLength(2)
  pending[0](response(record('SP-TR-ABC123', 'confirmed')))
  await new Promise(done => setTimeout(done, 0))
  expect(h.replace).not.toHaveBeenCalled()
  pending[1](response(record()))
  await vi.waitFor(() => expect(h.replace).toHaveBeenCalledTimes(1))
  expect(forms(renderTrip({ editRef: null }))).toHaveLength(1)
})

it('uses the existing password form and authenticated PATCH contract', async () => {
  const fields = inputs(renderPassword())
  fields[0].props.onChange({ target: { value: 'OldPass1' } })
  fields[1].props.onChange({ target: { value: 'NewPass2' } })
  fields[2].props.onChange({ target: { value: 'NewPass2' } })
  h.fetch.mockResolvedValue(response({ success: true }))
  await forms(renderPassword())[0].props.onSubmit({ preventDefault: vi.fn() })
  expect(h.fetch).toHaveBeenCalledExactlyOnceWith('/api/auth/change-password', {
    method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ currentPassword: 'OldPass1', newPassword: 'NewPass2', confirmPassword: 'NewPass2' }),
  })
})

it('does not submit mismatched password confirmation', async () => {
  const fields = inputs(renderPassword())
  fields[0].props.onChange({ target: { value: 'OldPass1' } })
  fields[1].props.onChange({ target: { value: 'NewPass2' } })
  fields[2].props.onChange({ target: { value: 'Different' } })
  await forms(renderPassword())[0].props.onSubmit({ preventDefault: vi.fn() })
  expect(h.fetch).not.toHaveBeenCalled()
})
