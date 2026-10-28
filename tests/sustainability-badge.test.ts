import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ failed: null as string | null, set: vi.fn() }))
vi.mock('react', async (original) => ({ ...await original<typeof import('react')>(), useState: () => [state.failed, state.set] }))
import { SustainabilityBadge, sustainabilityImage } from '@/components/sustainability-badge'
const props = { image: 'https://images.example.com/purpose.jpg', first: 'Travel', second: 'Responsibly', caption: 'People, Places, Planet' }
beforeEach(() => { state.failed = null; state.set.mockReset() })
describe('sustainability badge loading', () => {
  it('handles load errors without leaving a broken image and allows a replacement', () => {
    const tree = SustainabilityBadge(props)
    const image = tree.props.children[3] as ReactElement<{ onError: () => void }>
    image.props.onError()
    expect(state.set).toHaveBeenCalledWith(props.image)
    state.failed = props.image
    const fallback = renderToStaticMarkup(createElement(SustainabilityBadge, props))
    expect(fallback).not.toContain('<img')
    expect(fallback).toContain('sus-ring')
    expect(fallback).toContain('Responsibly')
    expect(renderToStaticMarkup(createElement(SustainabilityBadge, { ...props, image: 'https://images.example.com/replacement.jpg' }))).toContain('<img')
  })
  it('accepts existing stored URLs but rejects unsafe sources', () => {
    const stored = '/media/2026/10/' + 'a'.repeat(32) + '.webp'
    expect(sustainabilityImage(stored)).toBe(stored)
    for (const invalid of [null, undefined, 'javascript:alert(1)', 'https://localhost/a.jpg', 'http://example.com/a.jpg']) expect(sustainabilityImage(invalid)).toBe('')
  })
})
