import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// A small hook harness lets navigation callbacks run without a browser or an
// extra renderer dependency. SSR below separately checks the actual output.
const state = vi.hoisted(() => ({ direct: false, selected: undefined as string | undefined }))
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual,
    useId: () => state.direct ? 'timeline-test' : actual.useId(),
    useState: (initial: unknown) => state.direct ? [state.selected ?? initial, (value: string) => { state.selected = value }] : actual.useState(initial),
  }
})
vi.mock('@/lib/tours-client', () => ({ useDbToursStatus: () => ({ data: [], loading: false, error: null, retry: vi.fn() }) }))
import { CreationTimeline, type CreationTimelineProps } from '@/components/admin/creation-timeline'
import { BlogEditorialForm, type BlogEditorialFormSection } from '@/components/admin/blog-editorial-form'
import { emptyBlogEditorial } from '@/lib/blog-editorial'

type ElementProps = { children?: ReactNode; onClick?: () => void; disabled?: boolean; hidden?: boolean; id?: string; 'aria-current'?: string; 'aria-controls'?: string; 'aria-labelledby'?: string; className?: string }
function elements(node: ReactNode): ReactElement<ElementProps>[] {
  return Children.toArray(node).flatMap(child => isValidElement<ElementProps>(child) ? [child, ...elements(child.props.children)] : [])
}
const steps = [
  { id: 'identity', label: 'Identity', content: createElement('input', { name: 'title', defaultValue: 'Unsaved title' }) },
  { id: 'media', label: 'Media', content: createElement('input', { name: 'image', defaultValue: '/unsaved.jpg' }) },
  { id: 'publish', label: 'Review & publish', content: createElement('input', { name: 'published', type: 'checkbox' }) },
]
const draw = (props: Partial<CreationTimelineProps> = {}) => {
  state.direct = true
  try { return CreationTimeline({ steps, ...props }) } finally { state.direct = false }
}
const buttons = (tree: ReactNode) => elements(tree).filter(node => node.type === 'button')
const panels = (tree: ReactNode) => elements(tree).filter(node => node.type === 'section')
const active = (tree: ReactNode) => buttons(tree).find(node => node.props['aria-current'] === 'step')
beforeEach(() => { state.selected = undefined; state.direct = false })

describe('shared creation timeline navigation and retained panels', () => {
  it('renders an ordered accessible timeline with explicit non-submitting buttons', () => {
    const html = renderToStaticMarkup(createElement(CreationTimeline, { steps, ariaLabel: 'Story creation' }))
    expect(html).toContain('aria-label="Story creation"')
    expect(html).toContain('<ol')
    expect(html.match(/type="button"/g)).toHaveLength(5)
    expect(html).not.toContain('type="submit"')
    expect(html).not.toContain('dir=')
    expect(html.match(/aria-current="step"/g)).toHaveLength(1)
  })

  it('links every step button to its retained labelled panel with unique IDs', () => {
    const tree = draw(), nodes = buttons(tree), sections = panels(tree)
    expect(sections).toHaveLength(3)
    sections.forEach((panel, index) => {
      expect(nodes[index].props['aria-controls']).toBe(panel.props.id)
      expect(panel.props['aria-labelledby']).toBe(nodes[index].props.id)
      expect(panel.props.hidden).toBe(index !== 0)
    })
    expect(new Set(sections.map(panel => panel.props.id)).size).toBe(3)
  })

  it('supports direct navigation plus bounded Next and Back without validating or saving', () => {
    let tree = draw()
    expect(buttons(tree)[3].props.disabled).toBe(true)
    buttons(tree)[4].props.onClick?.()
    tree = draw()
    expect(active(tree)?.props.id).toContain('media')
    buttons(tree)[4].props.onClick?.()
    tree = draw()
    expect(active(tree)?.props.id).toContain('publish')
    expect(buttons(tree)[4].props.disabled).toBe(true)
    buttons(tree)[4].props.onClick?.()
    expect(state.selected).toBe('publish')
    buttons(tree)[3].props.onClick?.()
    expect(active(draw())?.props.id).toContain('media')
    buttons(draw())[0].props.onClick?.()
    expect(active(draw())?.props.id).toContain('identity')
  })

  it('retains the same keyed child elements while changing hidden state', () => {
    const first = panels(draw())
    buttons(draw())[1].props.onClick?.()
    const second = panels(draw())
    expect(second.map(panel => panel.key)).toEqual(first.map(panel => panel.key))
    second.forEach((panel, index) => expect(panel.props.children).toBe(first[index].props.children))
    expect(second.map(panel => panel.props.hidden)).toEqual([true, false, true])
    const html = renderToStaticMarkup(draw())
    for (const value of ['Unsaved title', '/unsaved.jpg', 'name="published"']) expect(html).toContain(value)
    expect(html.match(/ hidden=""/g)).toHaveLength(2)
  })

  it('keeps the error/save footer outside every hidden panel', () => {
    const save = vi.fn()
    const footer = createElement('div', null, createElement('p', { role: 'alert' }, 'Validation failed'), createElement('button', { type: 'button', onClick: save }, 'Save changes'))
    const tree = draw({ footer, initialStepId: 'media' })
    expect(panels(tree).every(panel => !elements(panel).some(child => child.props.onClick === save))).toBe(true)
    const saveButton = buttons(tree).find(node => node.props.onClick === save)
    expect(saveButton).toBeDefined()
    saveButton?.props.onClick?.()
    expect(save).toHaveBeenCalledTimes(1)
    expect(renderToStaticMarkup(tree)).toContain('role="alert"')
  })

  it('blocks direct/next/back navigation while busy without disabling caller save controls', () => {
    const tree = draw({ busy: true, initialStepId: 'media' })
    for (const button of buttons(tree)) { expect(button.props.disabled).toBe(true); button.props.onClick?.() }
    expect(state.selected).toBeUndefined()
    expect(active(draw({ busy: true, initialStepId: 'media' }))?.props.id).toContain('media')
  })

  it('uses stable IDs when steps reorder and safely handles removed/unknown IDs and empty lists', () => {
    buttons(draw())[1].props.onClick?.()
    expect(active(draw({ steps: [steps[2], steps[1], steps[0]] }))?.props.id).toContain('media')
    expect(active(draw({ steps: [steps[0], steps[2]] }))?.props.id).toContain('identity')
    state.selected = undefined
    expect(active(draw({ initialStepId: 'unknown' }))?.props.id).toContain('identity')
    expect(buttons(draw({ steps: [] }))).toHaveLength(0)
  })

  it('uses a single step without permitting out-of-range navigation', () => {
    const tree = draw({ steps: [steps[0]] })
    expect(buttons(tree).slice(1).every(button => button.props.disabled)).toBe(true)
    expect(panels(tree)[0].props.hidden).toBe(false)
  })
})

const paths = ['multi-day-categories', 'events', 'offers', 'blogs'] as const
function sourceTree(page: string) {
  const path = `app/admin/${page}/new/page.tsx`
  const source = readFileSync(path, 'utf8')
  return { source, root: ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) }
}
function findNodes(root: ts.Node, predicate: (node: ts.Node) => boolean): ts.Node[] {
  const result: ts.Node[] = []
  const walk = (node: ts.Node) => { if (predicate(node)) result.push(node); ts.forEachChild(node, walk) }
  walk(root)
  return result
}
const tag = (node: ts.Node) => ts.isJsxSelfClosingElement(node) ? node.tagName.getText() : ts.isJsxElement(node) ? node.openingElement.tagName.getText() : ''

describe('creation form source integration boundaries', () => {
  it.each(paths)('%s retains client directive, media/translation fields and existing save handler', page => {
    const { source, root } = sourceTree(page)
    expect(source.trimStart().startsWith("'use client'")).toBe(true)
    expect(findNodes(root, node => tag(node) === 'CreationTimeline').length).toBeGreaterThan(0)
    for (const name of ['ContentLanguageTabs', 'ImageField', 'TranslatedInput']) expect(findNodes(root, node => tag(node) === name).length).toBeGreaterThan(0)
    expect(source.match(/onClick=\{save\}/g)!.length).toBeGreaterThanOrEqual(2)
    for (const timeline of findNodes(root, node => tag(node) === 'CreationTimeline')) {
      expect(timeline.getText()).toContain('busy={saving}')
      let ancestor = timeline.parent
      while (ancestor) { expect(tag(ancestor)).not.toBe('p'); ancestor = ancestor.parent }
    }
    // Every stored validation/API error remains outside the steps property,
    // either in the timeline footer or immediately after the timeline.
    const alerts = findNodes(root, node => ts.isJsxExpression(node) && /^\{error &&/.test(node.getText()))
    expect(alerts.length).toBeGreaterThan(0)
    for (const alert of alerts) {
      let ancestor = alert.parent
      while (ancestor) {
        if (ts.isJsxAttribute(ancestor)) expect(ancestor.name.getText()).not.toBe('steps')
        ancestor = ancestor.parent
      }
    }
  })

  it('integrates all nine destination content steps while keeping the existing save/error controls global', () => {
    const { source, root } = sourceTree('destinations')
    const timeline = findNodes(root, node => tag(node) === 'CreationTimeline')[0]
    expect(timeline).toBeDefined()
    for (const id of ['hero', 'facts', 'story', 'experiences', 'rhythm', 'practical', 'trips', 'cover', 'publish']) expect(timeline.getText()).toContain(`id: '${id}'`)
    expect(source).toContain('busy={saving || uploading}')
    expect(source).toContain('expectedUpdatedAt: editing?.updatedAt')
    expect(source).toContain('onClick={save}')
    const alerts = findNodes(root, node => ts.isJsxExpression(node) && /^\{error &&/.test(node.getText()))
    expect(alerts.length).toBeGreaterThan(0)
    for (const alert of alerts) { let ancestor = alert.parent; while (ancestor) { if (ts.isJsxAttribute(ancestor)) expect(ancestor.name.getText()).not.toBe('steps'); ancestor = ancestor.parent } }
  })
  it('keeps all existing event groups, blog article editor and category tour assignment controls', () => {
    const event = sourceTree('events').source
    for (const value of ['setHighlights', 'setProgram', 'setIncluded', 'setExcluded', 'setAddOns', 'setOrganizerPhone', 'setBookingDeadline', 'setGalleryDraft', 'setPublished']) expect(event).toContain(value)
    const blog = sourceTree('blogs').source
    for (const section of ['hero', 'facts', 'sections', 'navigation', 'practical', 'cta']) expect(blog).toContain(`<BlogEditorialForm section="${section}" value={editorial} onChange={setEditorial} />`)
    expect(blog).toContain('validateBlogEditorial')
    const category = sourceTree('multi-day-categories').source
    for (const value of ['setLinkedSlugs', 'initialSlugs.filter', 'categorySlugs', 'setPublished', 'setOrder']) expect(category).toContain(value)
  })

  it('uses declarative stable offer steps rather than dropping steps when mode changes', () => {
    const { root } = sourceTree('offers')
    const timeline = findNodes(root, node => tag(node) === 'CreationTimeline')[0] as ts.JsxSelfClosingElement
    const attribute = timeline.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText() === 'steps') as ts.JsxAttribute
    expect(attribute.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression && ts.isArrayLiteralExpression(attribute.initializer.expression)).toBe(true)
    const text = timeline.getText()
    for (const id of ['method', 'details', 'pricing', 'content', 'publishing']) expect(text).toContain(`id: '${id}'`)
    for (const value of ['setMode', 'PromoBarFields', 'CampaignFields', 'setPercent', 'setTourSlug', 'setPublished']) expect(text).toContain(value)
    expect(text).not.toContain('steps={mode')
  })

  it('enforces hidden panels despite inherited grid styles and reuses existing timeline tokens', () => {
    const css = readFileSync('components/admin/creation-timeline.css', 'utf8')
    expect(css).toContain('.sp-creation-panel[hidden]{display:none!important}')
    expect(css).toContain('var(--sp-blue)')
    expect(css).toContain('minmax(90px,1fr)')
  })
})

describe('blog editorial presentation-only sections', () => {
  const sections: BlogEditorialFormSection[] = ['hero', 'facts', 'sections', 'navigation', 'practical', 'cta']
  const titles = ['Article hero', 'At-a-glance facts', 'Article sections', 'Guide navigation &amp; sidebar', 'Tips, quote &amp; checklist', 'Final journey call to action']
  it('preserves default all-sections rendering for existing consumers', () => {
    const html = renderToStaticMarkup(createElement(BlogEditorialForm, { value: emptyBlogEditorial(), onChange: vi.fn() }))
    for (const title of titles) expect(html).toContain(title)
  })
  it.each(sections)('renders only %s without duplicating other editorial fields', section => {
    const html = renderToStaticMarkup(createElement(BlogEditorialForm, { section, value: emptyBlogEditorial(), onChange: vi.fn() }))
    titles.forEach((title, index) => expect(html.includes(title)).toBe(index === sections.indexOf(section)))
  })
  it('renders all six mounted timeline panels with the same fields as the default editor', () => {
    const value = emptyBlogEditorial(), onChange = vi.fn()
    const all = renderToStaticMarkup(createElement(BlogEditorialForm, { value, onChange }))
    const html = renderToStaticMarkup(createElement(CreationTimeline, { steps: sections.map(section => ({ id: section, label: section, content: createElement(BlogEditorialForm, { section, value, onChange }) })) }))
    for (const title of titles) expect(html).toContain(title)
    expect(html.match(/ hidden=""/g)).toHaveLength(5)
    for (const tag of ['input', 'textarea', 'button']) expect(html.match(new RegExp(`<${tag}(?=[ >])`, 'g'))?.length ?? 0).toBe((all.match(new RegExp(`<${tag}(?=[ >])`, 'g'))?.length ?? 0) + (tag === 'button' ? 8 : 0))
  })
})
