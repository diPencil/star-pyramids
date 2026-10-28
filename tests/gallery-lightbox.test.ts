import { describe, expect, it, vi } from 'vitest'
import { bindGalleryDialog, galleryNextIndex, stopGalleryVideo } from '@/lib/gallery-lightbox'
import { safeGalleryLocalPath, validateGalleryOrder, validateGalleryPayload, resolveGalleryVideoSource } from '@/lib/journey-gallery'

function fixture() {
  const listeners = new Map<string, (event: unknown) => void>()
  const doc = { activeElement: null as unknown, body: { style: { overflow: 'auto' } }, addEventListener: vi.fn((name, callback) => listeners.set(name, callback)), removeEventListener: vi.fn((name) => listeners.delete(name)) }
  const control = () => ({ hidden: false, tagName: 'BUTTON', isConnected: true, focus: vi.fn(function (this: unknown) { doc.activeElement = this }) })
  const previous = control(), first = control(), last = control()
  const video = { pause: vi.fn(), removeAttribute: vi.fn(), load: vi.fn() }
  doc.activeElement = previous
  const dialog = { querySelectorAll: (selector: string) => selector === 'video' ? [video] : [first, last], focus: vi.fn(), contains: (value: unknown) => [first, last].includes(value as typeof first) }
  const close = vi.fn(), navigate = vi.fn()
  const cleanup = bindGalleryDialog(doc as unknown as Document, dialog as unknown as HTMLElement, close, navigate)
  const key = (name: string, shiftKey = false, target: unknown = first) => { const event = { key: name, shiftKey, target, preventDefault: vi.fn() }; listeners.get('keydown')?.(event); return event }
  return { doc, previous, first, last, video, dialog, close, navigate, cleanup, key, listeners }
}
describe('dialog lifecycle without browser execution', () => {
  it('locks scrolling and focuses close; restores original focus/scroll on closing', () => {
    const f = fixture(); expect(f.doc.body.style.overflow).toBe('hidden'); expect(f.doc.activeElement).toBe(f.first)
    f.cleanup(); expect(f.doc.body.style.overflow).toBe('auto'); expect(f.doc.activeElement).toBe(f.previous); expect(f.previous.focus).toHaveBeenCalledWith({ preventScroll: true }); expect(f.listeners.size).toBe(0)
  })
  it('traps Tab in both directions and handles Escape', () => {
    const f = fixture(); f.doc.activeElement = f.last
    expect(f.key('Tab').preventDefault).toHaveBeenCalled(); expect(f.doc.activeElement).toBe(f.first)
    f.key('Tab', true); expect(f.doc.activeElement).toBe(f.last)
    f.key('Escape'); expect(f.close).toHaveBeenCalledTimes(1); f.cleanup()
  })
  it('navigates using arrows without stealing native player keys', () => {
    const f = fixture(); f.key('ArrowRight'); f.key('ArrowLeft'); expect(f.navigate.mock.calls).toEqual([[1], [-1]])
    f.key('ArrowRight', false, { tagName: 'VIDEO' }); expect(f.navigate).toHaveBeenCalledTimes(2); f.cleanup()
  })
  it('stops and unloads the player when closing or changing media', () => {
    const f = fixture(); f.cleanup(); expect(f.video.pause).toHaveBeenCalledTimes(1); expect(f.video.removeAttribute).toHaveBeenCalledWith('src'); expect(f.video.load).toHaveBeenCalledTimes(1)
    const next = { pause: vi.fn(), removeAttribute: vi.fn(), load: vi.fn() }; stopGalleryVideo(next as unknown as HTMLVideoElement); expect(next.pause).toHaveBeenCalledTimes(1); stopGalleryVideo(null)
  })
  it.each([[0, -1, 3, 2], [2, 1, 3, 0], [0, 1, 1, 0], [0, -1, 1, 0], [0, 1, 0, -1]])('wraps index %i by %i in %i items', (current, delta, count, expected) => expect(galleryNextIndex(current, delta, count)).toBe(expected))
})
it.each(['//evil.example/video.mp4', '/\\evil.example/a.mp4', '/%2e%2e/secret.mp4', '/x/%ZZ.mp4'])('rejects unsafe local media %s', source => {
  expect(safeGalleryLocalPath(source)).toBe(false)
  expect(resolveGalleryVideoSource(source)).toBeNull()
})
it('rejects images presented as videos and videos presented as photos', () => {
  expect(resolveGalleryVideoSource('/media/picture.jpg')).toBeNull()
  expect(validateGalleryPayload({ mediaType: 'IMAGE', mediaUrl: '/clip.mp4', title: 'Example', showOnHomepage: true }).ok).toBe(false)
})
it.each([null, [], [{ id: 'one', sortOrder: 1 }, { id: 'one', sortOrder: 2 }], [{ id: 'one', sortOrder: -1 }], [{ id: 'one', sortOrder: '2' }]])('rejects invalid reorder atomically: %j', value => expect(validateGalleryOrder(value)).toBe(false))
it('accepts unique integer positions without mutating supplied order', () => {
  const rows = [{ id: 'first', sortOrder: 20 }, { id: 'second', sortOrder: 10 }]
  expect(validateGalleryOrder(rows)).toBe(true); expect(rows[0].sortOrder).toBe(20)
})
