'use client'
import { useEffect, useRef, useState } from 'react'
import { Save, Send, RotateCcw, EyeOff } from 'lucide-react'
import { PageHead } from './admin-shell'
import { Card } from './admin-ui'
import { AdminConfirmDialog } from './admin-confirm-dialog'
import { SharedSelect } from '../shared-select'
import { ENABLED_LOCALES, type EnabledLocale } from '@/lib/locale-config'
import { FAQ_HERO_DESTINATIONS } from '@/lib/faq-hero'
import { originalShowcaseHero, SHOWCASE_PAGES, type ShowcaseHero, type ShowcaseHeroId, type ShowcaseHeroState } from '@/lib/showcase-heroes'
import type { HeroAction } from '@/lib/website-heroes'
import { isCompactHeroId } from '@/lib/compact-hero-defaults'
import '@/app/admin/website-cms/hero-sections/homepage/hero-editor.css'

export function ShowcaseHeroEditor({ id }: { id: ShowcaseHeroId }) {
  const original = () => originalShowcaseHero(id)
  const [state, setState] = useState<ShowcaseHeroState | null>(null)
  const [draft, setDraft] = useState<ShowcaseHero>(original)
  const [canEdit, setCanEdit] = useState(false)
  const [locale, setLocale] = useState<EnabledLocale>('en')
  const [width, setWidth] = useState('desktop')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState<HeroAction | null>(null)
  const lock = useRef(false)
  const frame = useRef<HTMLIFrameElement>(null)
  const sync = () => frame.current?.contentWindow?.postMessage({ type: 'star-showcase-preview', id, content: draft, locale }, window.location.origin)
  useEffect(() => {
    sync()
    const ready = (event: MessageEvent) => { if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && event.data?.type === 'star-showcase-preview-ready') sync() }
    window.addEventListener('message', ready)
    return () => window.removeEventListener('message', ready)
  }, [draft, locale])
  const load = async () => {
    setError('')
    try {
      const response = await fetch('/api/admin/website-cms/showcase-heroes/' + id, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error()
      setState(data.state); setDraft(data.state.draft ?? data.state.published ?? original()); setCanEdit(data.canEdit); setDirty(false)
    } catch { setError('Could not load hero. Reload to retry.') }
  }
  useEffect(() => { void load() }, [])
  const change = (next: Partial<ShowcaseHero>) => { setDraft((previous) => ({ ...previous, ...next })); setDirty(true); setNotice('') }
  const action = async (command: HeroAction) => {
    if (!state || !canEdit || lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/admin/website-cms/showcase-heroes/' + id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: command, revision: state.revision, ...(command === 'save-draft' ? { content: draft } : {}) }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save hero.')
      setState(data.state); setDraft(data.state.draft ?? data.state.published ?? original()); setDirty(false)
      setNotice(command === 'save-draft' ? 'Draft saved. Public content is unchanged.' : command === 'restore' ? 'Original hero restored.' : command === 'unpublish' ? 'Hero unpublished.' : 'Hero published.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save hero.') }
    finally { lock.current = false; setBusy(false); setConfirm(null) }
  }
  const upload = async (file: File | undefined, field: 'image' | 'mobileImage') => {
    if (!file || !state || !canEdit || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const body = new FormData(); body.set('type', 'image'); body.set('file', file)
      const response = await fetch('/api/admin/website-cms/hero-media', { method: 'POST', body })
      const data = await response.json()
      if (!response.ok || typeof data.media?.url !== 'string') throw new Error(data.error || 'Upload failed.')
      change({ [field]: data.media.url }); setNotice('Image ready. Save draft to retain its reference.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Upload failed.') }
    finally { lock.current = false; setBusy(false) }
  }
  const disabled = !state || !canEdit || busy
  const labels: Record<string, string> = { title: 'Heading', eyebrow: 'Small heading', intro: 'Description', primaryLabel: 'Primary button', secondaryLabel: 'Secondary button', railLabel: 'Featured panel label', railTitle: 'Featured panel heading', statsLabel: 'Summary accessibility label', stat0: 'First statistic label', stat1: 'Second statistic label', meta0: 'First detail label', meta1: 'Second detail label' }
  return <>
    <PageHead eyebrow="HERO SECTIONS" title={SHOWCASE_PAGES[id].name} backHref="/admin/website-cms/hero-sections" />
    <Card title="Hero content" sub={state ? `Revision ${state.revision} · ${state.mode}` : 'Loading…'}>
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      {!state && <button className="sp-btn" type="button" onClick={() => void load()}>Reload</button>}
      <form className="cms-hero-form" onSubmit={(event) => { event.preventDefault(); void action('save-draft') }}>
        <fieldset disabled={disabled}>
          <nav className="cms-hero-tabs" aria-label="Content language">{ENABLED_LOCALES.map((value) => <button className="sp-btn" type="button" key={value} aria-pressed={locale === value} onClick={() => setLocale(value)}>{value.toUpperCase()}</button>)}</nav>
          <div className="cms-hero-fields">{Object.keys(draft.text[locale]).map((field) => <label key={field}>{labels[field] ?? field} ({locale.toUpperCase()})<input required maxLength={field === 'intro' ? 600 : field === 'title' || field === 'railTitle' ? 160 : 100} value={draft.text[locale][field]} onChange={(event) => change({ text: { ...draft.text, [locale]: { ...draft.text[locale], [field]: event.target.value } } })} /></label>)}</div>
          {Object.keys(draft.links).map((field) => <label className="cms-hero-media-field" key={field}>{field === 'primaryHref' ? 'Primary button destination' : field === 'secondaryHref' ? 'Secondary button destination' : 'Featured panel destination'}<SharedSelect disabled={disabled} value={draft.links[field]} onChange={(value) => change({ links: { ...draft.links, [field]: value } })} label={field} options={[...new Set([...Object.values(original().links), ...FAQ_HERO_DESTINATIONS])].map((value) => ({ value, label: value }))} /></label>)}
          {!isCompactHeroId(id) && <>
          {(['image', 'mobileImage'] as const).map((field) => <label className="cms-hero-media-field" key={field}>{field === 'image' ? 'Desktop image override' : 'Mobile image override'}<input value={draft[field]} maxLength={2000} onChange={(event) => change({ [field]: event.target.value })} /><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { void upload(event.target.files?.[0], field); event.target.value = '' }} />{draft[field] && <button className="sp-btn" type="button" onClick={() => change({ [field]: '' })}>Use original media</button>}</label>)}
          <label className="cms-hero-media-field">Image alt ({locale.toUpperCase()})<input value={draft.alt[locale]} maxLength={250} onChange={(event) => change({ alt: { ...draft.alt, [locale]: event.target.value } })} /></label>
          <label>Position<SharedSelect disabled={disabled} label="Position" value={draft.position} onChange={(value) => change({ position: value as ShowcaseHero['position'] })} options={['source', 'center', 'top', 'bottom', 'left', 'right'].map((value) => ({ value, label: value === 'source' ? 'Original position' : value }))} /></label>
          <label className="cms-hero-media-field"><input type="checkbox" checked={draft.overlay !== null} onChange={(event) => change({ overlay: event.target.checked ? 0.4 : null })} /> Custom overlay</label>
          {draft.overlay !== null && <label>Overlay {Math.round(draft.overlay * 100)}%<input type="range" min="0" max="85" value={Math.round(draft.overlay * 100)} onChange={(event) => change({ overlay: Number(event.target.value) / 100 })} /></label>}
          </>}
        </fieldset>
        <div className="cms-hero-actions"><button className="sp-btn" type="submit" disabled={disabled}><Save size={16} /> Save draft</button><button className="sp-btn" type="button" disabled={disabled || dirty || !state?.draft} onClick={() => setConfirm('publish')}><Send size={16} /> Publish saved draft</button><button className="sp-btn" type="button" disabled={disabled || dirty || state?.mode !== 'published'} onClick={() => setConfirm('unpublish')}><EyeOff size={16} /> Unpublish</button><button className="sp-btn" type="button" disabled={disabled} onClick={() => setConfirm('restore')}><RotateCcw size={16} /> Restore original</button></div>
      </form>
    </Card>
    <Card title="Live preview" action={<SharedSelect label="Preview size" value={width} onChange={setWidth} options={[{ value: 'desktop', label: 'Desktop' }, { value: 'mobile', label: 'Mobile' }]} />}>
      {state && <iframe ref={frame} onLoad={sync} src={'/website-cms-preview/showcase/' + id} title={SHOWCASE_PAGES[id].name + ' inactive preview'} className={'cms-hero-frame ' + width} />}
    </Card>
    <AdminConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)} onConfirm={() => { if (confirm) void action(confirm) }} canConfirm={!busy} title={confirm === 'restore' ? 'Restore original hero?' : confirm === 'unpublish' ? 'Unpublish hero?' : 'Publish saved draft?'} description={confirm === 'restore' ? 'This replaces the draft and unsaved edits and restores the original public hero. Featured records and other page content are not changed.' : 'This changes the public hero only. Other page content is not changed.'} confirmLabel="Confirm" />
  </>
}
