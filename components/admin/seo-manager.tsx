'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Search, Languages, Link2, Pencil, Eye, Save, Send, RotateCcw, Monitor, Smartphone } from 'lucide-react'
import { PageHead } from './admin-shell'
import { Card, AdminStats, AdminTableTools, AdminTableWrap, AdminTableActions, AdminIconAction } from './admin-ui'
import { AdminPagination, usePagination } from './admin-pagination'
import { AdminConfirmDialog } from './admin-confirm-dialog'
import { toast } from './admin-toaster'
import { SharedSelect } from '@/components/shared-select'
import { SEO_PAGES, currentSeo, type SeoAction } from '@/lib/seo-manager'
import { validateSeoContent, type SeoContent } from '@/lib/seo-content'
import type { PageContentState } from '@/lib/page-sections'
import type { SeoPageId as PageDocumentId } from '@/lib/seo-manager'
import { ENABLED_LOCALES, type EnabledLocale } from '@/lib/locale-config'
import { protectEnquiryNavigation } from '@/lib/enquiry-navigation'
import './seo-manager.css'
import { SeoGlobalSettings } from './seo-global-settings'
import { DynamicSeoRecords, SeoDiagnostics, fetchSavedRecordSeoPreview, type RecordSeoPreviewResponse, type SeoRecordResponse } from './seo-record-editor'
import { validateRecordSeoContent } from '@/lib/record-seo'

type SeoInventoryRow = { id: string; name: string; route: string; kind: 'cms' | 'business' | 'private' | 'template'; editor: string | null; title: string; description: string; image: string; index: boolean | null; canonicalIssue: boolean; translationIssue: boolean; updatedAt: string | null }
type Inventory = { pages: SeoInventoryRow[]; languageUrls: 'cookie-only'; googleConnected: false; canEdit: boolean }
const missing = (row: SeoInventoryRow) => row.kind === 'cms' && (!row.title.trim() || !row.description.trim() || !row.image.trim())
const safeEditor = (href: string | null) => href?.startsWith('/admin/') && !href.includes('\\') ? href : null
function SeoNotice() {
  return <p className="cms-coverage-note">Languages use cookies on the same URL (cookie-only). There are no separate ES or IT URLs. Google Search Console is not connected; traffic, rankings and indexing analytics are unavailable.</p>
}
export function SeoDashboard() {
  const [tab, setTab] = useState('Overview')
  const [data, setData] = useState<Inventory | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [kind, setKind] = useState('all')
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError('')
    void fetch('/api/admin/website-cms/seo', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(response.status === 403 || response.status === 401 ? 'You do not have access to SEO inventory.' : 'Could not load SEO inventory.')
      const next: Inventory = await response.json()
      if (!controller.signal.aborted) setData(next)
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load SEO inventory.') })
    return () => controller.abort()
  }, [retry])
  const rows = (data?.pages ?? []).filter(row => (tab !== 'Static Pages' || row.kind === 'cms') && `${row.name} ${row.route} ${row.title}`.toLowerCase().includes(query.toLowerCase()) && (kind === 'all' || row.kind === kind) && (status === 'all' || status === 'missing' && missing(row) || status === 'canonical' && row.canonicalIssue || status === 'translation' && row.translationIssue || status === 'noindex' && row.index === false || status === 'unavailable' && row.index === null))
  const paging = usePagination(rows)
  const filter = (update: (value: string) => void) => (value: string) => { update(value); paging.setPage(1) }
  return <div className="seo-manager">
    <PageHead eyebrow="WEBSITE CMS" title="SEO Manager" sub="Page metadata inventory and independent SEO publishing" />
    <SeoNotice />
    <nav className="seo-tabs" aria-label="SEO sections">{['Overview', 'Static Pages', 'Dynamic Content', 'Global Settings', 'Technical SEO'].map(item => <button type="button" className="sp-btn" key={item} aria-pressed={tab === item} onClick={() => { setTab(item); setKind('all'); setStatus('all'); setQuery(''); paging.setPage(1) }}>{item}</button>)}</nav>
    {tab === 'Dynamic Content' && <DynamicSeoRecords />}
    {tab === 'Technical SEO' && <SeoDiagnostics />}
    {tab === 'Global Settings' && data && <SeoGlobalSettings canEdit={data.canEdit} />}
    {error && <p className="form-error" role="alert">{error} <button type="button" className="sp-btn" onClick={() => setRetry(n => n + 1)}>Retry</button></p>}
    {!data && !error && <p role="status">Loading SEO inventory...</p>}
    {data && (tab === 'Overview' || tab === 'Static Pages') && <>{tab === 'Overview' && <><AdminStats items={[
      { label: 'Registered pages / templates', value: data.pages.length, icon: FileText },
      { label: 'Missing CMS overrides', value: data.pages.filter(missing).length, note: 'Title, description or image override is empty; not an audit of fallback metadata', icon: Search, tone: 'orange' },
      { label: 'Non-self canonical overrides', value: data.pages.filter(row => row.canonicalIssue).length, note: 'Different target; review intent, not necessarily a defect', icon: Link2 },
      { label: 'Missing CMS translations', value: data.pages.filter(row => row.kind === 'cms' && row.translationIssue).length, icon: Languages, tone: 'orange' },
    ]} /><p className="cms-coverage-note">{data.pages.filter(row => row.index === null).length} rows have an unavailable indexing baseline. Counts describe the returned inventory, not Google indexing status.</p>
      <AdminStats items={[
        { label: 'Index allowed in verified sources', value: data.pages.filter(row => row.index === true).length, note: 'Excludes unknown templates; not Google indexed-page counts', icon: FileText },
        { label: 'Complete CMS overrides', value: data.pages.filter(row => row.kind === 'cms' && !missing(row)).length, note: 'Title, description and social image configured', icon: Search },
        { label: 'Missing source social images', value: data.pages.filter(row => (row.kind === 'cms' || row.kind === 'business') && !row.image).length, icon: Eye },
        { label: 'Noindex / private routes', value: data.pages.filter(row => row.index === false).length, icon: FileText },
      ]} />
      <Card title="Recently updated SEO sources"><ul className="cms-recent-list">{data.pages.filter(row => row.updatedAt).sort((a, b) => b.updatedAt!.localeCompare(a.updatedAt!)).slice(0, 5).map(row => <li key={row.id}><span>{row.name}</span><time dateTime={row.updatedAt!}>{new Date(row.updatedAt!).toLocaleString()}</time></li>)}{!data.pages.some(row => row.updatedAt) && <li>No saved CMS SEO or page updates yet.</li>}</ul></Card>
      </>}
      <Card title="SEO inventory">
        <AdminTableTools query={query} onQueryChange={filter(setQuery)} placeholder="Search page, route or title">
          <SharedSelect label="Page type" value={kind} onChange={filter(setKind)} options={['all', 'cms', 'business', 'private', 'template'].map(value => ({ value, label: value === 'all' ? 'All types' : value }))} />
          <SharedSelect label="SEO status" value={status} onChange={filter(setStatus)} options={[{ value: 'all', label: 'All statuses' }, { value: 'missing', label: 'Missing CMS override' }, { value: 'canonical', label: 'Canonical issue' }, { value: 'translation', label: 'Translation issue' }, { value: 'noindex', label: 'Noindex' }, { value: 'unavailable', label: 'Baseline unavailable' }]} />
        </AdminTableTools>
        <AdminTableWrap><table className="sp-table"><thead><tr><th>Page / route</th><th>Type</th><th>Title / description</th><th>Image</th><th>Indexing / checks</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{paging.pageRows.map(row => {
          const editor = row.kind === 'cms' && Object.hasOwn(SEO_PAGES, row.id) ? '/admin/website-cms/seo/' + encodeURIComponent(row.id) : safeEditor(row.editor)
          return <tr key={row.id}><td><strong>{row.name}</strong><small className="cms-row-note">{row.route}</small></td><td>{row.kind}</td><td className="seo-copy"><strong>{row.title || (row.kind === 'cms' ? 'No title override' : 'Title baseline unavailable')}</strong><small className="cms-row-note">{row.description || (row.kind === 'cms' ? 'No description override' : 'Description baseline unavailable')}</small></td><td>{row.image ? 'Set' : row.kind === 'cms' ? 'No override' : 'Unavailable'}</td><td>{row.index === null ? 'Baseline unavailable' : row.index ? 'Index allowed' : 'Noindex'}{row.canonicalIssue && <small className="cms-row-note">Canonical issue</small>}{row.translationIssue && <small className="cms-row-note">Translation issue</small>}</td><td>{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : 'Not recorded'}</td><td><AdminTableActions>{editor && <AdminIconAction icon={Pencil} href={editor} label={row.kind === 'cms' ? 'Edit SEO' : 'Open original editor'} />}{!row.route.includes('[') && row.route.startsWith('/') && !row.route.startsWith('//') && !row.route.includes('\\') && <AdminIconAction icon={Eye} href={row.route} label="View page" />}</AdminTableActions>{!editor && <small>Source managed</small>}</td></tr>
        })}{rows.length === 0 && <tr><td colSpan={7}>No pages match these filters.</td></tr>}</tbody></table></AdminTableWrap>
        <AdminPagination {...paging} onPage={paging.setPage} onPageSize={paging.setPageSize} />
      </Card></>}
  </div>
}

export function SeoEditor({ pageKey, recordKey }: { pageKey: PageDocumentId; recordKey?: { kind: string; slug: string } }) {
  const router = useRouter()
  const [state, setState] = useState<PageContentState | null>(null)
  const [content, setContent] = useState<(SeoContent & { structuredData?: boolean }) | null>(null)
  const [recordData, setRecordData] = useState<SeoRecordResponse | null>(null)
  const [previewOpen, setPreviewOpen] = useState(true)
  const [savedPreview, setSavedPreview] = useState<RecordSeoPreviewResponse | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [canEdit, setCanEdit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
    const [conflict, setConflict] = useState(false)
  const [locale, setLocale] = useState<EnabledLocale>('en')
  const [device, setDevice] = useState('desktop')
  const [confirm, setConfirm] = useState<SeoAction | 'reload' | null>(null)
  const [pending, setPending] = useState<(() => void) | null>(null)
  const lock = useRef(false)
  const dirtyRef = useRef(false)
  const pendingRef = useRef(false)
  const saved = recordData ? recordData.state.draft ?? recordData.state.published ?? emptyRecordSeo() : state ? state.seoDraft ?? currentSeo(state, pageKey) : null
  const dirty = !!content && JSON.stringify(content) !== JSON.stringify(saved)
  dirtyRef.current = dirty
  const endpoint = recordKey ? '/api/admin/website-cms/seo/records/' + encodeURIComponent(recordKey.kind) + '/' + encodeURIComponent(recordKey.slug) : '/api/admin/website-cms/seo/' + encodeURIComponent(pageKey)
  const load = useCallback(async () => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    setSavedPreview(null); setPreviewError('')
    try {
      const response = await fetch(endpoint, { cache: 'no-store' })
      if (response.status === 401 || response.status === 403) { setCanEdit(false); throw new Error('You do not have access to this SEO editor.') }
      if (!response.ok) throw new Error('Could not load SEO. Retry using Reload.')
      const data = await response.json()
      if (recordKey) { const next = data as SeoRecordResponse; setRecordData(next); setContent(next.state.draft ?? next.state.published ?? emptyRecordSeo()) }
      else { setState(data.state); setContent(data.state.seoDraft ?? currentSeo(data.state, pageKey)) }
      setCanEdit(data.canEdit); setConflict(false); dirtyRef.current = false
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not load SEO.') }
    finally { lock.current = false; setBusy(false) }
  }, [endpoint, pageKey, recordKey?.kind, recordKey?.slug])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const navigate = (next: () => void) => { if (lock.current || pendingRef.current) return; pendingRef.current = true; setPending(() => next) }
    const cleanup = protectEnquiryNavigation(window, () => dirtyRef.current || lock.current, navigate)
    const click = (event: MouseEvent) => {
      if ((!dirtyRef.current && !lock.current) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href)
      if (url.href === location.href) return
      event.preventDefault(); event.stopPropagation()
      navigate(() => url.origin === location.origin ? router.push(url.pathname + url.search + url.hash) : location.assign(url.href))
    }
    document.addEventListener('click', click, true)
    return () => { cleanup(); document.removeEventListener('click', click, true) }
  }, [router])
  const disabled = busy || !canEdit || conflict || !(state || recordData)
  const change = (next: SeoContent & { structuredData?: boolean }) => { if (disabled) return; setContent(next); setSavedPreview(null); setPreviewError('') }
  const validateSavedPreview = async () => {
    if (!recordKey || !recordData || dirty || busy || conflict || lock.current) return
    lock.current = true; setBusy(true); setSavedPreview(null); setPreviewError('')
    try { setSavedPreview(await fetchSavedRecordSeoPreview(endpoint, locale)) }
    catch (error) { setPreviewError(error instanceof Error ? error.message : 'Could not validate the saved preview.') }
    finally { lock.current = false; setBusy(false) }
  }
  const action = async (command: SeoAction) => {
    if (!(state || recordData) || !content || disabled || lock.current) return
    let validated: SeoContent | undefined
    try { if (command === 'save-draft') validated = recordKey ? validateRecordSeoContent(content) : validateSeoContent(content) }
    catch (error) { setError(error instanceof Error ? error.message : 'Check the SEO fields.'); return }
    lock.current = true; setBusy(true); setError('')
    setSavedPreview(null); setPreviewError('')
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: command, revision: recordData?.state.revision ?? state!.revision, ...(validated ? { content: validated } : {}) }) })
      if (response.status === 409) { setConflict(true); throw new Error('Another editor changed this page. Reload the latest revision before saving; your local edits remain visible.') }
      if (response.status === 401 || response.status === 403) { setCanEdit(false); throw new Error('Editing access is unavailable. Your local edits remain visible.') }
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save SEO. Retry when ready.')
      if (recordKey) { const next = data as SeoRecordResponse; setRecordData(next); setContent(next.state.draft ?? next.state.published ?? emptyRecordSeo()); setCanEdit(next.canEdit) }
      else { const next: PageContentState = data.state; setState(next); setContent(next.seoDraft ?? currentSeo(next, pageKey)) }
      dirtyRef.current = false
      toast.success(command === 'save-draft' ? 'SEO draft saved. Public metadata is unchanged.' : command === 'publish' ? 'Saved SEO published. Page section drafts are unchanged.' : 'Original SEO restored. Saved SEO draft cleared; page section drafts are unchanged.', { dedupeKey: 'seo-editor-command' })
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save SEO.') }
    finally { lock.current = false; setBusy(false); setConfirm(null) }
  }
  const page = recordKey ? { name: recordData?.record.name ?? recordKey.slug, route: recordData?.record.publicUrl ?? 'Hidden record: no public URL' } : SEO_PAGES[pageKey]!
  const published = recordData ? recordData.state.published : state ? currentSeo(state, pageKey) : null
  const draft = recordData ? recordData.state.draft : state?.seoDraft
  const previewImage = content?.image || recordData?.record.image
  return <div className="seo-manager">
    <PageHead eyebrow="WEBSITE CMS" title={page.name + ' SEO'} sub={state || recordData ? `${page.route} | Revision ${recordData?.state.revision ?? state!.revision}${dirty ? ' | Unsaved changes' : ''}` : 'Loading SEO...'} backHref="/admin/website-cms/seo" />
    <SeoNotice />
    <div className="cms-editor-toolbar"><nav aria-label="SEO language">{ENABLED_LOCALES.map(language => <button className="sp-btn" type="button" key={language} disabled={busy} aria-pressed={locale === language} onClick={() => { setLocale(language); setSavedPreview(null); setPreviewError('') }}>{language.toUpperCase()}</button>)}</nav><div>
      <button className="sp-btn" type="button" disabled={busy} onClick={() => dirty ? setConfirm('reload') : void load()}><RotateCcw size={16} /> Reload</button>
      <button className="sp-btn" type="button" disabled={disabled || !dirty} onClick={() => void action('save-draft')}><Save size={16} /> Save draft</button>
      <button className="sp-btn" type="button" disabled={!content || busy} onClick={() => setPreviewOpen(value => !value)}><Eye size={16} /> {previewOpen ? 'Close preview' : 'Preview draft'}</button>
      {recordKey && <button className="sp-btn" type="button" disabled={dirty || busy || conflict || !recordData} onClick={() => void validateSavedPreview()}><Eye size={16} /> Validate saved preview</button>}
      <button className="sp-btn primary" type="button" disabled={disabled || dirty || !draft || JSON.stringify(draft) === JSON.stringify(published)} onClick={() => setConfirm('publish')}><Send size={16} /> Publish SEO</button>
      <button className="sp-btn" type="button" disabled={disabled} onClick={() => setConfirm('restore')}><RotateCcw size={16} /> Restore original SEO</button>
    </div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {busy && <p role="status">Loading or saving SEO...</p>}
    {(state || recordData) && !canEdit && <p role="status">Read only. Editing permission is required to save, publish or restore SEO.</p>}
    {recordData && <p className="cms-coverage-note">Content: {recordData.record.published ? 'Published' : 'Hidden'}. SEO: {recordData.state.published ? 'Published override' : 'Original defaults'}{recordData.state.draft ? ' | Saved draft' : ''}. Publishing SEO does not publish hidden content. {safeEditor(recordData.record.sourceEditor) && <a href={recordData.record.sourceEditor}>Open original content editor</a>}</p>}
    {previewOpen && <p role="status">Private local draft illustration below, including unsaved edits. No public preview URL is created.</p>}
    {recordKey && <section className="seo-saved-preview" aria-label="Saved SEO preview validation">
      {previewError && <p className="form-error" role="alert">{previewError}</p>}
      {savedPreview && <>
        <p role="status">Saved preview validated ({savedPreview.locale.toUpperCase()}). {savedPreview.structuredData === null ? 'Structured data is disabled or unavailable for this saved snapshot.' : 'Automatic structured data returned successfully.'} This is a private server snapshot, not Google rich-results validation.</p>
        <p>{savedPreview.publicUrl ?? 'No public URL'}</p>
        <details><summary>Saved metadata</summary><pre>{JSON.stringify(savedPreview.metadata, null, 2)}</pre></details>
        <details><summary>Saved structured data{savedPreview.structuredData === null ? ' (disabled or unavailable)' : ''}</summary><pre>{JSON.stringify(savedPreview.structuredData, null, 2)}</pre></details>
      </>}
    </section>}
    {content && <><p className="cms-coverage-note">{draft ? 'Showing saved SEO draft with any local edits.' : 'Showing current SEO defaults or publication.'} Publishing affects SEO independently of page content. Empty overrides use the existing metadata fallback.</p>
      <div className={'seo-layout' + (!previewOpen ? ' seo-fields-only' : '')}><section className="cms-field-panel" aria-label="SEO fields"><fieldset disabled={disabled} lang={locale}>
        {(['title', 'description', 'ogTitle', 'ogDescription'] as const).map(field => <label key={field}>{({ title: 'Title', description: 'Description', ogTitle: 'Open Graph title', ogDescription: 'Open Graph description' })[field]} ({locale.toUpperCase()})
          <textarea rows={field.toLowerCase().includes('description') ? 4 : 2} maxLength={field.toLowerCase().includes('description') ? 320 : 160} value={content.text[locale][field] ?? ''} onChange={event => change({ ...content, text: { ...content.text, [locale]: { ...content.text[locale], [field]: event.target.value } } })} />
          <small>{(content.text[locale][field] ?? '').length} characters{field === 'title' ? ' | Around 50-60 is a common guide.' : field === 'description' ? ' | Around 140-160 is a common guide.' : ' | Empty uses the title or description.'}</small>
        </label>)}
        <label>Social image URL<input maxLength={2000} value={content.image} onChange={event => change({ ...content, image: event.target.value })} /></label>
        <label>Canonical same-site path<input list={recordData ? 'record-canonical-paths' : undefined} placeholder={page.route} maxLength={2000} value={content.canonical ?? ''} onChange={event => change({ ...content, canonical: event.target.value })} /><small>Public path only, such as /about. No domain, query or fragment. Empty keeps the existing canonical.</small></label>
        {recordData && <datalist id="record-canonical-paths">{recordData.record.canonicalPaths.map(path => <option key={path} value={path} />)}</datalist>}
        {(['index', 'follow'] as const).map(field => <label className="cms-checkbox" key={field}><input type="checkbox" checked={content[field] ?? true} onChange={event => change({ ...content, [field]: event.target.checked })} />{field === 'index' ? 'Allow indexing' : 'Allow following links'}{content[field] === undefined && ' (default)'}</label>)}
        {recordKey && <label className="cms-checkbox"><input type="checkbox" checked={content.structuredData ?? true} onChange={event => change({ ...content, structuredData: event.target.checked })} />Enable automatic structured data</label>}
        <label>Twitter card<SharedSelect label="Twitter card" disabled={disabled} value={content.card ?? 'summary_large_image'} onChange={card => change({ ...content, card: card as SeoContent['card'] })} options={[{ value: 'summary', label: 'Summary' }, { value: 'summary_large_image', label: 'Summary with large image' }]} /></label>
      </fieldset></section>
      <aside className="seo-preview" hidden={!previewOpen}><Card title="Google preview" action={<div className="seo-devices">{[{ value: 'desktop', icon: Monitor }, { value: 'mobile', icon: Smartphone }].map(({ value, icon: Icon }) => <button key={value} type="button" className="sp-btn" title={value} aria-label={value + ' preview'} aria-pressed={device === value} onClick={() => setDevice(value)}><Icon size={18} /></button>)}</div>}>
        <div className={'seo-google ' + device} lang={locale} dir="ltr"><small>STAR PYRAMIDS</small><div>{content.canonical || page.route}</div><h3>{content.text[locale].title || recordData?.record.name || 'Title override empty: baseline preview unavailable'}</h3><p>{content.text[locale].description || recordData?.record.description || 'Description override empty: baseline preview unavailable'}</p></div>
        <p className="cms-coverage-note">Illustrative preview of these overrides. Google may rewrite titles and descriptions; display length varies by device and query.</p>
      </Card><Card title="Social preview"><div className="seo-social" lang={locale}>{previewImage && <img src={previewImage} alt="Social preview" referrerPolicy="no-referrer" />}<strong>{content.text[locale].ogTitle || content.text[locale].title || recordData?.record.name || 'Original title fallback'}</strong><p>{content.text[locale].ogDescription || content.text[locale].description || recordData?.record.description || 'Original description fallback'}</p><small>{content.canonical || page.route}</small><p>Robots: {content.index === false ? 'noindex' : 'index'}, {content.follow === false ? 'nofollow' : 'follow'}{recordData && !recordData.record.published ? ' | Hidden content stays unavailable publicly' : ''}</p></div></Card><Card title="Current public SEO"><dl className="seo-public"><dt>Title ({locale.toUpperCase()})</dt><dd>{published?.text[locale].title || 'No override'}</dd><dt>Description</dt><dd>{published?.text[locale].description || 'No override'}</dd><dt>Canonical override</dt><dd>{published?.canonical || 'Existing canonical'}</dd></dl></Card></aside></div>
    </>}
    <AdminConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)} canConfirm={!busy} title={confirm === 'reload' ? 'Discard unsaved edits and reload?' : confirm === 'restore' ? 'Restore original SEO?' : 'Publish saved SEO draft?'} description={confirm === 'reload' ? 'Local edits will be discarded and the latest revision loaded.' : confirm === 'restore' ? 'This clears the saved SEO draft and restores public SEO defaults. Unsaved SEO edits will be discarded. Page section drafts are unchanged.' : 'The saved SEO draft becomes public. Page section drafts are unchanged.'} confirmLabel={confirm === 'reload' ? 'Discard and reload' : confirm === 'restore' ? 'Restore SEO' : 'Publish SEO'} cancelLabel="Keep editing" onConfirm={() => { if (confirm === 'reload') { setConfirm(null); void load() } else if (confirm) void action(confirm) }} />
    <AdminConfirmDialog open={pending !== null} onClose={() => { pendingRef.current = false; setPending(null) }} title="Discard unsaved SEO edits?" description="Your saved draft remains available. Local edits will be discarded." confirmLabel="Discard and leave" cancelLabel="Keep editing" canConfirm={!busy} onConfirm={() => { const next = pending; dirtyRef.current = false; pendingRef.current = false; setPending(null); next?.() }} />
  </div>
}

function emptyRecordSeo(): SeoContent { return { text: { en: { title: '', description: '' }, es: { title: '', description: '' }, it: { title: '', description: '' } }, image: '' } }
