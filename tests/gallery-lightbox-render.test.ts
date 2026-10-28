import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { GalleryItem } from '@/lib/journey-gallery'

const state = vi.hoisted(() => ({ calls: 0 }))
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, useState: (initial: unknown) => actual.useState(state.calls++ === 0 ? true : initial) }
})
vi.mock('react-dom', async () => ({ ...await vi.importActual<typeof import('react-dom')>('react-dom'), createPortal: (children: unknown) => children }))
import { GalleryLightbox, GalleryLightboxMedia } from '@/components/gallery-lightbox'
const item = (id: string, video = false): GalleryItem => ({ id, mediaType: video ? 'VIDEO' : 'IMAGE', mediaUrl: video ? '/legacy/clip.mp4' : `/photos/${id}.jpg`, title: `Actual ${id}`, caption: `Caption ${id}`, thumbnail: video ? '/poster.jpg' : null, platform: video ? 'direct' : null, showOnHomepage: true, showOnTours: false, tourScope: 'ALL_TOURS', tourSlugs: [], isPublished: true, sortOrder: 1, createdAt: '', updatedAt: '' })
beforeEach(() => { state.calls = 0; vi.stubGlobal('document', { body: {} }) })
it('opens the selected image, caption and collection counter in a semantic dialog', () => {
  const html = renderToStaticMarkup(createElement(GalleryLightbox, { items: [item('first'), item('second')], selectedId: 'second', locale: 'en', onSelect: () => {}, onClose: () => {} }))
  expect(html).toContain('role="dialog"'); expect(html).toContain('aria-modal="true"'); expect(html).toContain('2 / 2'); expect(html).toContain('src="/photos/second.jpg"'); expect(html).not.toContain('/photos/first.jpg'); expect(html).toContain('Caption second')
  expect(html).toContain('Previous media'); expect(html).toContain('Next media')
})
it('hides collection navigation for one item and localizes controls', () => {
  const html = renderToStaticMarkup(createElement(GalleryLightbox, { items: [item('one')], selectedId: 'one', locale: 'es', onSelect: () => {}, onClose: () => {} }))
  expect(html).toContain('Cerrar vista previa'); expect(html).toContain('1 / 1'); expect(html).not.toContain('Archivo siguiente')
})
it('renders native video controls and poster with no autoplay', () => {
  const html = renderToStaticMarkup(createElement(GalleryLightbox, { items: [item('video', true)], selectedId: 'video', locale: 'it', onSelect: () => {}, onClose: () => {} }))
  expect(html).toContain('<video'); expect(html).toContain('controls=""'); expect(html).toContain('playsInline=""'); expect(html).toContain('poster="/poster.jpg"'); expect(html).not.toMatch(/autoplay/i)
})
it('contains portrait and landscape originals without next/image fill or distortion', () => {
  const css = readFileSync('components/gallery-lightbox.css', 'utf8')
  expect(css).toContain('object-fit:contain'); expect(css).toContain('width:auto'); expect(css).toContain('height:auto'); expect(css).toContain('safe-area-inset-top'); expect(css).toContain('prefers-reduced-motion')
})
