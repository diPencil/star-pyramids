import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Children, createElement, isValidElement, type ReactNode, type ReactElement } from 'react'
import { HorizontalSlider } from '@/components/shared/horizontal-slider'

// Exercise actual component effects/handlers without a browser or another renderer dependency.
const hooks = vi.hoisted(() => ({ cursor: 0, cells: [] as unknown[], pending: [] as Array<() => void> }))
type Effect = { deps?: readonly unknown[]; cleanup?: () => void }
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useRef: <T,>(value: T) => {
    const index = hooks.cursor++
    return hooks.cells[index] ?? (hooks.cells[index] = { current: value })
  },
  useState: <T,>(value: T) => {
    const index = hooks.cursor++
    if (!(index in hooks.cells)) hooks.cells[index] = value
    return [hooks.cells[index], (next: T | ((previous: T) => T)) => { hooks.cells[index] = typeof next === 'function' ? (next as (previous: T) => T)(hooks.cells[index] as T) : next }]
  },
  useCallback: (fn: unknown) => fn,
  useEffect: (run: () => void | (() => void), deps?: readonly unknown[]) => {
    const index = hooks.cursor++, previous = hooks.cells[index] as Effect | undefined
    if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
      hooks.pending.push(() => { previous?.cleanup?.(); hooks.cells[index] = { deps, cleanup: run() } })
    }
  },
}))

function find(node: ReactNode, predicate: (node: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<Record<string, unknown>>(child)) continue
    if (predicate(child)) return child
    const found = find(child.props.children as ReactNode, predicate)
    if (found) return found
  }
}
const fire = (node: ReactElement<Record<string, unknown>>, handler: string, event?: unknown) => (node.props[handler] as (event: unknown) => void)(event)

function fixture(count = 6, width = 400, options: Partial<Parameters<typeof HorizontalSlider>[0]> = {}) {
  const motion = { matches: false }
  const doc = { visibilityState: 'visible' }
  let animation: FrameRequestCallback = () => {}
  const win = Object.assign(new EventTarget(), { matchMedia: () => motion, setInterval, clearInterval, innerHeight: 800, getComputedStyle: () => ({ columnGap: '20px' }), requestAnimationFrame: (callback: FrameRequestCallback) => { animation = callback; return 1 }, cancelAnimationFrame: vi.fn() })
  vi.stubGlobal('window', win); vi.stubGlobal('document', doc)
  let resize = () => {}
  const disconnect = vi.fn()
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback } observe() {} disconnect = disconnect })
  const children = Array.from({ length: count }, (_, index) => ({ offsetLeft: index * 200, style: { order: '' }, getBoundingClientRect: () => ({ width: 180 }) }))
  const track = Object.assign(new EventTarget(), { children: Object.assign(children, { item: (index: number) => children[index] }), clientWidth: width, scrollWidth: count * 200, scrollLeft: 0, getBoundingClientRect: () => ({ top: 100, bottom: 500 }), scrollTo: vi.fn(({ left }: { left: number }) => { track.scrollLeft = left }) })
  let root: ReturnType<typeof HorizontalSlider>
  const render = () => {
    hooks.cursor = 0
    root = HorizontalSlider({ className: 'test-track', ariaLabel: 'Top tours', previousLabel: 'Previous', nextLabel: 'Next', rotationLabels: { pause: 'Pause', play: 'Play' }, autoAdvanceMs: 5000, ...options, children: Array.from({ length: count }, (_, i) => createElement('article', { key: i }, 'Tour ' + i)) })
    const region = find(root, element => element.props.role === 'region')
    if (region) (region.props.ref as { current: unknown }).current = track
    const pending = hooks.pending.splice(0); pending.forEach(effect => effect())
    return root!
  }
  render(); render()
  return { track, win, doc, motion, disconnect, render, animate: (time: number) => animation(time), resize: () => resize(), get root() { return root! }, region: () => find(root, node => node.props.role === 'region')!, button: (label: string) => find(root, node => node.props['aria-label'] === label)! }
}

beforeEach(() => { hooks.cursor = 0; hooks.cells = []; hooks.pending = []; vi.useFakeTimers(); vi.setSystemTime(100_000) })
afterEach(() => {
  for (const cell of hooks.cells) (cell as Effect | undefined)?.cleanup?.()
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks()
})

describe('horizontal tour slider interaction', () => {
  it('treats mouse hover as pause without leaving touch users stuck in synthetic hover', () => {
    const f = fixture(8, 720, { continuous: true, arrowsOnly: true })
    f.animate(1000)
    fire(f.root!, 'onPointerEnter', { pointerType: 'touch' }); fire(f.root!, 'onPointerDown'); fire(f.root!, 'onFocusCapture'); fire(f.root!, 'onPointerUp')
    f.animate(1016); expect(f.track.scrollLeft).toBeGreaterThan(0)
    const before = f.track.scrollLeft
    fire(f.root!, 'onPointerEnter', { pointerType: 'mouse' }); f.animate(1032)
    expect(f.track.scrollLeft).toBe(before)
    fire(f.root!, 'onPointerLeave', { pointerType: 'mouse' }); f.animate(1048)
    expect(f.track.scrollLeft).toBeGreaterThan(before)
  })
  it('resumes continuous movement after mouse arrow clicks instead of keeping pointer focus paused', () => {
    const f = fixture(8, 720, { continuous: true, arrowsOnly: true })
    f.animate(1000)
    fire(f.root!, 'onPointerEnter', { pointerType: 'mouse' }); fire(f.root!, 'onPointerDown'); fire(f.root!, 'onFocusCapture'); fire(f.root!, 'onPointerUp')
    fire(f.button('Next'), 'onClick')
    for (let time = 1016; time <= 1400; time += 16) f.animate(time)
    fire(f.root!, 'onPointerLeave', { pointerType: 'mouse' })
    const before = f.track.scrollLeft
    f.animate(1416)
    expect(f.track.scrollLeft).toBeGreaterThan(before)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('keeps continuous movement paused for keyboard focus without affecting pointer resumption', () => {
    const f = fixture(8, 720, { continuous: true, arrowsOnly: true })
    f.animate(1000); fire(f.root!, 'onFocusCapture'); fire(f.root!, 'onPointerLeave', { pointerType: 'mouse' }); f.animate(1016)
    expect(f.track.scrollLeft).toBe(0)
    fire(f.root!, 'onBlurCapture', { currentTarget: { contains: () => false }, relatedTarget: null }); f.animate(1032)
    expect(f.track.scrollLeft).toBeGreaterThan(0)
  })
  it('groups arrows and the action into one footer with no counter, dots or playback button', () => {
    const f = fixture(11, 800, { arrowsOnly: true, footerAction: createElement('a', { href: '/trips' }, 'View All') })
    const footer = find(f.root, node => node.props.className === 'horizontal-slider-footer')!
    expect(find(footer, node => node.props.className === 'horizontal-slider-nav')).toBeDefined()
    expect(find(footer, node => node.props.className === 'horizontal-slider-action')).toBeDefined()
    expect(Children.toArray(find(footer, node => node.props.className === 'horizontal-slider-nav')!.props.children as ReactNode).filter(isValidElement)).toHaveLength(2)
    expect(f.button('Pause')).toBeUndefined()
    expect(find(f.root, node => ['horizontal-slider-count', 'horizontal-slider-dots'].includes(String(node.props.className)))).toBeUndefined()
    vi.advanceTimersByTime(5000); expect(f.track.scrollLeft).toBe(200)
    fire(f.button('Next'), 'onClick'); expect(f.track.scrollLeft).toBe(400)
  })
  it('retains the footer action even when no arrows are needed', () => {
    const f = fixture(1, 800, { arrowsOnly: true, footerAction: createElement('a', { href: '/trips' }, 'View All') })
    expect(f.button('Next')).toBeUndefined()
    expect(find(f.root, node => node.props.href === '/trips')).toBeDefined()
  })
  it('advances, loops, pauses and resumes without duplicating cards', () => {
    const f = fixture()
    vi.advanceTimersByTime(5000); expect(f.track.scrollLeft).toBe(200)
    vi.advanceTimersByTime(20_000); expect(f.track.scrollLeft).toBe(0)
    fire(f.button('Pause'), 'onClick'); f.render()
    vi.advanceTimersByTime(10_000); expect(f.track.scrollLeft).toBe(0)
    fire(f.button('Play'), 'onClick'); f.render()
    vi.advanceTimersByTime(5000); expect(f.track.scrollLeft).toBe(200)
    expect(Children.count(f.region().props.children as ReactNode)).toBe(6)
  })
  it('does not resume on mouse leave while a card still has keyboard focus', () => {
    const f = fixture()
    fire(f.root!, 'onFocusCapture'); fire(f.root!, 'onPointerEnter', { pointerType: 'mouse' }); fire(f.root!, 'onPointerLeave', { pointerType: 'mouse' })
    vi.advanceTimersByTime(5000); expect(f.track.scrollTo).not.toHaveBeenCalled()
    fire(f.root!, 'onBlurCapture', { currentTarget: { contains: () => true }, relatedTarget: {} })
    vi.advanceTimersByTime(5000); expect(f.track.scrollTo).not.toHaveBeenCalled()
    fire(f.root!, 'onBlurCapture', { currentTarget: { contains: () => false }, relatedTarget: null })
    vi.advanceTimersByTime(5000); expect(f.track.scrollLeft).toBe(200)
  })
  it('pauses during swipes, hidden tabs, offscreen rendering and live reduced-motion changes', () => {
    const f = fixture()
    fire(f.root!, 'onPointerDown'); vi.advanceTimersByTime(5000)
    expect(f.track.scrollTo).not.toHaveBeenCalled()
    fire(f.root!, 'onPointerUp'); f.doc.visibilityState = 'hidden'; vi.advanceTimersByTime(5000)
    f.doc.visibilityState = 'visible'; f.motion.matches = true; vi.advanceTimersByTime(5000)
    f.motion.matches = false; f.track.getBoundingClientRect = () => ({ top: 900, bottom: 1300 }); vi.advanceTimersByTime(5000)
    expect(f.track.scrollTo).not.toHaveBeenCalled()
    f.track.getBoundingClientRect = () => ({ top: 100, bottom: 500 }); vi.advanceTimersByTime(5000)
    expect(f.track.scrollLeft).toBe(200)
  })
  it('synchronizes touch scrolling before manual arrows and honors reduced motion for keyboard navigation', () => {
    const f = fixture()
    f.track.scrollLeft = 400; fire(f.region(), 'onScroll'); f.render()
    fire(f.button('Next'), 'onClick'); expect(f.track.scrollLeft).toBe(600)
    f.motion.matches = true
    const target = {}, event = { target, currentTarget: target, key: 'End', preventDefault: vi.fn() }
    fire(f.region(), 'onKeyDown', event)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(f.track.scrollTo).toHaveBeenLastCalledWith({ left: 800, behavior: 'auto' })
    fire(f.region(), 'onKeyDown', { ...event, target: {}, key: 'ArrowRight' })
    expect(f.track.scrollLeft).toBe(800) // Card image controls keep their own key events.
  })
  it('remeasures responsive widths, hides unnecessary controls and cleans up effects', () => {
    const f = fixture(4, 400)
    expect(f.button('Next')).toBeDefined()
    f.track.clientWidth = 800; f.resize(); f.render()
    expect(f.button('Next')).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
    for (const cell of hooks.cells) (cell as Effect | undefined)?.cleanup?.()
    expect(f.disconnect).toHaveBeenCalled()
  })
  it('renders no empty region or autoplay for an empty catalogue', () => {
    const f = fixture(0)
    expect(f.root).toBeNull(); expect(vi.getTimerCount()).toBe(0)
  })
})
