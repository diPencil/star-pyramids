import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMobileDrawer } from '@/lib/use-mobile-drawer'

const state = vi.hoisted(() => ({ mobile: true, effects: [] as Array<() => void | (() => void)> }))
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: () => [state.mobile, vi.fn()],
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => void | (() => void)) => { state.effects.push(effect) },
}))

function fixture(open = true) {
  const listeners = new Map<string, (event: KeyboardEvent) => void>()
  const doc = {
    body: { style: { overflow: 'auto' } },
    activeElement: null as unknown,
    addEventListener: vi.fn((name: string, listener: (event: KeyboardEvent) => void) => listeners.set(name, listener)),
    removeEventListener: vi.fn((name: string) => listeners.delete(name)),
  }
  const control = () => {
    const element = { getClientRects: () => [{}], focus: vi.fn(() => { doc.activeElement = element }) }
    return element
  }
  const first = control()
  const last = control()
  const trigger = control()
  const sidebar = { querySelectorAll: () => [first, last], contains: (element: unknown) => element === first || element === last }
  vi.stubGlobal('document', doc)
  vi.stubGlobal('window', { matchMedia: () => ({ matches: state.mobile, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
  const close = vi.fn()
  useMobileDrawer({ open, onClose: close, panel: { current: sidebar as unknown as HTMLElement }, trigger: { current: trigger as unknown as HTMLButtonElement }, query: '(max-width: 860px)' })
  const cleanup = state.effects.map((effect) => effect())
  const key = (key: string, shiftKey = false) => {
    const event = { key, shiftKey, preventDefault: vi.fn() }
    listeners.get('keydown')?.(event as unknown as KeyboardEvent)
    return event
  }
  return { doc, first, last, trigger, close, key, listeners, cleanup: () => cleanup.reverse().forEach((effect) => effect?.()) }
}

describe('authenticated mobile drawer behavior', () => {
  beforeEach(() => { state.mobile = true; state.effects = [] })
  afterEach(() => { vi.unstubAllGlobals() })

  it('locks page scrolling, focuses the drawer and restores trigger/scroll on close', () => {
    const f = fixture()
    expect(f.doc.body.style.overflow).toBe('hidden')
    expect(f.doc.activeElement).toBe(f.first)
    f.cleanup()
    expect(f.doc.body.style.overflow).toBe('auto')
    expect(f.doc.activeElement).toBe(f.trigger)
    expect(f.listeners.has('keydown')).toBe(false)
  })

  it('contains forward and backward tab navigation', () => {
    const f = fixture()
    expect(f.key('Tab', true).preventDefault).toHaveBeenCalledOnce()
    expect(f.doc.activeElement).toBe(f.last)
    expect(f.key('Tab').preventDefault).toHaveBeenCalledOnce()
    expect(f.doc.activeElement).toBe(f.first)
    f.cleanup()
  })

  it('dismisses with Escape without invoking any account actions', () => {
    const f = fixture()
    expect(f.key('Escape').preventDefault).toHaveBeenCalledOnce()
    expect(f.close).toHaveBeenCalledOnce()
    f.cleanup()
  })

  it('does not lock scrolling or trap keys on desktop or when closed', () => {
    state.mobile = false
    const desktop = fixture()
    expect(desktop.doc.body.style.overflow).toBe('auto')
    expect(desktop.listeners.has('keydown')).toBe(false)
    desktop.cleanup()
    state.effects = []
    state.mobile = true
    const closed = fixture(false)
    expect(closed.doc.body.style.overflow).toBe('auto')
    expect(closed.listeners.has('keydown')).toBe(false)
    closed.cleanup()
  })
})
