import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import postcss from 'postcss'
import { beforeEach, expect, it, vi } from 'vitest'
import { ReviewTripPicker } from '@/components/review-trip-picker'
import { filterReviewTrips, REVIEW_TRIP_TYPES, reviewTripTypeLabel, type ReviewTripChoice } from '@/lib/review-trip-options'
import type { Locale } from '@/lib/locale-config'

const hooks = vi.hoisted(() => ({ cells: [] as unknown[], cursor: 0 }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(), useId: () => 'review-trip-search',
  useState: <T,>(value: T) => { const index = hooks.cursor++; if (!(index in hooks.cells)) hooks.cells[index] = value; return [hooks.cells[index], (next: T) => { hooks.cells[index] = next }] },
  useRef: <T,>(value: T) => { const index = hooks.cursor++; return hooks.cells[index] ?? (hooks.cells[index] = { current: value }) },
}))
type Element = ReactElement<Record<string, unknown>>
function nodes(tree: ReactNode): Element[] { return Children.toArray(tree).flatMap(child => isValidElement<Record<string, unknown>>(child) ? [child, ...nodes(child.props.children as ReactNode)] : []) }
function text(tree: ReactNode): string { return Children.toArray(tree).map(child => isValidElement<Record<string, unknown>>(child) ? text(child.props.children as ReactNode) : String(child)).join(' ') }
const fire = (element: Element, handler: string, event?: unknown) => (element.props[handler] as (event: unknown) => void)(event)
const tours: ReviewTripChoice[] = [
  { slug: 'cairo-day', title: 'Cairo Pyramids', category: 'one-day-tours' },
  { slug: 'cairo-package', title: 'Cairo Five Days', category: 'multi-days-tours' },
  { slug: 'nile', title: 'Nile Four Nights', category: 'nile-cruises' },
  { slug: 'alexandria-port', title: 'Alexandria Shore Trip', category: 'shore-excursions' },
  { slug: 'dinner', title: 'Nile Dinner Cruise', category: 'one-day-tours' },
  { slug: 'long-title', title: 'A very long authentic tour title '.repeat(12), category: 'one-day-tours' },
]
function fixture(locale: Locale = 'en') {
  let value = '', tree: ReactNode
  const changed = vi.fn((next: string) => { value = next })
  const render = () => { hooks.cursor = 0; tree = ReviewTripPicker({ tours, value, onChange: changed, locale }); return tree }
  const input = () => nodes(tree).find(node => node.props.role === 'combobox')!
  const options = () => nodes(tree).filter(node => node.props.role === 'option')
  const query = (value: string) => { fire(input(), 'onChange', { target: { value } }); render() }
  render()
  return { render, input, options, query, changed, get tree() { return tree }, get value() { return value }, open: () => { fire(input(), 'onFocus'); render() }, filter: (category: string) => { fire(nodes(tree).find(node => node.type === 'button' && text(node) === reviewTripTypeLabel(category, locale))!, 'onClick'); render() } }
}
beforeEach(() => { hooks.cells = []; hooks.cursor = 0 })

it('searches by trip name, filters the actual stored category and does not infer category from a title', () => {
  const f = fixture(); f.open(); expect(f.options()).toHaveLength(6)
  f.query('CAIRO'); expect(f.options()).toHaveLength(2)
  f.filter('nile-cruises'); expect(f.options()).toHaveLength(0)
  expect(text(f.tree)).toContain('No matching trips')
  f.query(''); expect(f.options()).toHaveLength(1)
  expect(text(f.options()[0])).toContain('Nile Four Nights')
  expect(text(f.options()[0])).not.toContain('Nile Dinner Cruise')
})
it.each(['en', 'es', 'it'] as const)('renders all four accurate type labels and a localized search field in %s', locale => {
  const f = fixture(locale); f.open()
  for (const category of REVIEW_TRIP_TYPES) expect(text(f.tree)).toContain(reviewTripTypeLabel(category, locale))
  expect(f.input().props.placeholder).toBe({ en: 'Search trip name…', es: 'Buscar por nombre del viaje…', it: 'Cerca il nome del viaggio…' }[locale])
  expect(nodes(f.tree).some(node => node.type === 'select')).toBe(false)
})
it('requires choosing a real result and clears the old selection when typing a different name', () => {
  const f = fixture(); f.open()
  fire(f.options()[0], 'onClick'); f.render()
  expect(f.value).toBe('cairo-day'); expect(f.input().props['aria-expanded']).toBe(false)
  expect(text(f.tree)).toContain('Cairo Pyramids')
  f.query('Cairo Five Days'); expect(f.value).toBe('')
  expect(f.options()).toHaveLength(1)
  fire(f.options()[0], 'onClick'); f.render(); expect(f.value).toBe('cairo-package')
})
it('supports arrows and Enter selection, and Escape dismisses the list without dismissing the review dialog', () => {
  const f = fixture(); f.open()
  const event = (key: string) => ({ key, preventDefault: vi.fn(), stopPropagation: vi.fn() })
  fire(f.input(), 'onKeyDown', event('ArrowDown')); f.render()
  expect(f.input().props['aria-activedescendant']).toBe('review-trip-search-option-1')
  const enter = event('Enter'); fire(f.input(), 'onKeyDown', enter); f.render()
  expect(enter.preventDefault).toHaveBeenCalledOnce(); expect(f.value).toBe('cairo-package')
  f.open(); const escape = event('Escape'); fire(f.input(), 'onKeyDown', escape); f.render()
  expect(escape.stopPropagation).toHaveBeenCalledOnce(); expect(f.input().props['aria-expanded']).toBe(false)
})
it('clears the choice deliberately and restores all types', () => {
  const f = fixture(); f.filter('shore-excursions')
  fire(f.options()[0], 'onClick'); f.render()
  fire(nodes(f.tree).find(node => node.props['aria-label'] === 'Clear selected trip')!, 'onClick'); f.render()
  expect(f.value).toBe(''); expect(f.options()).toHaveLength(6)
})
it('keeps unknown categories honest and never turns search text into a fabricated tour', () => {
  expect(reviewTripTypeLabel('unmapped', 'en')).toBe('Tour type unavailable')
  expect(filterReviewTrips(tours, 'not a real tour', 'all', 'en')).toEqual([])
  expect(reviewTripTypeLabel('nile-cruises', 'ar')).toBe('Nile Cruises')
})
it('bounds the inline result list and wraps long titles instead of rendering a native or floating popup', () => {
  const root = postcss.parse(readFileSync('components/reviews-phase6.css', 'utf8'))
  const rules = new Map<string, Record<string, string>>()
  root.walkRules(rule => { const values: Record<string, string> = {}; rule.walkDecls(decl => { values[decl.prop] = decl.value }); rules.set(rule.selector, values); if (rule.selector.includes('.rev-trip')) expect(['absolute', 'fixed']).not.toContain(values.position) })
  expect(rules.get('.rev-trip-results')).toMatchObject({ 'max-width': '100%', 'max-height': 'min(220px,28dvh)', 'overflow-y': 'auto', 'overflow-x': 'hidden' })
  expect(rules.get('.rev-trip-results strong,.rev-trip-selected strong')).toMatchObject({ 'white-space': 'normal', 'overflow-wrap': 'anywhere' })
})
