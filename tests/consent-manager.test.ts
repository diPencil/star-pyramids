import { randomUUID } from 'node:crypto'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ConsentManager } from '@/components/consent-manager'
import { FUNNEL_STORAGE_PREFIX } from '@/lib/booking-funnel'
import { TRACKING_CONSENT_STORAGE_KEY } from '@/lib/tracking'
import { chooseTrackingConsent, initializeGtm, readTrackingConsent, readTrackingConsentPreference, subscribeToTrackingConsent } from '@/lib/tracking-browser'

const hooks = vi.hoisted(() => ({
  index: 0,
  values: [] as unknown[],
  effects: [] as Array<() => void>,
  cleanups: [] as Array<() => void>,
}))

// Exercise the component's own handlers and effects without a browser runner.
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState(initial: unknown) {
    const index = hooks.index++
    if (!(index in hooks.values)) hooks.values[index] = initial
    return [hooks.values[index], (value: unknown) => { hooks.values[index] = value }]
  },
  useRef(initial: unknown) {
    const index = hooks.index++
    return hooks.values[index] ??= { current: initial }
  },
  useEffect(effect: () => void | (() => void), dependencies: unknown[]) {
    const index = hooks.index++
    const previous = hooks.values[index] as unknown[] | undefined
    if (previous?.length === dependencies.length && dependencies.every((value, i) => value === previous[i])) return
    hooks.values[index] = dependencies
    hooks.effects.push(() => {
      const cleanup = effect()
      if (cleanup) hooks.cleanups.push(cleanup)
    })
  },
  useId: () => 'consent-panel',
  useSyncExternalStore(subscribe: (notify: () => void) => () => void, snapshot: () => string) {
    const index = hooks.index++
    if (!(index in hooks.values)) {
      hooks.values[index] = true
      hooks.effects.push(() => hooks.cleanups.push(subscribe(languageNotification)))
    }
    return snapshot()
  },
}))

function browserAt(path = '/', values = new Map<string, string>()) {
  const appendChild = vi.fn()
  const localStorage = {
    get length() { return values.size },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
    removeItem: (key: string) => { values.delete(key) },
  }
  const target = Object.assign(new EventTarget(), {
    location: { href: 'https://starpyramids.com' + path },
    crypto: { randomUUID },
    localStorage,
    document: { createElement: () => ({}), head: { appendChild } },
    dataLayer: [] as unknown[],
  })
  return { browser: target as unknown as Window, target, localStorage, appendChild, values }
}

type Element = ReactElement<Record<string, any>>
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const element = node as Element
  return [element, ...elements(element.props.children)]
}

const launcherFocus = vi.fn()
const firstOptionFocus = vi.fn()
const languageNotification = vi.fn()
const language = { lang: 'en' }
let onLanguageMutation: (() => void) | undefined

function render() {
  hooks.index = 0
  const tree = ConsentManager({ initialLocale: 'en' })
  const nodes = elements(tree)
  for (const node of nodes) {
    if (node.type === 'input' && node.props.ref) node.props.ref.current = { focus: firstOptionFocus }
    if (node.type === 'button' && node.props['aria-controls']) node.props.ref.current = { focus: launcherFocus }
  }
  for (const effect of hooks.effects.splice(0)) effect()
  return nodes
}

function mount(browser: Window) {
  vi.stubGlobal('window', browser)
  expect(render()).toEqual([])
  return render()
}

const button = (nodes: Element[], name: string) => nodes.find(node => node.type === 'button' && node.props.children === name)!
const launcher = (nodes: Element[]) => nodes.find(node => node.type === 'button' && node.props['aria-controls'])!
const denied = { analytics: false, marketing: false }
const granted = { analytics: true, marketing: true }

beforeEach(() => {
  hooks.values = []
  language.lang = 'en'
  vi.clearAllMocks()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubGlobal('document', { documentElement: language })
  vi.stubGlobal('MutationObserver', class {
    constructor(callback: () => void) { onLanguageMutation = callback }
    observe() {}
    disconnect() { onLanguageMutation = undefined }
  })
})

afterEach(() => {
  for (const cleanup of hooks.cleanups.splice(0)) cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it.each([
  ['Accept all', granted],
  ['Reject optional', denied],
] as const)('persists %s once and leaves a settings control after a decision', (label, choice) => {
  const page = browserAt()
  const measurement = vi.fn()
  const stopMeasurement = subscribeToTrackingConsent(page.browser, measurement)
  try {
    const initial = mount(page.browser)
    expect(readTrackingConsentPreference(page.browser)).toBeNull()
    expect(readTrackingConsent(page.browser)).toEqual(denied)
    expect(button(initial, 'Accept all').props.type).toBe('button')
    expect(button(initial, 'Reject optional').props.type).toBe('button')
    button(initial, label).props.onClick()
    expect(measurement).toHaveBeenCalledExactlyOnceWith(choice)
    expect(page.localStorage.setItem).toHaveBeenCalledOnce()
    expect(JSON.parse(page.localStorage.setItem.mock.calls[0][1])).toMatchObject(choice)
    expect(launcher(render()).props.children).toBe('Cookie settings')
    expect(launcherFocus).toHaveBeenCalled()
    expect(readTrackingConsentPreference(browserAt('/', page.values).browser)).toEqual(choice)
  } finally {
    stopMeasurement()
  }
})

it('uses labelled native controls, restores focus on Escape, and saves categories independently', () => {
  const page = browserAt()
  const initial = mount(page.browser)
  const launch = launcher(initial)
  expect(launch.props['aria-expanded']).toBe(false)
  launch.props.onClick()
  const open = render()
  expect(launcher(open).props['aria-expanded']).toBe(true)
  expect(firstOptionFocus).toHaveBeenCalledOnce()
  expect(open[0].props['aria-modal']).toBeUndefined()
  expect(open.find(node => node.props.id === launch.props['aria-controls'])?.props.hidden).toBe(false)
  const options = open.filter(node => node.type === 'input')
  expect(options.map(node => [node.props.type, node.props.checked])).toEqual([['checkbox', false], ['checkbox', false]])
  expect(open.filter(node => node.type === 'label')).toHaveLength(2)
  for (const option of options) {
    expect(open.some(node => node.props.id === option.props['aria-labelledby'])).toBe(true)
    expect(open.some(node => node.props.id === option.props['aria-describedby'])).toBe(true)
  }
  const preventDefault = vi.fn()
  open[0].props.onKeyDown({ key: 'Escape', preventDefault, stopPropagation: vi.fn() })
  expect(preventDefault).toHaveBeenCalledOnce()
  expect(launcher(render()).props['aria-expanded']).toBe(false)
  expect(launcherFocus).toHaveBeenCalledOnce()
  expect(readTrackingConsentPreference(page.browser)).toBeNull()

  launcher(render()).props.onClick()
  render().find(node => node.type === 'input')!.props.onChange({ currentTarget: { checked: true } })
  const form = render().find(node => node.type === 'form')!
  form.props.onSubmit({ preventDefault: vi.fn() })
  expect(readTrackingConsent(page.browser)).toEqual({ analytics: true, marketing: false })
})

it('applies private-route withdrawal to public tabs and purges pending bookings before regrant', () => {
  const values = new Map([[TRACKING_CONSENT_STORAGE_KEY, JSON.stringify(granted)]])
  const privatePage = browserAt('/checkout', values)
  const publicPage = browserAt('/trips', values)
  const key = FUNNEL_STORAGE_PREFIX + 'pending'
  values.set(key, 'pending')
  initializeGtm(publicPage.browser, 'GTM-TEST', readTrackingConsent(publicPage.browser), 'production')
  publicPage.appendChild.mock.calls[0][0].onload()
  const stopMeasurement = subscribeToTrackingConsent(publicPage.browser, choice => {
    initializeGtm(publicPage.browser, 'GTM-TEST', choice, 'production')
  })
  try {
    launcher(mount(privatePage.browser)).props.onClick()
    button(render(), 'Reject optional').props.onClick()
    expect(values.has(key)).toBe(false)
    expect(privatePage.appendChild).not.toHaveBeenCalled()
    expect(privatePage.target.dataLayer).toEqual([])
    publicPage.target.dispatchEvent(Object.assign(new Event('storage'), { key: TRACKING_CONSENT_STORAGE_KEY }))
    expect(Array.from(publicPage.target.dataLayer.at(-1) as ArrayLike<unknown>)).toEqual([
      'consent', 'update', expect.objectContaining({ analytics_storage: 'denied', ad_user_data: 'denied' }),
    ])
    expect(publicPage.appendChild).toHaveBeenCalledOnce()
    expect(readTrackingConsent(browserAt('/login', values).browser)).toEqual(denied)
  } finally {
    stopMeasurement()
  }
})

it('refreshes an open draft after cross-tab withdrawal and keeps it through language changes', () => {
  const values = new Map([[TRACKING_CONSENT_STORAGE_KEY, JSON.stringify(granted)]])
  const page = browserAt('/', values)
  const other = browserAt('/account', values)
  const stop = subscribeToTrackingConsent(other.browser, () => {})
  try {
    launcher(mount(page.browser)).props.onClick()
    expect(render().filter(node => node.type === 'input').map(node => node.props.checked)).toEqual([true, true])
    expect(chooseTrackingConsent(other.browser, denied)).toBe(true)
    page.target.dispatchEvent(Object.assign(new Event('storage'), { key: TRACKING_CONSENT_STORAGE_KEY }))
    expect(render().filter(node => node.type === 'input').map(node => node.props.checked)).toEqual([false, false])
    render().filter(node => node.type === 'input')[1].props.onChange({ currentTarget: { checked: true } })
    language.lang = 'es'
    onLanguageMutation?.()
    expect(languageNotification).toHaveBeenCalledOnce()
    expect(button(render(), 'Guardar preferencias')).toBeDefined()
    language.lang = 'it'
    onLanguageMutation?.()
    const italian = render()
    expect(italian[0].props.lang).toBe('it')
    expect(button(italian, 'Salva le preferenze')).toBeDefined()
    expect(italian.filter(node => node.type === 'input').map(node => node.props.checked)).toEqual([false, true])
  } finally {
    stop()
  }
})

it('reports a storage failure and keeps optional tracking off on reload', () => {
  const page = browserAt('/login', new Map([[TRACKING_CONSENT_STORAGE_KEY, JSON.stringify(granted)]]))
  launcher(mount(page.browser)).props.onClick()
  page.localStorage.setItem.mockImplementation(() => { throw new Error('quota exceeded') })
  button(render(), 'Reject optional').props.onClick()
  expect(render().find(node => node.props.role === 'status')?.props.children).toMatch(/couldn’t save/)
  expect(readTrackingConsent(page.browser)).toEqual(denied)
  expect(readTrackingConsent(browserAt('/login', page.values).browser)).toEqual(denied)
  expect(page.appendChild).not.toHaveBeenCalled()
})

it('does not save an open stale draft before the cross-tab storage notification arrives', () => {
  const page = browserAt('/', new Map([[TRACKING_CONSENT_STORAGE_KEY, JSON.stringify(granted)]]))
  launcher(mount(page.browser)).props.onClick()
  const form = render().find(node => node.type === 'form')!
  page.values.set(TRACKING_CONSENT_STORAGE_KEY, JSON.stringify(denied))
  form.props.onSubmit({ preventDefault: vi.fn() })
  expect(page.localStorage.setItem.mock.calls.filter(([key]) => key === TRACKING_CONSENT_STORAGE_KEY)).toEqual([])
  expect(render().find(node => node.props.role === 'status')?.props.children).toMatch(/changed in another tab/)
  expect(render().filter(node => node.type === 'input').map(node => node.props.checked)).toEqual([false, false])
  expect(readTrackingConsent(page.browser)).toEqual(denied)
})
