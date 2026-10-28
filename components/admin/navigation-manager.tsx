'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, FolderPlus, GripVertical, Plus, Save, Send, Eye, RotateCcw, Trash2 } from 'lucide-react'
import { PageHead } from './admin-shell'
import { Card } from './admin-ui'
import { AdminConfirmDialog } from './admin-confirm-dialog'
import { toast } from './admin-toaster'
import { NavigationMenu } from '../navigation-menu'
import { defaultNavigation, initialNavigation, moveNavigation, navigationKinds, navigationLabel, navigationLocales, validateNavigation, type NavigationAction, type NavigationContent, type NavigationItem, type NavigationKind, type NavigationState, type NavigationTarget, type PublicNavigation } from '@/lib/navigation'
import './navigation-manager.css'
const endpoint = '/api/admin/website-cms/navigation'
type Option = { key: string; label: string; target: NavigationTarget; href: string }
export function NavigationManager() {
  const [state, setState] = useState<NavigationState>(initialNavigation)
  const [content, setContent] = useState<NavigationContent>(defaultNavigation)
  const [baseline, setBaseline] = useState('')
  const [selected, setSelected] = useState('home')
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const pending = useRef(false)
  const [canEdit, setCanEdit] = useState(false); const [error, setError] = useState('')
  const [source, setSource] = useState<'page' | NavigationKind>('page'); const [query, setQuery] = useState(''); const [options, setOptions] = useState<Option[]>([]); const [optionsError, setOptionsError] = useState(''); const [optionsLoading, setOptionsLoading] = useState(false); const [retryOptions, setRetryOptions] = useState(0); const [truncated, setTruncated] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<NavigationAction | 'delete' | null>(null)
  const [preview, setPreview] = useState<PublicNavigation | null>(null); const [previewKey, setPreviewKey] = useState(''); const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop'); const [locale, setLocale] = useState<'en' | 'es' | 'it'>('en')
  const currentKey = JSON.stringify(content); const dirty = currentKey !== baseline
  const rows = content.items.flatMap(item => [item, ...item.children]); const item = rows.find(row => row.id === selected)
  const editable = canEdit && !busy && !loading
  const adopt = useCallback((next: NavigationState, defaults?: NavigationContent) => { const value = next.draft ?? next.published ?? defaults ?? defaultNavigation(); setState(next); setContent(value); setBaseline(JSON.stringify(value)); setPreview(null) }, [])
  const load = useCallback(async () => {
    if (pending.current) return
    pending.current = true; setLoading(true); setError('')
    try { const response = await fetch(endpoint, { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); adopt(data.state, data.defaults); setCanEdit(data.canEdit === true) }
    catch (e) { setError(e instanceof Error ? e.message : 'Navigation could not be loaded.') }
    finally { pending.current = false; setLoading(false) }
  }, [adopt])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!dirty) return
    const before = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || !(event.target instanceof Element)) return
      const anchor = event.target.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.closest('[data-navigation-preview]') || anchor.target === '_blank' || anchor.href === location.href) return
      if (!window.confirm('Leave Navigation Manager and discard unsaved changes?')) { event.preventDefault(); event.stopPropagation() }
    }
    window.addEventListener('beforeunload', before); document.addEventListener('click', click, true)
    return () => { window.removeEventListener('beforeunload', before); document.removeEventListener('click', click, true) }
  }, [dirty])
  useEffect(() => {
    const abort = new AbortController(); setOptionsLoading(true); setOptionsError(''); setOptions([])
    const timer = setTimeout(() => {
      void fetch(`${endpoint}/options?kind=${source}&q=${encodeURIComponent(query)}`, { cache: 'no-store', signal: abort.signal }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (!abort.signal.aborted) { setOptions(data.options); setTruncated(data.truncated === true) } }).catch(e => { if (!abort.signal.aborted) setOptionsError(e instanceof Error ? e.message : 'Links could not be loaded.') }).finally(() => { if (!abort.signal.aborted) setOptionsLoading(false) })
    }, 200)
    return () => { clearTimeout(timer); abort.abort() }
  }, [source, query, retryOptions])
  function update(patch: Partial<NavigationItem>) {
    if (!editable || !item) return
    setContent(current => ({ ...current, items: current.items.map(row => row.id === selected ? { ...row, ...patch } : { ...row, children: row.children.map(child => child.id === selected ? { ...child, ...patch } : child) }) }))
  }
  function add(type: NavigationItem['type']) {
    if (!editable) return
    const id = `nav-${crypto.randomUUID()}`
    const row: NavigationItem = { id, type, labels: { en: type === 'group' ? 'New dropdown' : 'New link', es: '', it: '' }, visibility: 'both', enabled: true, newTab: false, children: [], ...(type === 'link' ? { target: { type: 'internal', href: '/' } as NavigationTarget } : {}) }
    setContent(current => ({ ...current, items: [...current.items, row] })); setSelected(id)
  }
  function move(id: string, parent: string | null, index: number) {
    if (!editable) return
    try { setContent(moveNavigation(content, id, parent, index)); setError('') } catch (e) { setError((e as Error).message) }
    setDragging(null)
  }
  async function change(action: NavigationAction) {
    if (!canEdit || pending.current || loading || action !== 'save-draft' && dirty) return
    try { if (action === 'save-draft') validateNavigation(content) } catch(e) { setError((e as Error).message); return }
    pending.current = true; setBusy(true); setError('')
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: state.revision, action, ...(action === 'save-draft' ? { content } : {}) }) }); const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Navigation could not be saved.')
      adopt(data.state, data.defaults); toast.success(action === 'save-draft' ? 'Navigation draft saved.' : action === 'publish' ? 'Navigation published.' : action === 'restore' ? 'Previous navigation restored.' : 'Draft reset to published navigation.', { dedupeKey: 'navigation-save' })
      if (action === 'publish' || action === 'restore') window.dispatchEvent(new Event('sp-navigation-published'))
    } catch(e) { setError((e as Error).message); toast.error((e as Error).message, { dedupeKey: 'navigation-save' }) }
    finally { pending.current = false; setBusy(false); setConfirm(null) }
  }
  async function showPreview() {
    if (pending.current) return
    try { validateNavigation(content) } catch(e) { setError((e as Error).message); return }
    pending.current = true; setBusy(true); setError('')
    try {
      const response = await fetch(`${endpoint}/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: state.revision, action: 'save-draft', content }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error)
      setPreview(data.navigation); setPreviewKey(JSON.stringify(content))
    } catch(e) { setError((e as Error).message) } finally { pending.current = false; setBusy(false) }
  }
  function tree(list: NavigationItem[], parent: string | null = null) {
    return <ol className="nav-builder-tree">{list.map((row, index) => <li key={row.id}>
      <div className={`nav-builder-row${selected === row.id ? ' is-selected' : ''}`} draggable={editable} onDragStart={event => { setDragging(row.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', row.id) }} onDragEnd={() => setDragging(null)} onDragOver={event => { if (dragging) event.preventDefault() }} onDrop={event => { event.preventDefault(); event.stopPropagation(); if (dragging) { const origin = list.findIndex(candidate => candidate.id === dragging); move(dragging, parent, origin >= 0 && origin < index ? index - 1 : index) } }}>
        <GripVertical size={16} aria-hidden="true"/><button className="nav-builder-select" type="button" onClick={() => setSelected(row.id)} aria-pressed={selected === row.id}>{navigationLabel(row, locale, content.primaryLocale)}<small>{row.type === 'group' ? 'Dropdown' : 'Link'} · {row.enabled ? row.visibility : 'Disabled'}</small></button>
        <button className="sp-btn" type="button" disabled={!editable || index === 0} aria-label={`Move ${row.labels.en || row.id} up`} onClick={() => move(row.id, parent, index - 1)}><ArrowUp size={14}/></button><button className="sp-btn" type="button" disabled={!editable || index === list.length - 1} aria-label={`Move ${row.labels.en || row.id} down`} onClick={() => move(row.id, parent, index + 1)}><ArrowDown size={14}/></button>
      </div>
      {row.type === 'group' && <div className="nav-builder-group" onDragOver={event => { if (dragging) event.preventDefault() }} onDrop={event => { event.preventDefault(); event.stopPropagation(); if (dragging) move(dragging, row.id, row.children.length) }}>{tree(row.children, row.id)}<button className="sp-btn" type="button" disabled={!editable || !item || item.type === 'group'} onClick={() => item && move(item.id, row.id, row.children.length)}>Move selected link into this group</button></div>}
    </li>)}</ol>
  }
  const parent = content.items.find(row => row.children.some(child => child.id === selected))
  return <>
    <PageHead eyebrow="WEBSITE CMS" title="Navigation Manager" sub="One published navigation source for desktop and mobile. Saved drafts stay private."/>
    {error && <p className="form-error" role="alert">{error} {loading ? null : <button className="sp-btn" type="button" disabled={busy} onClick={() => { if (!dirty || window.confirm('Discard local edits and reload the latest navigation?')) void load() }}>Reload</button>}</p>}
    {loading ? <p role="status">Loading navigation…</p> : <>
      <div className="nav-builder-toolbar"><span>Revision {state.revision} · {state.published === null ? 'Original navigation' : 'Published navigation'}{dirty ? ' · Unsaved changes' : state.draft ? ' · Saved draft' : ''}</span>
        <button className="sp-btn" disabled={!editable} onClick={() => void change('save-draft')}><Save size={16}/> Save Draft</button><button className="sp-btn primary" disabled={!editable || dirty || !state.draft} onClick={() => setConfirm('publish')}><Send size={16}/> Publish</button><button className="sp-btn" disabled={busy} onClick={() => void showPreview()}><Eye size={16}/> Preview unsaved menu</button><button className="sp-btn" disabled={!editable || dirty || !state.hasPrevious} onClick={() => setConfirm('restore')}><RotateCcw size={16}/> Restore previous</button><button className="sp-btn" disabled={!editable || dirty || !state.draft} onClick={() => setConfirm('reset-draft')}>Discard saved draft</button>
      </div>
      <div className="nav-builder-layout">
        <Card title="Menu structure" sub="Drag a row before another row, or drop it inside a group. Only one dropdown level is supported.">
          <div className="nav-builder-toolbar"><button className="sp-btn" disabled={!editable} onClick={() => add('link')}><Plus size={16}/> Add Item</button><button className="sp-btn" disabled={!editable} onClick={() => add('group')}><FolderPlus size={16}/> Add Dropdown</button></div>
          {tree(content.items)}<div className="nav-builder-root-drop" onDragOver={event => { if (dragging) event.preventDefault() }} onDrop={event => { event.preventDefault(); if (dragging) move(dragging, null, content.items.length) }}>Drop here to move to the end of the top level</div>
          {!content.items.length && <p>No items. An empty published menu intentionally hides all editable navigation links.</p>}
        </Card>
        <Card title="Item settings" sub="Hidden or disabled groups also hide their children.">
          <label className="nav-builder-field">Primary fallback language<select disabled={!editable} value={content.primaryLocale} onChange={event => setContent({ ...content, primaryLocale: event.target.value as NavigationContent['primaryLocale'] })}>{navigationLocales.map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></label>
          {!item ? <p>Select a menu item to edit it.</p> : <fieldset className="nav-builder-fields" disabled={!editable}>
            {navigationLocales.map(value => <label className="nav-builder-field" key={value}>Label ({value.toUpperCase()})<input value={item.labels[value]} maxLength={100} onChange={event => update({ labels: { ...item.labels, [value]: event.target.value } })}/></label>)}
            <label className="nav-builder-field">Item type<select value={item.type} onChange={event => { if (item.children.length) { setError('Move or remove child links before changing a dropdown into a link.'); return }; if (event.target.value === 'group' && parent) { setError('Move this item to the top level before making it a dropdown.'); return }; update(event.target.value === 'group' ? { type: 'group', target: undefined, newTab: false, placement: undefined } : { type: 'link', target: { type: 'internal', href: '/' } }) }}><option value="link">Link</option><option value="group">Dropdown group</option></select></label>
            <label className="nav-builder-field">Visibility<select value={item.visibility} onChange={event => update({ visibility: event.target.value as NavigationItem['visibility'] })}>{['both', 'desktop', 'mobile', 'hidden'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <label><input type="checkbox" checked={item.enabled} onChange={event => update({ enabled: event.target.checked })}/> Enabled</label>
            <label className="nav-builder-field">Move to group<select value={parent?.id ?? ''} onChange={event => move(item.id, event.target.value || null, event.target.value ? content.items.find(row => row.id === event.target.value)!.children.length : content.items.length)}><option value="">Top level</option>{item.type === 'link' && content.items.filter(row => row.type === 'group').map(row => <option key={row.id} value={row.id}>{navigationLabel(row, locale, content.primaryLocale)}</option>)}</select></label>
            {item.type === 'link' && <>
              <label className="nav-builder-field">Destination type<select value={item.target?.type === 'external' ? 'external' : 'internal'} onChange={event => update({ target: event.target.value === 'external' ? { type: 'external', href: 'https://' } : { type: 'internal', href: '/' } })}><option value="internal">Internal page / published content</option><option value="external">Custom external URL</option></select></label>
              {item.target?.type === 'external' ? <label className="nav-builder-field">HTTP(S) URL<input type="url" value={item.target.href} maxLength={1500} onChange={event => update({ target: { type: 'external', href: event.target.value } })}/></label> : <>
                <label className="nav-builder-field">Internal source<select value={source} onChange={event => setSource(event.target.value as typeof source)}><option value="page">Website pages</option>{navigationKinds.map(kind => <option key={kind} value={kind}>{kind}</option>)}</select></label>
                <label className="nav-builder-field">Search published destinations<input type="search" value={query} onChange={event => setQuery(event.target.value)}/></label>
                {optionsLoading && <p role="status">Loading published links…</p>}{optionsError && <p role="alert">{optionsError} <button className="sp-btn" type="button" onClick={() => setRetryOptions(value => value + 1)}>Retry</button></p>}
                <label className="nav-builder-field">Select destination<select value="" onChange={event => { const option = options.find(row => row.key === event.target.value); if (option) update({ target: option.target }) }}><option value="">Choose a page or published record</option>{options.map(option => <option key={option.key} value={option.key}>{option.label} — {option.href}</option>)}</select></label>
                {!optionsLoading && !optionsError && !options.length && <p>No published pages match this search.</p>}{truncated && <p>Showing the first 120 results. Refine the search.</p>}
                <p className="nav-builder-reference">Current: {item.target?.type === 'record' ? `${item.target.kind} · ${item.target.id} (stable record reference)` : item.target?.href}</p>
              </>}
              <label><input type="checkbox" checked={item.newTab} onChange={event => update({ newTab: event.target.checked })}/> Open in new tab (noopener / noreferrer)</label>
              {!parent && <label><input type="checkbox" checked={item.placement === 'action'} onChange={event => update({ placement: event.target.checked ? 'action' : undefined })}/> Header action button (one supported)</label>}
            </>}
            <button className="sp-btn" type="button" onClick={() => setConfirm('delete')}><Trash2 size={16}/> Remove {item.type === 'group' ? 'dropdown' : 'link'}</button>
          </fieldset>}
        </Card>
      </div>
      {preview && <Card title="Read-only navigation preview" sub="Uses your current unsaved structure and current published link targets. Preview never writes or publishes."><div className="nav-builder-toolbar"><label>Device <select value={device} onChange={event => setDevice(event.target.value as typeof device)}><option value="desktop">Desktop</option><option value="mobile">Mobile</option></select></label><label>Language <select value={locale} onChange={event => setLocale(event.target.value as typeof locale)}>{navigationLocales.map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></label><button className="sp-btn" disabled={busy} onClick={() => void showPreview()}>Refresh preview</button></div>{previewKey !== currentKey && <p role="status">The menu has changed. Refresh preview to see the latest local edits.</p>}<div data-navigation-preview className={`nav-builder-preview ${device === 'mobile' ? 'mobile-nav-content' : 'header-nav header-nav-inner'}`}><nav><NavigationMenu key={`${device}-${previewKey}`} navigation={preview} locale={locale} pathname="/" mobile={device === 'mobile'} preview idPrefix="navigation-editor-preview"/>{device === 'desktop' && <NavigationMenu navigation={preview} locale={locale} pathname="/" preview actions/>}</nav></div><p>Unavailable or unpublished records are omitted. Check the preview before publishing.</p></Card>}
    </>}
    <AdminConfirmDialog open={confirm !== null} title={confirm === 'delete' ? 'Remove menu item?' : confirm === 'publish' ? 'Publish navigation?' : confirm === 'restore' ? 'Restore previous navigation?' : 'Discard saved draft?'} description={confirm === 'delete' ? 'Removing a dropdown also removes its child menu links from this draft. Business content is never deleted. Save and publish separately to change the website.' : 'This action uses the current saved revision. Published changes affect website navigation only.'} confirmLabel={confirm === 'delete' ? 'Remove from draft' : 'Confirm'} canConfirm={!busy} onClose={() => { if (!busy) setConfirm(null) }} onConfirm={() => { if (confirm === 'delete') { if (editable) { setContent({ ...content, items: content.items.filter(row => row.id !== selected).map(row => ({ ...row, children: row.children.filter(child => child.id !== selected) })) }); setSelected(''); setConfirm(null) } } else if (confirm) void change(confirm) }}/>
  </>
}
