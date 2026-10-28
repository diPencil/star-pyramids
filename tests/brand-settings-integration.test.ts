import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ favicon: '/media/2026/10/' + 'a'.repeat(32) + '.webp' }))
vi.mock('@/lib/admin-store', () => ({ defaultBrandSettings: { favicon: '/favicon.png' }, useBrandSettings: () => state }))
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useEffect: (effect: () => void) => effect() }))
import { BrandMark } from '@/components/brand-mark'
import { BrandFavicon } from '@/components/brand-favicon'
beforeEach(() => { state.favicon = '/media/2026/10/' + 'a'.repeat(32) + '.webp'; vi.unstubAllGlobals() })
describe('saved branding shared across dashboards and browser icons', () => {
  it('uses the saved compact image, preserves layout attributes and updates on replacement', () => {
    const render = () => renderToStaticMarkup(createElement(BrandMark, { alt: '', width: 24, className: 'identity' }))
    expect(render()).toContain(state.favicon)
    expect(render()).toContain('class="identity"')
    expect(render()).toContain('width="24"')
    state.favicon = '/media/2026/10/' + 'b'.repeat(32) + '.jpg'
    expect(render()).toContain(state.favicon)
    expect(render()).not.toContain('a'.repeat(32))
    state.favicon = ''
    expect(render()).toContain('src="/favicon.png"')
  })
  it('updates all browser/Apple icons and can reset to the default after a custom upload', () => {
    const links = [0, 1, 2].map(() => ({ href: '/favicon.png', removeAttribute: vi.fn() }))
    vi.stubGlobal('document', { querySelectorAll: vi.fn(() => links) })
    BrandFavicon()
    for (const link of links) { expect(link.href).toBe(state.favicon); expect(link.removeAttribute).toHaveBeenCalledWith('type') }
    state.favicon = '/favicon.png'
    BrandFavicon()
    expect(links.every(link => link.href === '/favicon.png')).toBe(true)
  })
  it('creates a browser icon when none exists', () => {
    const link = { rel: '', href: '' }
    const appendChild = vi.fn()
    vi.stubGlobal('document', { querySelectorAll: () => [], createElement: () => link, head: { appendChild } })
    BrandFavicon()
    expect(link).toMatchObject({ rel: 'icon', href: state.favicon })
    expect(appendChild).toHaveBeenCalledWith(link)
  })
})
