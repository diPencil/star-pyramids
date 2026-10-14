'use client'
import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, RotateCcw, Save, Send, Upload } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { Card } from '@/components/admin/admin-ui'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { SharedSelect } from '@/components/shared-select'
import { ENABLED_LOCALES, type EnabledLocale } from '@/lib/locale-config'
import { FAQ_HERO_DESTINATIONS, type FaqHero, type FaqHeroState } from '@/lib/faq-hero'
import { originalEditorialHero, EDITORIAL_HERO_PAGES, type EditorialHeroId } from '@/lib/editorial-hero-definitions'
import type { HeroAction } from '@/lib/website-heroes'
import { isInformationPageId } from '@/lib/information-pages'
import { EditorialSectionsEditor } from './editorial-sections-editor'
import '@/app/admin/website-cms/hero-sections/homepage/hero-editor.css'

export function EditorialHeroEditor({ id }: { id: EditorialHeroId }) {
  const original = () => originalEditorialHero(id)
  const endpoint = '/api/admin/website-cms/editorial-heroes/' + id
  const page = EDITORIAL_HERO_PAGES[id]
  const hasPageSections = isInformationPageId(id)
  const [state, setState] = useState<FaqHeroState | null>(null)
  const [draft, setDraft] = useState<FaqHero>(original)
  const [canEdit, setCanEdit] = useState(false)
  const [locale, setLocale] = useState<EnabledLocale>('en')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState<HeroAction | null>(null)
  const [preview, setPreview] = useState(false)
  const [width, setWidth] = useState('desktop')
  const lock = useRef(false)
  const load = async () => {
    setError('')
    try {
      const response = await fetch(endpoint, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error()
      setState(data.state); setDraft(data.state.draft ?? data.state.published ?? original()); setCanEdit(data.canEdit); setDirty(false)
    } catch { setError('Could not load hero. Reload to retry.') }
  }
  useEffect(() => { void load() }, [])
  const change = (next: Partial<FaqHero>) => { setDraft((previous) => ({ ...previous, ...next })); setDirty(true); setNotice(''); setPreview(false) }
  const action = async (command: HeroAction) => {
    if (!state || !canEdit || lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: command, revision: state.revision, ...(command === 'save-draft' ? { content: draft } : {}) }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save hero.')
      setState(data.state); setDraft(data.state.draft ?? data.state.published ?? original()); setDirty(false)
      setNotice(command === 'save-draft' ? 'Draft saved. Public content is unchanged.' : command === 'publish' ? hasPageSections ? 'Page content published.' : 'Hero published.' : command === 'restore' ? hasPageSections ? 'Original hero and page sections restored and published.' : 'Original hero restored and published.' : 'Hero unpublished. Page content is unchanged.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save hero.') }
    finally { lock.current = false; setBusy(false); setConfirm(null) }
  }
  const upload = async (file?: File) => {
    if (!file || !canEdit || !state || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const body = new FormData(); body.set('file', file); body.set('type', 'image')
      const response = await fetch('/api/admin/website-cms/hero-media', { method: 'POST', body })
      const data = await response.json()
      if (!response.ok || typeof data.media?.url !== 'string') throw new Error(data.error || 'Upload failed.')
      change({ image: data.media.url }); setNotice('Image uploaded. Reference is not published yet.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Upload failed.') }
    finally { lock.current = false; setBusy(false) }
  }
  const disabled = !state || !canEdit || busy
  const fields = draft.text[locale]
  const labels = { heading: 'Heading', eyebrow: 'Small heading', description: 'Description', action: 'Button label', alt: 'Image alt text' }
  return <>
    <PageHead eyebrow="HERO SECTIONS" title={page.name} backHref="/admin/website-cms/hero-sections" />
    <Card title="Hero content" sub={state ? `Revision ${state.revision} · ${state.mode}` : 'Loading…'}>
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      {!state && <button type="button" className="sp-btn" onClick={() => void load()}>Reload</button>}
      <form className="cms-hero-form" onSubmit={(event) => { event.preventDefault(); void action('save-draft') }}>
        <fieldset disabled={disabled}>
          <nav className="cms-hero-tabs" aria-label="Content language">{ENABLED_LOCALES.map((value) => <button key={value} type="button" className="sp-btn" aria-pressed={locale === value} onClick={() => setLocale(value)}>{value.toUpperCase()}</button>)}</nav>
          <div className="cms-hero-fields">{(Object.keys(labels) as (keyof typeof labels)[]).map((field) => <label key={field}>{labels[field]} ({locale.toUpperCase()})<input value={fields[field]} maxLength={field === 'description' ? 600 : field === 'heading' ? 160 : field === 'alt' ? 250 : 100} required={field !== 'eyebrow' && field !== 'alt'} onChange={(event) => change({ text: { ...draft.text, [locale]: { ...fields, [field]: event.target.value } } })} /></label>)}</div>
          <label className="cms-hero-media-field">Image URL<input value={draft.image} maxLength={2000} required onChange={(event) => change({ image: event.target.value })} /></label>
          <label className="cms-hero-media-field"><span><Upload size={16} /> Upload image</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = '' }} /></label>
          <label>Button destination<SharedSelect value={draft.href} onChange={(href) => change({ href })} label="Button destination" disabled={disabled} options={FAQ_HERO_DESTINATIONS.map((value) => ({ value, label: value }))} /></label>
          {hasPageSections && <EditorialSectionsEditor sections={draft.sections ?? []} locale={locale} disabled={disabled} onChange={(sections) => change({ sections })} />}
        </fieldset>
        <div className="cms-hero-actions">
          <button type="submit" className="sp-btn" disabled={disabled}><Save size={16} /> Save draft</button>
          <button type="button" className="sp-btn" disabled={!state?.draft || dirty || busy} onClick={() => setPreview((value) => !value)}><Eye size={16} /> Preview saved draft</button>
          <button type="button" className="sp-btn" disabled={disabled || dirty || !state?.draft} onClick={() => setConfirm('publish')}><Send size={16} /> Publish saved draft</button>
          <button type="button" className="sp-btn" disabled={disabled || dirty || state?.mode !== 'published'} onClick={() => setConfirm('unpublish')}><EyeOff size={16} /> Unpublish</button>
          <button type="button" className="sp-btn" disabled={disabled} onClick={() => setConfirm('restore')}><RotateCcw size={16} /> Restore original</button>
        </div>
      </form>
    </Card>
    {preview && <Card title="Saved draft preview" action={<SharedSelect value={width} onChange={setWidth} label="Preview size" options={[{ value: 'desktop', label: 'Desktop' }, { value: 'mobile', label: 'Mobile' }]} />}><iframe key={`${state?.revision}-${locale}`} title={page.name + ' saved draft preview'} src={'/website-cms-preview/editorial/' + id + '?locale=' + locale} className={'cms-hero-frame ' + width} /></Card>}
    <AdminConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)} onConfirm={() => { if (confirm) void action(confirm) }} canConfirm={!busy} title={confirm === 'restore' ? hasPageSections ? 'Restore original page content?' : 'Restore original hero?' : confirm === 'unpublish' ? 'Unpublish hero?' : 'Publish saved draft?'} description={hasPageSections ? confirm === 'restore' ? 'This replaces the draft and published hero and page sections with the original content.' : confirm === 'unpublish' ? 'This hides the hero. Published page sections remain unchanged.' : 'This publishes the saved hero and all saved page sections.' : confirm === 'restore' ? 'This replaces the saved draft, unsaved edits and published hero with the original content. Other page content is not changed.' : 'This changes the public hero only. Other page content is not changed.'} confirmLabel="Confirm" />
  </>
}
