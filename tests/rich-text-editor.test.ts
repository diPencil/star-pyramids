import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getSchema, type Extensions } from '@tiptap/core'
import { beforeEach, expect, it, vi } from 'vitest'

const captured = vi.hoisted(() => ({ options: {} as Record<string, unknown> }))
vi.mock('@tiptap/react', () => ({
  useEditor: (options: Record<string, unknown>) => { captured.options = options; return null },
  useEditorState: () => null,
  EditorContent: () => null,
}))
import { RichTextEditor } from '@/components/admin/rich-text-editor'

beforeEach(() => { captured.options = {} })
it('initializes plain legacy content as escaped paragraphs without emitting a conversion', () => {
  const change = vi.fn()
  renderToStaticMarkup(createElement(RichTextEditor, { label: 'Overview', value: 'Literal <b>text</b>\nNext', locale: 'en', onChange: change }))
  expect(captured.options.content).toBe('<p>Literal &lt;b&gt;text&lt;/b&gt;</p><p>Next</p>')
  expect(captured.options.immediatelyRender).toBe(false)
  expect(change).not.toHaveBeenCalled()
})
it('emits normalized content from transactions through the parent callback', () => {
  const change = vi.fn()
  renderToStaticMarkup(createElement(RichTextEditor, { label: 'Overview', value: '', locale: 'es', onChange: change }))
  ;(captured.options.onUpdate as (event: unknown) => void)({ editor: { getHTML: () => '<p><b>Visita</b></p>' } })
  expect(change).toHaveBeenCalledWith('<p><strong>Visita</strong></p>')
})
it('uses a schema without code/media/tables and registers marks/alignment once', () => {
  renderToStaticMarkup(createElement(RichTextEditor, { label: 'Description', value: '', locale: 'en', onChange: vi.fn() }))
  const schema = getSchema(captured.options.extensions as Extensions)
  expect(Object.keys(schema.marks)).toEqual(expect.arrayContaining(['bold', 'italic', 'underline', 'link']))
  for (const forbidden of ['image', 'table', 'codeBlock', 'blockquote', 'horizontalRule']) expect(schema.nodes[forbidden]).toBeUndefined()
  expect(schema.marks.code).toBeUndefined()
  expect(schema.nodes.heading.spec.parseDOM?.map(rule => 'tag' in rule ? rule.tag : '')).toEqual(['h2', 'h3'])
})
it.each([
  ['en', 'Bold', 'Clear formatting'], ['es', 'Negrita', 'Quitar formato'], ['it', 'Grassetto', 'Rimuovi formattazione'],
] as const)('provides labeled native controls in %s without changing the parent language tabs', (locale, bold, clear) => {
  const html = renderToStaticMarkup(createElement(RichTextEditor, { label: 'Overview', value: '', locale, onChange: vi.fn(), disabled: true }))
  expect(html).toContain(`aria-label="${bold}"`)
  expect(html).toContain(`aria-label="${clear}"`)
  expect(html).toContain('type="button"')
  expect(html).toContain('disabled=""')
})
