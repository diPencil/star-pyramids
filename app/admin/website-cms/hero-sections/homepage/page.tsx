'use client'
import { useEffect, useRef, useState } from 'react'
import { Eye, Save, Send, RotateCcw, EyeOff, Upload } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { Card } from '@/components/admin/admin-ui'
import { toast } from '@/components/admin/admin-toaster'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { SharedSelect } from '@/components/shared-select'
import { ENABLED_LOCALES, type EnabledLocale } from '@/lib/locale-config'
import { originalHomeHero, type HomeHero, type HeroState, type HeroAction } from '@/lib/website-heroes'
import './hero-editor.css'

export default function HomepageHeroEditor() {
  const [state, setState] = useState<HeroState | null>(null)
  const [draft, setDraft] = useState<HomeHero>(originalHomeHero)
  const [canEdit, setCanEdit] = useState(false)
  const [locale, setLocale] = useState<EnabledLocale>('en')
  const [source, setSource] = useState<'url' | 'upload'>('url')
  const [width, setWidth] = useState<'desktop' | 'mobile'>('desktop')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [confirm, setConfirm] = useState<HeroAction | null>(null)
  const [preview, setPreview] = useState(false)
  const liveFrame = useRef<HTMLIFrameElement>(null)
  const syncPreview = () => liveFrame.current?.contentWindow?.postMessage({ type: 'star-hero-preview', content: draft, locale }, window.location.origin)
  useEffect(() => { syncPreview() }, [draft, locale])
  useEffect(() => {
    const ready = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === liveFrame.current?.contentWindow && event.data?.type === 'star-hero-preview-ready') syncPreview()
    }
    window.addEventListener('message', ready)
    return () => window.removeEventListener('message', ready)
  }, [draft, locale])
  const load = async () => {
    setError('')
    try {
      const response = await fetch('/api/admin/website-cms/hero-sections', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setState(data.state); setDraft(data.state.draft ?? data.state.published ?? originalHomeHero()); setCanEdit(data.canEdit); setDirty(false)
    } catch { setError('Could not load hero. Reload to retry; unsaved edits are not sent automatically.') }
  }
  useEffect(() => { void load() }, [])
  const change = (next: Partial<HomeHero>) => { setDraft((previous) => ({ ...previous, ...next })); setDirty(true) }
  const action = async (command: HeroAction) => {
    if (!state || lock.current || !canEdit) return
    lock.current = true; setBusy(true); setError('')
    try {
      const response = await fetch('/api/admin/website-cms/hero-sections', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: command, revision: state.revision, ...(command === 'save-draft' ? { content: draft } : {}) }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save hero.')
      setState(data.state); setDraft(data.state.draft ?? data.state.published ?? originalHomeHero()); setDirty(false)
      toast.success(command === 'save-draft' ? 'Draft saved. Public content is unchanged.' : command === 'publish' ? 'Hero published.' : command === 'restore' ? 'Original content restored and published.' : 'Hero unpublished. Search forms remain available.', { dedupeKey: 'home-hero-command' })
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save hero.') }
    finally { lock.current = false; setBusy(false); setConfirm(null) }
  }
  const upload = async (file: File | undefined, field: 'mediaUrl' | 'mobileUrl' | 'poster') => {
    if (!file || lock.current || !canEdit) return
    lock.current = true; setBusy(true); setError('')
    const body = new FormData(); body.set('file', file); body.set('type', field === 'poster' ? 'image' : draft.mediaType)
    try {
      const response = await fetch('/api/admin/website-cms/hero-media', { method: 'POST', body })
      const data = await response.json()
      if (!response.ok || typeof data.media?.url !== 'string') throw new Error(data.error || 'Upload failed.')
      change({ [field]: data.media.url }); toast.info('Upload ready. Save the draft to retain this reference.', { dedupeKey: 'home-hero-upload' })
    } catch (error) { setError(error instanceof Error ? error.message : 'Upload failed.') }
    finally { lock.current = false; setBusy(false) }
  }
  const disabled = !state || !canEdit || busy
  const text = draft.text[locale]
  return <>
    <PageHead eyebrow="HERO SECTIONS" title="Homepage" sub="Original search and trip-planning controls are preserved" />
    <Card title="Hero content" sub={state ? 'Revision ' + state.revision + ' · ' + state.mode : 'Loading…'}>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!state && <button type="button" className="sp-btn" onClick={() => void load()}>Reload</button>}
      <form onSubmit={(event) => { event.preventDefault(); void action('save-draft') }} className="cms-hero-form">
        <fieldset disabled={disabled}>
          <nav className="cms-hero-tabs" aria-label="Content language">{ENABLED_LOCALES.map((language) => <button key={language} type="button" className="sp-btn" aria-pressed={locale === language} onClick={() => setLocale(language)}>{language.toUpperCase()}</button>)}</nav>
          <div className="cms-hero-fields">{(['heading', 'eyebrow', 'alt'] as const).map((field) => <label key={field}>{field === 'heading' ? 'Heading' : field === 'eyebrow' ? 'Small heading' : 'Media accessibility text'} ({locale.toUpperCase()})<input value={text[field]} maxLength={field === 'alt' ? 250 : field === 'heading' ? 160 : 100} required={field !== 'eyebrow'} onChange={(event) => change({ text: { ...draft.text, [locale]: { ...text, [field]: event.target.value } } })} /></label>)}</div>
          <div className="cms-hero-fields">
            <label>Media type<SharedSelect value={draft.mediaType} onChange={(value) => change({ mediaType: value as HomeHero['mediaType'], mediaUrl: '', mobileUrl: '' })} label="Media type" disabled={disabled} options={[{ value: 'image', label: 'Image' }, { value: 'video', label: 'Video (MP4 / WebM)' }]} /></label>
            <label>Media source<SharedSelect value={source} onChange={(value) => setSource(value as typeof source)} label="Media source" disabled={disabled} options={[{ value: 'url', label: 'URL' }, { value: 'upload', label: 'Upload' }]} /></label>
            <label>Position<SharedSelect value={draft.position} onChange={(value) => change({ position: value as HomeHero['position'] })} label="Position" disabled={disabled} options={['center', 'top', 'bottom', 'left', 'right'].map((value) => ({ value, label: value }))} /></label>
          </div>
          {(['mediaUrl', 'mobileUrl', 'poster'] as const).map((field) => <label className="cms-hero-media-field" key={field}>{field === 'mediaUrl' ? 'Desktop media' : field === 'mobileUrl' ? 'Mobile media (optional)' : 'Poster / image fallback'}
            {source === 'url' ? <input value={draft[field]} onChange={(event) => change({ [field]: event.target.value })} placeholder={field === 'poster' ? '/egypt-hero.png' : 'https://…'} /> : <span><Upload size={16} /><input type="file" accept={field === 'poster' || draft.mediaType === 'image' ? 'image/jpeg,image/png,image/webp,image/gif' : 'video/mp4,video/webm'} onChange={(event) => { void upload(event.target.files?.[0], field); event.target.value = '' }} /><small>{draft[field] || 'No custom file selected'}</small></span>}
            {field === 'mobileUrl' && draft.mobileUrl && <button type="button" className="sp-btn" onClick={() => change({ mobileUrl: '' })}>Use desktop media on mobile</button>}
          </label>)}
          <label><input type="checkbox" checked={draft.overlay !== null} onChange={(event) => change({ overlay: event.target.checked ? 0.4 : null })} /> Custom overlay</label>
          {draft.overlay !== null && <label>Overlay {Math.round(draft.overlay * 100)}%<input type="range" min="0" max="85" value={Math.round(draft.overlay * 100)} onChange={(event) => change({ overlay: Number(event.target.value) / 100 })} /></label>}
        </fieldset>
        <div className="cms-hero-actions">
          <button className="sp-btn" type="submit" disabled={disabled}><Save size={16} /> Save draft</button>
          <button className="sp-btn" type="button" disabled={!state?.draft || busy || dirty} onClick={() => setPreview((value) => !value)}><Eye size={16} /> Preview saved draft</button>
          <button className="sp-btn" type="button" disabled={disabled || dirty || !state?.draft} onClick={() => setConfirm('publish')}><Send size={16} /> Publish saved draft</button>
          <button className="sp-btn" type="button" disabled={disabled || dirty || state?.mode !== 'published'} onClick={() => setConfirm('unpublish')}><EyeOff size={16} /> Unpublish</button>
          <button className="sp-btn" type="button" disabled={disabled} onClick={() => setConfirm('restore')}><RotateCcw size={16} /> Restore original</button>
        </div>
      </form>
    </Card>
    <Card title="Live content preview" action={<SharedSelect label="Preview size" value={width} onChange={(value) => setWidth(value as typeof width)} options={[{ value: 'desktop', label: 'Desktop' }, { value: 'mobile', label: 'Mobile' }]} />}>
      {state && <iframe ref={liveFrame} onLoad={syncPreview} title="Live homepage hero with inactive search controls" src="/website-cms-preview/homepage" className={'cms-hero-frame ' + width} />}
      {preview && <iframe key={String(state?.revision) + locale + width} title="Saved homepage draft with inactive search controls" src={'/website-cms-preview/homepage?locale=' + locale} className={'cms-hero-frame ' + width} />}
    </Card>
    <AdminConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)} onConfirm={() => { if (confirm) void action(confirm) }} canConfirm={!busy} title={confirm === 'restore' ? 'Restore original homepage hero?' : confirm === 'unpublish' ? 'Unpublish homepage hero?' : 'Publish saved homepage draft?'} description={confirm === 'restore' ? 'This replaces the saved draft, unsaved edits and published hero with the original content. Existing booking and search controls are not changed.' : 'This changes the public hero. Existing booking and search controls are not changed.'} confirmLabel="Confirm" />
  </>
}
