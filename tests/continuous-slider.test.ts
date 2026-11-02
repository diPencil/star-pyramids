import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindContinuousSlider } from '@/lib/continuous-slider'

const releases: Array<() => void> = []
afterEach(() => { releases.splice(0).forEach(release => release()); vi.unstubAllGlobals() })

function fixture(count = 8, viewport = 720) {
  const frames = new Map<number, FrameRequestCallback>()
  let id = 0, time = 1000, allow = true, left = 0, resize = () => {}
  const cards = Array.from({ length: count }, (_, index) => ({ id: index, style: { order: '' }, getBoundingClientRect: () => ({ width: 180 }) }))
  const track = Object.assign(new EventTarget(), {
    children: cards, clientWidth: viewport, scrollWidth: count * 200 - 20,
    getBoundingClientRect: () => ({ top: 100, bottom: 500 }),
    scrollTo: vi.fn(({ left: value }: { left: number }) => { track.scrollLeft = value }),
  }) as unknown as HTMLElement
  Object.defineProperty(track, 'scrollLeft', { get: () => left, set: (value: number) => { left = Math.max(0, Math.min(value, track.scrollWidth - track.clientWidth)) } })
  const doc = { visibilityState: 'visible' }, motion = { matches: false }
  const win = Object.assign(new EventTarget(), {
    innerHeight: 800, matchMedia: () => motion, getComputedStyle: () => ({ columnGap: '20px' }),
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++id, callback); return id },
    cancelAnimationFrame: (key: number) => { frames.delete(key) },
  })
  const disconnect = vi.fn()
  vi.stubGlobal('window', win); vi.stubGlobal('document', doc)
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback } observe() {} disconnect = disconnect })
  const onOverflow = vi.fn()
  const controller = bindContinuousSlider(track, { canMove: () => allow, onOverflow })
  releases.push(controller.dispose)
  const frame = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time)) }
  frame()
  const advance = (ms: number) => { const end = time + ms; while (time < end) { time = Math.min(end, time + 16); frame() } }
  const order = () => [...cards].sort((a, b) => Number(a.style.order) - Number(b.style.order)).map(card => card.id)
  return { track, cards, frames, controller, advance, onOverflow, order, motion, doc, win, disconnect, pause: (paused: boolean) => { allow = !paused }, resize: () => resize() }
}

describe('continuous infinite tour movement', () => {
  it('moves on every frame at a time-based speed without interval waits', () => {
    const f = fixture()
    f.advance(16); expect(f.track.scrollLeft).toBeCloseTo(0.64)
    f.advance(984); expect(f.track.scrollLeft).toBeCloseTo(40)
    expect(f.onOverflow).toHaveBeenCalledWith(8)
  })
  it('recycles original cards across the boundary without clones or a jump to the start', () => {
    const f = fixture()
    const identities = [...f.cards]
    f.track.scrollLeft = 199
    f.advance(32)
    expect(f.order()).toEqual([1, 2, 3, 4, 5, 6, 7, 0])
    expect(f.track.scrollLeft).toBeCloseTo(0.28)
    f.advance(40_000)
    expect(f.cards).toEqual(identities)
    expect(f.track.children).toHaveLength(8)
    expect(f.track.scrollLeft).toBeCloseTo(0.28)
  })
  it('stops for hover/interaction and resumes next frame without a five-second delay', () => {
    const f = fixture()
    f.advance(1000); f.pause(true); f.advance(20_000)
    expect(f.track.scrollLeft).toBeCloseTo(40)
    f.pause(false); f.advance(16)
    expect(f.track.scrollLeft).toBeCloseTo(40.64)
  })
  it('keeps arrow navigation working while hovered, including backwards across the seam', () => {
    const f = fixture()
    f.pause(true); f.controller.move(-1); f.advance(350)
    expect(f.order()[0]).toBe(7)
    expect(f.track.scrollLeft).toBeCloseTo(0)
    f.controller.move(1); f.advance(350)
    expect(f.order()[0]).toBe(0)
    f.advance(1000); expect(f.track.scrollLeft).toBeCloseTo(0)
    f.pause(false); f.advance(16); expect(f.track.scrollLeft).toBeCloseTo(0.64)
  })
  it('honors live reduced motion and hidden tabs without catch-up jumps', () => {
    const f = fixture()
    f.motion.matches = true; f.advance(10_000); expect(f.track.scrollLeft).toBe(0)
    f.controller.move(1); expect(f.order()[0]).toBe(1)
    f.doc.visibilityState = 'hidden'; f.motion.matches = false; f.advance(10_000)
    expect(f.track.scrollLeft).toBe(0)
    f.doc.visibilityState = 'visible'; f.advance(16); expect(f.track.scrollLeft).toBeCloseTo(0.64)
  })
  it('cancels arrow animation on a manual gesture and restores all styles/listeners on disposal', () => {
    const f = fixture()
    f.pause(true); f.controller.move(1); f.track.dispatchEvent(new Event('pointerdown')); f.advance(400)
    expect(f.track.scrollLeft).toBe(0)
    f.controller.jump(5); expect(f.order()[0]).toBe(5)
    f.controller.dispose()
    expect(f.frames.size).toBe(0)
    expect(f.disconnect).toHaveBeenCalled()
    expect(f.cards.every(card => card.style.order === '')).toBe(true)
    f.advance(1000); expect(f.track.scrollLeft).toBe(0)
  })
  it('keeps insufficient/fully fitting collections manually scrollable without fake extra cards', () => {
    const f = fixture(2, 250)
    f.advance(10_000); expect(f.track.scrollLeft).toBe(0)
    f.controller.move(1); expect(f.track.scrollTo).toHaveBeenCalledWith({ left: 130, behavior: 'smooth' })
    Object.defineProperty(f.track, 'clientWidth', { value: 400, configurable: true }); f.resize()
    expect(f.onOverflow).toHaveBeenLastCalledWith(1)
  })
})
