import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ConsentManager } from '@/components/consent-manager'
import { FUNNEL_STORAGE_PREFIX } from '@/lib/tracking/leads/booking-funnel'
import { TRACKING_CONSENT_STORAGE_KEY } from '@/lib/tracking/tracking'
import { chooseTrackingConsent, initializeGtm, readTrackingConsent, readTrackingConsentPreference, subscribeToTrackingConsent } from '@/lib/tracking/tracking-browser'

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

function browserAt(path = '/', values = new Map<string, string>(), sessionValues = new Map<string, string>()) {
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
    sessionStorage: {
      getItem: vi.fn((key: string) => sessionValues.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { sessionValues.set(key, value) }),
      removeItem: (key: string) => { sessionValues.delete(key) },
    },
    document: { createElement: () => ({}), head: { appendChild } },
    dataLayer: [] as unknown[],
  })
  return { browser: target as unknown as Window, target, localStorage, appendChild, values, sessionValues }
}

type Element = ReactElement<Record<string, any>>
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const element = node as Element
  return [element, ...elements(element.props.children)]
}

const launcherFocus = vi.fn()
const regionFocus = vi.fn()
const firstOptionFocus = vi.fn()
const languageNotification = vi.fn()
const language = { lang: 'en' }
let onLanguageMutation: (() => void) | undefined

function render() {
  hooks.index = 0
  const tree = ConsentManager({ initialLocale: 'en' })
  const nodes = elements(tree)
  for (const node of nodes) {
    if (node.type === 'section' && node.props.ref) node.props.ref.current = { focus: regionFocus }
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
] as const)('persists %s once and hides the widget for the session after a decision', (label, choice) => {
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
    const dismissed = render()
    expect(launcher(dismissed).props.children).toBe('Cookie settings')
    expect(launcher(dismissed).props['aria-expanded']).toBe(false)
    expect(launcher(dismissed).props.hidden).toBe(true)
    expect(dismissed.find(node => node.props.id === 'consent-panel')?.props.hidden).toBe(true)
    expect(dismissed.some(node => node.type === 'h2')).toBe(false)
    expect(launcherFocus).toHaveBeenCalled()
    expect(regionFocus).toHaveBeenCalledWith({ preventScroll: true })
    expect(readTrackingConsentPreference(browserAt('/', page.values).browser)).toEqual(choice)
  } finally {
    stopMeasurement()
  }
})

it('uses labelled native controls, restores focus on Escape, and saves categories independently', () => {
  const page = browserAt()
  const initial = mount(page.browser)
  const launch = launcher(initial)
  expect(launch.props['aria-expanded']).toBe(true)
  expect(initial.filter(node => node.type === 'input')).toEqual([])
  button(initial, 'Customize preferences').props.onClick()
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
  expect(launcher(render()).props['aria-expanded']).toBe(false)
  expect(launcher(render()).props.hidden).toBe(true)
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
  expect(render().find(node => node.props.role === 'alert')?.props.children).toMatch(/couldn’t save/)
  expect(launcher(render()).props['aria-expanded']).toBe(true)
  expect(launcher(render()).props.hidden).toBe(false)
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
  expect(render().find(node => node.props.role === 'alert')?.props.children).toMatch(/changed in another tab/)
  expect(render().filter(node => node.type === 'input').map(node => node.props.checked)).toEqual([false, false])
  expect(readTrackingConsent(page.browser)).toEqual(denied)
})

it('dismisses from the verified save result even when the UI bridge callback was removed', () => {
  const page = browserAt()
  const stopMeasurement = subscribeToTrackingConsent(page.browser, () => {})
  try {
    const initial = mount(page.browser)
    hooks.cleanups.at(-1)!()
    button(initial, 'Accept all').props.onClick()
    expect(readTrackingConsent(page.browser)).toEqual(granted)
    expect(launcher(render()).props['aria-expanded']).toBe(false)
    expect(render().some(node => node.type === 'h2')).toBe(false)
  } finally {
    stopMeasurement()
  }
})

it('closes without granting, reopens preferences, and shows the notice again after an undecided reload', () => {
  const page = browserAt()
  const initial = mount(page.browser)
  const close = initial.find(node => node.type === 'button' && node.props['aria-label'] === 'Close cookie panel')!
  close.props.onClick()
  expect(launcher(render()).props['aria-expanded']).toBe(false)
  expect(readTrackingConsentPreference(page.browser)).toBeNull()
  expect(page.localStorage.setItem).not.toHaveBeenCalled()
  launcher(render()).props.onClick()
  expect(render().filter(node => node.type === 'input').map(node => node.props.checked)).toEqual([false, false])
  render()[0].props.onKeyDown({ key: 'Escape', preventDefault: vi.fn(), stopPropagation: vi.fn() })
  expect(readTrackingConsentPreference(page.browser)).toBeNull()
  for (const cleanup of hooks.cleanups.splice(0)) cleanup()
  hooks.values = []
  const reloaded = mount(browserAt('/', page.values).browser)
  expect(button(reloaded, 'Accept all')).toBeDefined()
  expect(reloaded.filter(node => node.type === 'input')).toEqual([])
})

it('keeps a saved rejection dismissed after component hydration and reload', () => {
  const values = new Map([[TRACKING_CONSENT_STORAGE_KEY, JSON.stringify(denied)]])
  const page = browserAt('/', values)
  const reloaded = mount(page.browser)
  expect(launcher(reloaded).props['aria-expanded']).toBe(false)
  expect(reloaded.some(node => node.type === 'h2')).toBe(false)
  launcher(reloaded).props.onClick()
  expect(render().filter(node => node.type === 'input').map(node => node.props.checked)).toEqual([false, false])
})

it('keeps a compact vertical widget on the left edge with a bounded preferences panel', () => {
  const css = readFileSync('components/consent-manager.module.css', 'utf8')
  expect(css).toMatch(/\.region\s*\{[^}]*position:\s*fixed/s)
  expect(css).toContain('env(safe-area-inset-left)')
  expect(css).toContain('env(safe-area-inset-bottom)')
  expect(css).toContain('max-block-size: calc(100dvh')
  expect(css).toContain('overflow-y: auto')
  expect(css).toContain('top: 50%')
  expect(css).toContain('writing-mode: vertical-rl')
  const settingsRule = css.match(/\.settings\s*\{([^}]+)\}/)![1]
  expect(settingsRule).toContain('inline-size: max-content')
  expect(settingsRule).toContain('block-size: 44px')
  expect(settingsRule).toContain('white-space: nowrap')
  expect(settingsRule).toContain('text-overflow: ellipsis')
  const cardRule = css.match(/\.card\s*\{([^}]+)\}/)![1]
  expect(cardRule).toContain('writing-mode: horizontal-tb')
  expect(css).toContain('max-inline-size: min(180px, 50dvh)')
  expect(css).toContain('calc(100vw - 12px')
  expect(css).not.toContain('bottom:')
  const page = browserAt()
  const initial = mount(page.browser)
  expect(initial.some(node => /\bcontainer\b/.test(node.props.className ?? ''))).toBe(false)
})

it('keeps the widget hidden through reloads and remounts but restores it in a new session', () => {
  const page = browserAt()
  button(mount(page.browser), 'Accept all').props.onClick()
  expect(launcher(render()).props.hidden).toBe(true)
  for (const cleanup of hooks.cleanups.splice(0)) cleanup()
  hooks.values = []
  const reload = browserAt('/trips', page.values, page.sessionValues)
  expect(launcher(mount(reload.browser)).props.hidden).toBe(true)
  expect(readTrackingConsent(reload.browser)).toEqual(granted)
  for (const cleanup of hooks.cleanups.splice(0)) cleanup()
  hooks.values = []
  const newSession = browserAt('/', page.values)
  const nodes = mount(newSession.browser)
  expect(launcher(nodes).props.hidden).toBe(false)
  expect(launcher(nodes).props['aria-expanded']).toBe(false)
  launcher(nodes).props.onClick()
  expect(render().filter(node => node.type === 'input').map(node => node.props.checked)).toEqual([true, true])
})

it('keeps the launcher available when session visibility cannot be persisted', () => {
  const page = browserAt()
  page.target.sessionStorage.setItem.mockImplementation(() => { throw new Error('blocked') })
  button(mount(page.browser), 'Reject optional').props.onClick()
  expect(launcher(render()).props.hidden).toBe(false)
  expect(launcher(render()).props['aria-expanded']).toBe(false)
  expect(readTrackingConsent(page.browser)).toEqual(denied)
})
