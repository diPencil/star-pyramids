import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({ cells: [] as unknown[], cursor: 0 }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: <T,>(initial: T) => {
    const index = hooks.cursor++
    if (!(index in hooks.cells)) hooks.cells[index] = initial
    return [hooks.cells[index], (next: T) => { hooks.cells[index] = next }]
  },
  useCallback: (callback: unknown) => callback,
  useEffect: () => {},
}))
vi.mock('@/components/locale', () => ({ useLocale: () => ({ locale: 'en' }), tx: (_locale: string, copy: { en: string }) => copy.en }))
import { ProviderReviewsSection } from '@/components/provider-reviews'
import { WebsiteReviews } from '@/components/website-reviews'
import { ReviewWriteModal } from '@/components/reviews'

type Element = ReactElement<Record<string, unknown>>
function nodes(tree: ReactNode): Element[] { return Children.toArray(tree).flatMap(child => isValidElement<Record<string, unknown>>(child) ? [child, ...nodes(child.props.children as ReactNode)] : []) }
const fire = (element: Element, prop: string) => (element.props[prop] as () => void)()
const render = () => { hooks.cursor = 0; return ProviderReviewsSection() }
beforeEach(() => { hooks.cells = []; hooks.cursor = 0 })

describe('local review feed and write dialog reconciliation identities', () => {
  it.each(['all', 'website', 'trips'] as const)('keeps the %s feed identity stable and distinct through ten open/close cycles', scope => {
    let tree = render()
    const tab = nodes(tree).find(node => node.props['aria-label'] === ({ all: 'All reviews', website: 'Website reviews', trips: 'Trip reviews' }[scope]))!
    fire(tab, 'onClick'); tree = render()
    const originalKey = nodes(tree).find(node => node.type === WebsiteReviews)!.key
    for (let cycle = 0; cycle < 10; cycle++) {
      fire(nodes(tree).find(node => node.type === 'button' && node.props.className === 'rev-write')!, 'onClick')
      tree = render()
      const feed = nodes(tree).find(node => node.type === WebsiteReviews)!
      const dialog = nodes(tree).find(node => node.type === ReviewWriteModal)!
      expect(feed.key).toBe(originalKey)
      expect(dialog.key).not.toBe(feed.key)
      const container = tree.props.children as Element
      const siblings = Children.toArray(container.props.children as ReactNode).filter(isValidElement)
      expect(new Set(siblings.map(node => node.key)).size).toBe(siblings.length)
      fire(dialog, 'onClose'); tree = render()
      expect(nodes(tree).filter(node => node.type === ReviewWriteModal)).toHaveLength(0)
      expect(nodes(tree).filter(node => node.type === WebsiteReviews)).toHaveLength(1)
      expect(nodes(tree).find(node => node.type === WebsiteReviews)!.key).toBe(originalKey)
    }
  })
  it('keeps one feed after a successful pending submission without creating a published review', () => {
    let tree = render()
    fire(nodes(tree).find(node => node.props['aria-label'] === 'Trip reviews')!, 'onClick'); tree = render()
    fire(nodes(tree).find(node => node.type === 'button' && node.props.className === 'rev-write')!, 'onClick'); tree = render()
    fire(nodes(tree).find(node => node.type === ReviewWriteModal)!, 'onSubmit'); tree = render()
    expect(nodes(tree).filter(node => node.type === WebsiteReviews)).toHaveLength(1)
    expect(nodes(tree).filter(node => node.type === ReviewWriteModal)).toHaveLength(0)
    expect(nodes(tree).find(node => node.props.role === 'status')?.props.children).toContain('awaiting approval')
  })
})
