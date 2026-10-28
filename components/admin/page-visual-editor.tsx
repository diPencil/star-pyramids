'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, EyeOff, Plus, RotateCcw, Save, Send, Trash2 } from 'lucide-react'
import { PageHead } from './admin-shell'
import { AdminConfirmDialog } from './admin-confirm-dialog'
import { toast } from './admin-toaster'
import { SharedSelect } from '@/components/shared-select'
import { ENABLED_LOCALES, type EnabledLocale } from '@/lib/locale-config'
import { pageSections, CMS_ICON_IDS, originalPageContent, validatePageContent, type PageContent, type PageContentState, type PageSection, type SectionItem, type CmsIconId } from '@/lib/page-sections'
import { PAGE_DOCUMENTS, type PageDocumentId } from '@/lib/additional-page-content'
import { isTemplatePageId } from '@/lib/template-presentation'
import type { HeroAction } from '@/lib/website-heroes'
import { CmsIcon } from '@/components/cms-icons'
import { CmsLinkField, CmsRecordPicker } from './cms-reference-picker'
import { CmsDevicePreview } from './cms-device-preview'
import { protectEnquiryNavigation } from '@/lib/enquiry-navigation'
import { cmsFieldMax } from '@/lib/page-sections'

const fieldLabel = (key: string) => ({ xmasT: 'Heading', xmasS: 'Description', popT: 'Heading', popS: 'Description', tripT: 'Heading', tripS: 'Description', startPlan: 'Planning button', offE: 'Eyebrow', offT: 'Heading', offS: 'Description', howT: 'Heading', howS: 'Description', hlT: 'Heading', hlS: 'Description', blogT: 'Heading', blogS: 'Description', readMore: 'Article link label', susE: 'Eyebrow', susT1: 'Heading, first line', susT2: 'Heading, emphasized line', susP: 'Description', susCta: 'Button label', susB1: 'Badge, first line', susB2: 'Badge, second line', susB3: 'Badge caption', galT: 'Heading', galS: 'Description', faqT: 'Heading', faqS: 'Description', faqAll: 'FAQ button label', helpT: 'Heading', helpS: 'Description', contactNow: 'Form submit label', viewAll: 'View-all button label' } as Record<string, string>)[key] ?? key.replace(/\b\w/g, (char) => char.toUpperCase())
function IconPicker({ value, onChange, disabled }: { value?: CmsIconId; onChange: (id: CmsIconId) => void; disabled: boolean }) {
  const [query, setQuery] = useState('')
  return <div className="cms-icon-picker"><label>Find an icon<input value={query} onChange={(event) => setQuery(event.target.value)} disabled={disabled} /></label><div>{CMS_ICON_IDS.filter((id) => id.toLowerCase().includes(query.toLowerCase())).map((id) => <button key={id} type="button" className="sp-btn" aria-pressed={value === id} aria-label={id} title={id} disabled={disabled} onClick={() => onChange(id)}><CmsIcon id={id} size={20} /></button>)}</div></div>
}
export function PageVisualEditor({ pageId = 'homepage' }: { pageId?: PageDocumentId }) {
  const definitions = pageSections(pageId)
  const original = () => originalPageContent(pageId)
  const endpoint = '/api/admin/website-cms/pages/' + pageId
  const router = useRouter()
  const [state, setState] = useState<PageContentState | null>(null)
  const [draft, setDraft] = useState<PageContent>(original)
  const [active, setActive] = useState(pageId === 'homepage' ? 'featured' : definitions[1].id)
  const [locale, setLocale] = useState<EnabledLocale>('en')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [error, setError] = useState('')
    const [confirm, setConfirm] = useState<HeroAction | 'reload' | null>(null)
  const [removeItem, setRemoveItem] = useState<string | null>(null)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)
  const lock = useRef(false)
  const dirtyRef = useRef(false)
  dirtyRef.current = dirty
  const pendingRef = useRef(false)
  const navigate = (action: () => void) => { if (lock.current || pendingRef.current) return; pendingRef.current = true; setPendingNavigation(() => action) }
  useEffect(() => {
    const cleanup = protectEnquiryNavigation(window, () => dirtyRef.current, navigate)
    const click = (event: MouseEvent) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href)
      if (url.origin !== location.origin || url.pathname + url.search === location.pathname + location.search) return
      event.preventDefault(); event.stopPropagation(); navigate(() => router.push(url.pathname + url.search + url.hash))
    }
    document.addEventListener('click', click, true)
    return () => { cleanup(); document.removeEventListener('click', click, true) }
  }, [router])
  const load = async () => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { const response = await fetch(endpoint, { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(); setState(data.state); setDraft(data.state.draft ?? data.state.published ?? original()); setCanEdit(data.canEdit); setDirty(false); dirtyRef.current = false }
    catch { setError('Could not load the page. Reload to retry.') }
    finally { lock.current = false; setBusy(false) }
  }
  useEffect(() => { void load() }, [])
  const change = (content: PageContent) => { setDraft(content); setDirty(true) }
  const changeSection = (next: PageSection) => change({ ...draft, sections: draft.sections.map((section) => section.id === next.id ? next : section) })
  const section = draft.sections.find((section) => section.id === active)!
  const definition = definitions.find((section) => section.id === active)!
  const disabled = !state || !canEdit || busy
  const move = (index: number, delta: number) => { const next = [...draft.sections]; const target = index + delta; if (index === 0 || target <= 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; change({ ...draft, sections: next }) }
  const changeItem = (next: SectionItem) => changeSection({ ...section, items: section.items?.map((item) => item.id === next.id ? next : item) })
  const uploadImage = async (file: File | undefined, onReady: (url: string) => void) => {
    if (!file || disabled || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const body = new FormData(); body.append('file', file); body.append('type', 'image')
      const response = await fetch('/api/admin/website-cms/hero-media', { method: 'POST', body })
      const data = await response.json()
      if (!response.ok || typeof data?.media?.url !== 'string') throw new Error(data.error || 'Upload failed.')
      onReady(data.media.url)
    } catch (error) { setError(error instanceof Error ? error.message : 'Upload failed.') }
    finally { lock.current = false; setBusy(false) }
  }
  const moveItem = (index: number, delta: number) => { const next = [...(section.items ?? [])]; const target = index + delta; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; changeSection({ ...section, items: next }) }
  const addItem = () => { const fields = Object.fromEntries((definition.itemFields ?? []).map((field) => [field, ''])); changeSection({ ...section, items: [...(section.items ?? []), { id: 'item-' + crypto.randomUUID(), visible: true, text: { en: { ...fields }, es: { ...fields }, it: { ...fields } }, ...(definition.icons ? { icon: 'Star' as const } : {}), ...(definition.numbers ? { value: 0, prefix: '', suffix: '', decimals: 0 } : {}), ...(active === 'how' || definition.itemHref ? { href: '/contact' } : {}), ...(definition.itemImage ? { image: '/egypt-hero.png' } : {}) }] }) }
  const action = async (command: HeroAction) => {
    if (!state || !canEdit || lock.current) return
    setError('')
    let content: PageContent | undefined
    if (command === 'save-draft') { try { content = validatePageContent(draft, pageId) } catch (error) { setError((error as Error).message); return } }
    lock.current = true; setBusy(true)
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: command, revision: state.revision, ...(content ? { content } : {}) }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not save the page.')
      setState(data.state); setDraft(data.state.draft ?? data.state.published ?? original()); setDirty(false); dirtyRef.current = false
      if (command === 'save-draft') toast.success('Draft saved. The public page is unchanged.', { dedupeKey: 'page-visual-draft' })
      else if (command === 'publish') toast.success('Page sections and their order published.', { dedupeKey: 'page-visual-publish' })
      else if (command === 'restore') toast.success('Original page sections restored. Existing hero content is unchanged.', { dedupeKey: 'page-visual-restore' })
      else toast.success('Optional page sections unpublished. Search and forms remain available.', { dedupeKey: 'page-visual-unpublish' })
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save the page.') }
    finally { lock.current = false; setBusy(false); setConfirm(null) }
  }
  const textFields = (fields: readonly string[], values: Record<string, string>, update: (key: string, value: string) => void, labels?: Record<string, string>) => fields.map((key) => <label key={key}>{labels?.[key] ?? fieldLabel(key)} ({locale.toUpperCase()})<textarea rows={key.toLowerCase().includes('description') || key.endsWith('S') || key === 'answer' ? 4 : 2} maxLength={cmsFieldMax(key)} disabled={disabled} value={values[key]} onChange={(event) => update(key, event.target.value)} /></label>)
  return <>
    <PageHead eyebrow="WEBSITE CMS" title={PAGE_DOCUMENTS[pageId].name} sub={state ? `Revision ${state.revision} · ${state.mode}${dirty ? ' · Unsaved changes' : ''}` : 'Loading page content…'} backHref="/admin/website-cms/pages" />
    <div className="cms-editor-toolbar"><nav aria-label="Content language">{ENABLED_LOCALES.map((language) => <button className="sp-btn" type="button" key={language} aria-pressed={locale === language} onClick={() => setLocale(language)}>{language.toUpperCase()} · {draft.sections.every((s) => Object.values(s.text[language]).every((value) => value.trim()) && (s.items ?? []).every((item) => Object.values(item.text[language]).every((value) => value.trim()))) ? 'Complete' : 'Check fields'}</button>)}</nav><div>
      <button className="sp-btn" type="button" disabled={busy} onClick={() => dirty ? setConfirm('reload') : void load()}><RotateCcw size={16} /> Reload</button>
      <button className="sp-btn" type="button" disabled={disabled || !dirty} onClick={() => void action('save-draft')}><Save size={16} /> Save Draft</button>
      <button className="sp-btn" type="button" disabled={disabled || dirty || !state?.draft} onClick={() => setConfirm('publish')}><Send size={16} /> Publish</button>
      <button className="sp-btn" type="button" disabled={disabled || dirty || state?.mode !== 'published' || definitions.every(section => section.mandatory)} onClick={() => setConfirm('unpublish')}><EyeOff size={16} /> Unpublish</button>
      <button className="sp-btn" type="button" disabled={disabled} onClick={() => setConfirm('restore')}><RotateCcw size={16} /> Restore</button>
    </div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="cms-visual-layout"><aside><h3>Page sections</h3><nav aria-label="Page sections">{draft.sections.map((item, index) => <div key={item.id}><button type="button" className="sp-btn" aria-pressed={active === item.id} onClick={() => setActive(item.id)}>{index + 1}. {definitions.find((s) => s.id === item.id)!.name}{!item.visible && ' · Hidden'}</button><div><button className="sp-btn" type="button" title="Move section up" aria-label={`Move ${item.id} up`} disabled={disabled || index <= 1} onClick={() => move(index, -1)}><ArrowUp size={14} /></button><button className="sp-btn" type="button" title="Move section down" aria-label={`Move ${item.id} down`} disabled={disabled || index === 0 || index === draft.sections.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></button></div></div>)}</nav></aside>
      <section className="cms-field-panel"><h2>{definition.name}</h2><fieldset disabled={disabled}>
        <label className="cms-checkbox"><input type="checkbox" checked={section.visible} disabled={disabled || definition.mandatory} onChange={(event) => changeSection({ ...section, visible: event.target.checked })} /> Visible on this page{definition.mandatory && ' (required)'}</label>
        {definition.editor && <Link href={definition.editor} className="sp-btn">{active === 'hero' ? 'Open existing hero editor' : 'Manage source records'}</Link>}
        {textFields(definition.fields, section.text[locale], (key, value) => changeSection({ ...section, text: { ...section.text, [locale]: { ...section.text[locale], [key]: value } } }), definition.fieldLabels)}
        {definition.mediaFields?.map((key) => <label key={key}>{key === 'badgeImage' ? 'Sustainability badge image URL (optional)' : 'Section image URL'}<input maxLength={2000} value={section.media?.[key] ?? ''} onChange={(event) => changeSection({ ...section, media: { ...section.media, [key]: event.target.value } })} /><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { void uploadImage(event.target.files?.[0], (url) => changeSection({ ...section, media: { ...section.media, [key]: url } })); event.target.value = '' }} />{key === 'badgeImage' && <button type="button" className="sp-btn" disabled={disabled || !section.media?.[key]} onClick={() => changeSection({ ...section, media: { ...section.media, [key]: '' } })}>Remove image</button>}</label>)}
        {definition.linkFields?.map((key) => <CmsLinkField key={key} value={section.links?.[key] ?? ''} disabled={disabled} onChange={(href) => changeSection({ ...section, links: { ...section.links, [key]: href } })} />)}
        {definition.href && <CmsLinkField value={section.href!} disabled={disabled} onChange={(href) => changeSection({ ...section, href })} />}
        {definition.source && <><label>Content selection<SharedSelect label="Content selection mode" value={section.selectionMode!} disabled={disabled} options={[{ value: 'automatic', label: 'Existing automatic selection' }, { value: 'selected', label: 'Selected published records' }]} onChange={(selectionMode) => changeSection({ ...section, selectionMode: selectionMode as 'automatic' | 'selected' })} /></label><label>Display limit (0 keeps the original selection)<input type="number" min={0} max={definition.limit} value={section.limit} onChange={(event) => changeSection({ ...section, limit: Number(event.target.value) })} /></label>{section.selectionMode === 'selected' && <CmsRecordPicker source={definition.source} selected={section.selection ?? []} disabled={disabled} onChange={(selection) => changeSection({ ...section, selection })} />}</>}
        {definition.itemFields && <div className="cms-repeatable-items">{section.items?.map((item, index) => <fieldset className="cms-repeatable-item" disabled={disabled} key={item.id}><legend>Item {index + 1}</legend><div className="cms-item-tools"><label className="cms-checkbox"><input type="checkbox" checked={item.visible} onChange={(event) => changeItem({ ...item, visible: event.target.checked })} /> Show item</label><button className="sp-btn" type="button" title="Move item up" aria-label={`Move item ${index + 1} up`} disabled={disabled || index === 0} onClick={() => moveItem(index, -1)}><ArrowUp size={16} /></button><button className="sp-btn" type="button" title="Move item down" aria-label={`Move item ${index + 1} down`} disabled={disabled || index === section.items!.length - 1} onClick={() => moveItem(index, 1)}><ArrowDown size={16} /></button><button className="sp-btn" type="button" title="Remove item" aria-label={`Remove item ${index + 1}`} disabled={disabled || section.items!.length <= (definition.minItems ?? 0)} onClick={() => setRemoveItem(item.id)}><Trash2 size={16} /></button></div>
          {textFields(definition.itemFields!, item.text[locale], (key, value) => changeItem({ ...item, text: { ...item.text, [locale]: { ...item.text[locale], [key]: value } } }))}
          {definition.icons && <IconPicker value={item.icon} disabled={disabled} onChange={(icon) => changeItem({ ...item, icon })} />}
          {definition.numbers && <div className="cms-number-fields">{(['value', 'decimals'] as const).map((key) => <label key={key}>{fieldLabel(key)}<input type="number" min={0} max={key === 'decimals' ? 2 : 1000000000} step={key === 'decimals' ? 1 : 'any'} value={item[key]} onChange={(event) => changeItem({ ...item, [key]: Number(event.target.value) })} /></label>)}{(['prefix', 'suffix'] as const).map((key) => <label key={key}>{fieldLabel(key)}<input maxLength={10} value={item[key]} onChange={(event) => changeItem({ ...item, [key]: event.target.value })} /></label>)}</div>}
          {(active === 'how' || definition.itemHref) && <CmsLinkField value={item.href!} disabled={disabled} onChange={(href) => changeItem({ ...item, href })} />}
          {definition.itemImage && <label>Card image URL<input maxLength={2000} value={item.image ?? ''} onChange={(event) => changeItem({ ...item, image: event.target.value })} /><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { void uploadImage(event.target.files?.[0], (image) => changeItem({ ...item, image })); event.target.value = '' }} /></label>}
        </fieldset>)}<button className="sp-btn" type="button" disabled={disabled || (section.items?.length ?? 0) >= (definition.maxItems ?? 12)} onClick={addItem}><Plus size={16} /> Add item</button></div>}
      </fieldset>
      {(!isTemplatePageId(pageId) || !pageId.includes('detail') && pageId !== 'shared') && <details className="cms-seo-fields"><summary>Page SEO ({locale.toUpperCase()})</summary>{state?.seoManaged && <p>SEO is managed independently. <Link href={"/admin/website-cms/seo/" + pageId}>Open SEO Manager</Link></p>}<fieldset disabled={disabled || !!state?.seoManaged}>{(['title', 'description'] as const).map((key) => <label key={key}>{fieldLabel(key)}<textarea rows={key === 'title' ? 2 : 4} maxLength={key === 'title' ? 160 : 320} value={draft.seo.text[locale][key]} onChange={(event) => change({ ...draft, seo: { ...draft.seo, text: { ...draft.seo.text, [locale]: { ...draft.seo.text[locale], [key]: event.target.value } } } })} /></label>)}<label>Social image URL<input maxLength={2000} value={draft.seo.image} onChange={(event) => change({ ...draft, seo: { ...draft.seo, image: event.target.value } })} /></label></fieldset></details>}
      </section>
      {state && <CmsDevicePreview src={'/website-cms-preview/pages/' + pageId + '?locale=' + locale} revision={state.revision} dirty={dirty} />}
    </div>
    <AdminConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === 'reload' ? 'Discard unsaved changes and reload?' : confirm === 'restore' ? 'Restore original page sections?' : confirm === 'unpublish' ? 'Hide optional page sections?' : 'Publish saved page sections?'} description={confirm === 'restore' ? 'This resets section content and order to the original defaults. Existing hero records and business records are unchanged.' : confirm === 'unpublish' ? 'Search and required forms remain available. Optional sections are hidden.' : confirm === 'reload' ? 'Your unsaved edits will be discarded. Saved and published data are unchanged.' : 'The saved draft becomes the public section content and order together.'} confirmLabel="Confirm" canConfirm={!busy} onConfirm={() => { if (confirm === 'reload') { setConfirm(null); void load() } else if (confirm) void action(confirm) }} />
    <AdminConfirmDialog open={removeItem !== null} onClose={() => setRemoveItem(null)} title="Remove this draft item?" description="The public page changes only after publishing." confirmLabel="Remove item" canConfirm={!disabled} onConfirm={() => { changeSection({ ...section, items: section.items?.filter((item) => item.id !== removeItem) }); setRemoveItem(null) }} />
    <AdminConfirmDialog open={pendingNavigation !== null} onClose={() => { pendingRef.current = false; setPendingNavigation(null) }} title="Leave unsaved changes?" description="Save your draft first or discard the unsaved edits to leave this page." confirmLabel="Discard and leave" cancelLabel="Keep editing" onConfirm={() => { const next = pendingNavigation; dirtyRef.current = false; setDirty(false); pendingRef.current = false; setPendingNavigation(null); next?.() }} />
  </>
}
