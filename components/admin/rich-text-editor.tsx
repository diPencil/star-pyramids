'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { Plugin } from '@tiptap/pm/state'
import { DOMSerializer } from '@tiptap/pm/model'
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline, List, ListOrdered, Link, Unlink, Undo2, Redo2, RemoveFormatting } from 'lucide-react'
import { legacyEditorHtml, normalizeTourPaste, richTextPlain, safeRichLink, sanitizeTourHtml, type RichLocale } from '@/lib/tours/tour-rich-text'
import { tx } from '@/components/locale'
import '@/components/tours/detail/tour-rich-text.css'
import './rich-text-editor.css'

// Persist a finite alignment class, never arbitrary inline CSS.
export const TourTextAlign = TextAlign.extend({
  addGlobalAttributes() {
    return [{ types: ['heading', 'paragraph'], attributes: { textAlign: {
      default: null,
      parseHTML: element => ['left', 'center', 'right'].find(value => element.classList.contains(`sp-rich-align-${value}`)) ?? null,
      renderHTML: attrs => ['left', 'center', 'right'].includes(attrs.textAlign) ? { class: `sp-rich-align-${attrs.textAlign}` } : {},
    } } }]
  },
}).configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right'] })

/** One mounted instance per field/locale. Parent owns every edit; mounting is not an edit. */
export function RichTextEditor({ value, format, locale, label, disabled = false, onChange, onComposing }: {
  value: string; format?: string; locale: RichLocale; label: string; disabled?: boolean;
  onChange: (html: string) => void; onComposing?: (active: boolean) => void;
}) {
  const labelId = useId(), errorId = useId()
  const [error, setError] = useState(''), [linkOpen, setLinkOpen] = useState(false), [href, setHref] = useState('')
  const observed = useRef({ value, format })
  const change = useRef(onChange), composing = useRef(onComposing)
  change.current = onChange; composing.current = onComposing
  const t = (en: string, es: string, it: string) => tx(locale, { en, es, it })
  const message = (reason: unknown) => setError(t('This change could not be applied. Check the link or shorten the content (64 KiB, 8 levels).', 'No se pudo aplicar el cambio. Revisa el enlace o reduce el contenido (64 KiB, 8 niveles).', 'Impossibile applicare la modifica. Controlla il link o riduci il contenuto (64 KiB, 8 livelli).') + (reason instanceof Error ? ` ${reason.message}` : ''))
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, blockquote: false, code: false, codeBlock: false, horizontalRule: false, strike: false,
        link: { openOnClick: false, autolink: false, linkOnPaste: false, isAllowedUri: url => safeRichLink(url), HTMLAttributes: { target: null, rel: 'noopener noreferrer' } } }),
      TourTextAlign,
      Extension.create({ name: 'tourDocumentLimits', addProseMirrorPlugins() { return [new Plugin({ filterTransaction: transaction => {
        if (!transaction.docChanged) return true
        try {
          const container = document.createElement('div')
          container.appendChild(DOMSerializer.fromSchema(transaction.doc.type.schema).serializeFragment(transaction.doc.content))
          sanitizeTourHtml(container.innerHTML, true)
          return true
        } catch (reason) { queueMicrotask(() => message(reason)); return false }
      } })] } }),
    ],
    content: format === 'html-v1' ? sanitizeTourHtml(value) : legacyEditorHtml(value),
    editable: !disabled,
    editorProps: {
      attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-labelledby': labelId, 'aria-describedby': errorId, lang: locale },
      handlePaste(view, event) {
        const html = event.clipboardData?.getData('text/html'), plain = event.clipboardData?.getData('text/plain')
        if (!html && !plain) return false
        event.preventDefault()
        try {
          const safe = html ? normalizeTourPaste(html) : sanitizeTourHtml(legacyEditorHtml(plain ?? ''))
          if (!richTextPlain(safe, 'html-v1').trim()) {
            setError(t('The clipboard contains no supported text.', 'El portapapeles no contiene texto compatible.', 'Gli appunti non contengono testo supportato.'))
            return true
          }
          setError('')
          // The filterTransaction guard rejects oversize combined documents atomically.
          editor?.commands.insertContent(safe)
        } catch (reason) { message(reason) }
        return true
      },
      handleDOMEvents: { compositionstart: () => { composing.current?.(true); return false }, compositionend: () => { composing.current?.(false); return false } },
    },
    onUpdate: ({ editor }) => {
      setError('')
      const html = sanitizeTourHtml(editor.getHTML())
      // Track the parent's normalized empty representation too; avoid replacing a live
      // document after each keystroke (which would destroy selection/history).
      const empty = !richTextPlain(html, 'html-v1').trim()
      observed.current = { value: empty ? '' : html, format: empty ? undefined : 'html-v1' }
      change.current(html)
    },
  })
  useEffect(() => {
    if (!editor || observed.current.value === value && observed.current.format === format) return
    editor.commands.setContent(format === 'html-v1' ? sanitizeTourHtml(value) : legacyEditorHtml(value), { emitUpdate: false })
    observed.current = { value, format }
  }, [editor, value, format])
  useEffect(() => { editor?.setEditable(!disabled) }, [editor, disabled])
  useEffect(() => () => composing.current?.(false), [])
  const state = useEditorState({ editor, selector: ({ editor }) => editor ? {
    bold: editor.isActive('bold'), italic: editor.isActive('italic'), underline: editor.isActive('underline'),
    bullet: editor.isActive('bulletList'), ordered: editor.isActive('orderedList'), link: editor.isActive('link'),
    block: editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p',
    align: editor.isActive({ textAlign: 'center' }) ? 'center' : editor.isActive({ textAlign: 'right' }) ? 'right' : 'left',
    undo: editor.can().undo(), redo: editor.can().redo(),
  } : null })
  const button = (title: string, Icon: typeof Bold, action: () => void, active?: boolean, unavailable = false) =>
    <button type="button" title={title} aria-label={title} aria-pressed={active} disabled={disabled || !editor || unavailable} onMouseDown={event => event.preventDefault()} onClick={action}><Icon size={16}/></button>
  return <div className="sp-rich-editor">
    <span id={labelId} className="sp-rich-label">{label}</span>
    <div className="sp-rich-toolbar" role="group" aria-label={t('Text formatting', 'Formato de texto', 'Formattazione del testo')}>
      <select aria-label={t('Paragraph style', 'Estilo de párrafo', 'Stile del paragrafo')} value={state?.block ?? 'p'} disabled={disabled || !editor} onChange={event => { const command = editor?.chain().focus(); if (event.target.value === 'p') command?.setParagraph().run(); else command?.setHeading({ level: event.target.value === 'h2' ? 2 : 3 }).run() }}>
        <option value="p">{t('Paragraph', 'Párrafo', 'Paragrafo')}</option><option value="h2">H2</option><option value="h3">H3</option>
      </select>
      {button(t('Bold', 'Negrita', 'Grassetto'), Bold, () => editor?.chain().focus().toggleBold().run(), state?.bold)}
      {button(t('Italic', 'Cursiva', 'Corsivo'), Italic, () => editor?.chain().focus().toggleItalic().run(), state?.italic)}
      {button(t('Underline', 'Subrayado', 'Sottolineato'), Underline, () => editor?.chain().focus().toggleUnderline().run(), state?.underline)}
      {button(t('Bulleted list', 'Lista con viñetas', 'Elenco puntato'), List, () => editor?.chain().focus().toggleBulletList().run(), state?.bullet)}
      {button(t('Numbered list', 'Lista numerada', 'Elenco numerato'), ListOrdered, () => editor?.chain().focus().toggleOrderedList().run(), state?.ordered)}
      {button(t('Link', 'Enlace', 'Collegamento'), Link, () => { setHref(editor?.getAttributes('link').href ?? ''); setLinkOpen(value => !value) }, state?.link)}
      {button(t('Remove link', 'Quitar enlace', 'Rimuovi collegamento'), Unlink, () => editor?.chain().focus().unsetLink().run())}
      {button(t('Align left', 'Alinear a la izquierda', 'Allinea a sinistra'), AlignLeft, () => editor?.chain().focus().setTextAlign('left').run(), state?.align === 'left')}
      {button(t('Align center', 'Centrar', 'Centra'), AlignCenter, () => editor?.chain().focus().setTextAlign('center').run(), state?.align === 'center')}
      {button(t('Align right', 'Alinear a la derecha', 'Allinea a destra'), AlignRight, () => editor?.chain().focus().setTextAlign('right').run(), state?.align === 'right')}
      {button(t('Undo', 'Deshacer', 'Annulla'), Undo2, () => editor?.chain().focus().undo().run(), undefined, !state?.undo)}
      {button(t('Redo', 'Rehacer', 'Ripeti'), Redo2, () => editor?.chain().focus().redo().run(), undefined, !state?.redo)}
      {button(t('Clear formatting', 'Quitar formato', 'Rimuovi formattazione'), RemoveFormatting, () => editor?.chain().focus().unsetAllMarks().clearNodes().unsetTextAlign().run())}
    </div>
    {linkOpen && <div className="sp-rich-link"><input type="url" value={href} disabled={disabled} aria-label={t('Link URL (HTTPS or /path)', 'URL del enlace (HTTPS o /ruta)', 'URL del link (HTTPS o /percorso)')} placeholder="https://…" onChange={event => setHref(event.target.value)}/><button type="button" className="sp-btn" disabled={disabled} onClick={() => {
      if (!safeRichLink(href)) { setError(t('Use an HTTPS URL or a site-root path.', 'Usa una URL HTTPS o una ruta del sitio.', 'Usa un URL HTTPS o un percorso del sito.')); return }
      editor?.chain().focus().extendMarkRange('link').setLink({ href }).run(); setLinkOpen(false); setError('')
    }}>{t('Apply link', 'Aplicar enlace', 'Applica link')}</button></div>}
    <EditorContent editor={editor} className="tour-rich-text sp-rich-canvas"/>
    <p id={errorId} className="sp-rich-error" role={error ? 'alert' : undefined}>{error}</p>
  </div>
}
