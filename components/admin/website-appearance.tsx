'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Monitor, Tablet, Smartphone, Save, Eye, RotateCcw, Undo2 } from 'lucide-react'
import { APPEARANCE_FIELDS, appearanceCss, contrastRatio, initialAppearance, validateAppearance, type AppearanceAction, type AppearanceState, type AppearanceToken, type AppearanceTokens } from '@/lib/website-appearance'
import { protectEnquiryNavigation } from '@/lib/enquiry-navigation'
import { AdminConfirmDialog } from './admin-confirm-dialog'
import { toast } from './admin-toaster'
import './website-appearance.css'

const endpoint = '/api/admin/website-cms/appearance'
const groups = ['Colors', 'Typography', 'Buttons', 'Forms', 'Cards & Layout'] as const
const stable = (tokens: AppearanceTokens) => JSON.stringify(Object.entries(tokens).sort(([a], [b]) => a.localeCompare(b)))
function previewDocument(tokens: AppearanceTokens, font: string, fontFaces: string) {
  const css = appearanceCss(tokens)
  return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
  *{box-sizing:border-box}body{margin:0} .public-appearance{--font-montserrat:${font};--primary:#f7951d;--blue:#1d4ed8;--yellow:#ffc531;--text:#1d1f1f;--muted:#737983;--border:#dedede;--surface:#fff;--content:1450px;--radius-card:22px;font-family:${font};font-size:16px;color:var(--text);background:#fff;min-height:100vh;letter-spacing:0} .container{width:calc(100% - 32px);max-width:var(--content);margin:auto}header{padding:20px 0;border-bottom:1px solid var(--border);color:var(--blue);font-weight:800}.section{padding-block:40px}h1{font-size:40px;line-height:1.1}h2{font-size:28px}h3{font-size:22px}h4{font-size:20px}h5{font-size:18px}h6{font-size:16px}p{line-height:1.6}small,.muted{color:var(--muted)}.primary-btn,.outline-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 24px;border:0;border-radius:999px;font-family:inherit;font-size:16px;font-weight:700;background:var(--primary);color:#fff;text-decoration:none;cursor:pointer}.primary-btn:hover{background:#e88410}.primary-btn:disabled{opacity:.5;cursor:not-allowed}.outline-btn{background:#fff;border:1px solid var(--blue);color:var(--blue)}.actions{display:flex;gap:12px;flex-wrap:wrap}.tour-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.tour-card{border:1px solid var(--border);border-radius:var(--radius-card);background:var(--surface);overflow:hidden;min-width:0}.tour-card img{width:100%;height:150px;object-fit:cover}.tour-body{padding:22px}.text-link{color:var(--blue)}.form-grid{display:grid;gap:16px;margin-top:24px}.form-grid label{display:grid;gap:8px;font-size:14px;font-weight:700}.form-grid input,.form-grid select,.form-grid textarea{min-height:48px;width:100%;padding:12px;border:1px solid var(--border);border-radius:8px;background:#fff;color:var(--text);font:inherit}.form-grid textarea{resize:vertical;min-height:90px}input::placeholder{color:var(--muted)}:focus-visible{outline:2px solid var(--blue);outline-offset:3px}@media(max-width:760px){h1{font-size:30px}.tour-grid{grid-template-columns:1fr}.section{padding-block:28px}}
  ${fontFaces}${css}</style></head><body><div class="public-appearance"><header><div class="container">STAR PYRAMIDS</div></header><main class="container"><section class="section"><h1>Discover Egypt</h1><p class="muted">Your next journey starts here.</p><div class="actions"><button class="primary-btn">Plan my trip</button><button class="outline-btn">View tours</button><button class="primary-btn" disabled>Unavailable</button></div><h2>Explore our journeys</h2><div class="tour-grid"><article class="tour-card"><img src="/egypt-hero.png" alt="Egypt"><div class="tour-body"><h3>Egypt adventures</h3><p>Ancient wonders and unforgettable journeys.</p><a class="text-link" href="#contact">Ask a question</a></div></article><article class="tour-card"><div class="tour-body"><h4>Your private journey</h4><p class="muted">Travel at your own pace.</p><h5>Local experiences</h5><h6>Made for you</h6><small>STAR PYRAMIDS Tours Egypt</small></div></article></div><form id="contact" class="form-grid"><label>Your name<input placeholder="Your name"></label><label>Destination<select><option>Cairo</option><option>Luxor</option></select></label><label>Your message<textarea placeholder="Tell us about your trip"></textarea></label><button type="button" class="primary-btn">Send enquiry</button></form></section></main></div></body></html>`
}

export function WebsiteAppearance({ canWrite, onGuardChange, onBusyChange }: { canWrite: boolean; onGuardChange: (guard: boolean) => void; onBusyChange: (busy: boolean) => void }) {
  const router = useRouter()
  const [state, setState] = useState<AppearanceState>(initialAppearance)
  const [tokens, setTokens] = useState<AppearanceTokens>({})
  const [baseline, setBaseline] = useState<AppearanceTokens>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [error, setError] = useState('')
    const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [group, setGroup] = useState<typeof groups[number]>('Colors')
  const [confirm, setConfirm] = useState<null | 'publish' | 'restore' | 'reset' | 'original' | 'reload'>(null)
  const [navigation, setNavigation] = useState<(() => void) | null>(null)
  const [preview, setPreview] = useState('')
  const fontFaces = useRef<string | null>(null)
  const dirty = stable(tokens) !== stable(baseline)
  const guard = useRef(false); const busyRef = useRef(false); const requestPending = useRef(false)
  guard.current = dirty || busy
  useEffect(() => { onGuardChange(dirty || busy); return () => onGuardChange(false) }, [dirty, busy, onGuardChange])
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false) }, [busy, onBusyChange])
  const load = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true; setLoading(true); setError('')
    try {
      const response = await fetch(endpoint, { cache: 'no-store' }); const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load appearance.')
      const next = data.state as AppearanceState; const content = next.draft ?? next.published ?? {}
      setState(next); setTokens(content); setBaseline(content); setAllowed(data.canEdit === true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load appearance.') }
    finally { busyRef.current = false; setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    // Reuse only the application's already-loaded font faces, never user-supplied URLs.
    if (fontFaces.current === null) fontFaces.current = Array.from(document.styleSheets).flatMap(sheet => {
      try { return Array.from(sheet.cssRules).filter(rule => rule.type === CSSRule.FONT_FACE_RULE).map(rule => rule.cssText) } catch { return [] }
    }).join('\n').replace(/<\/style/gi, '')
    try { validateAppearance(tokens); setPreview(previewDocument(tokens, getComputedStyle(document.body).fontFamily.replace(/[<>]/g, ''), fontFaces.current)) } catch { /* Invalid local HEX stays editable without entering preview CSS. */ }
  }, [tokens])
  useEffect(() => {
    const ask = (action: () => void) => { if (busyRef.current || requestPending.current) return; requestPending.current = true; setNavigation(() => action) }
    const cleanup = protectEnquiryNavigation(window, () => guard.current, ask)
    const click = (event: MouseEvent) => {
      if (!guard.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download') || anchor.target && anchor.target !== '_self') return
      const url = new URL(anchor.href); if (url.href === location.href) return
      event.preventDefault(); event.stopPropagation()
      ask(() => url.origin === location.origin ? router.push(url.pathname + url.search + url.hash) : location.assign(url.href))
    }
    document.addEventListener('click', click, true)
    return () => { cleanup(); document.removeEventListener('click', click, true) }
  }, [router])
  async function change(action: AppearanceAction) {
    if (busyRef.current || !allowed || !canWrite || loading || (action !== 'save-draft' && dirty)) return
    try { if (action === 'save-draft') validateAppearance(tokens) } catch (e) { setError((e as Error).message); return }
    busyRef.current = true; setBusy(true); setError('')
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: state.revision, action, ...(action === 'save-draft' ? { content: tokens } : {}) }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to save appearance.')
      const next = data.state as AppearanceState; const content = next.draft ?? next.published ?? {}
      setState(next); setTokens(content); setBaseline(content)
      toast.success(action === 'save-draft' ? 'Draft saved.' : action === 'publish' ? 'Appearance published.' : 'Previous published appearance restored.', { dedupeKey: 'appearance-action' })
      if (action !== 'save-draft') router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save appearance.') }
    finally { busyRef.current = false; setBusy(false); setConfirm(null) }
  }
  const effectiveColor = (key: AppearanceToken) => String(tokens[key] ?? APPEARANCE_FIELDS[key].default)
  const warnings = ([['text', 'background', 'Body text'], ['buttonText', 'buttonBackground', 'Primary button'], ['secondaryButtonText', 'secondaryButtonBackground', 'Secondary button'], ['inputText', 'inputBackground', 'Field text']] as const).filter(([a, b]) => contrastRatio(effectiveColor(a), effectiveColor(b)) < 4.5)
  const disabled = busy || loading || !canWrite || !allowed
  return <div className="appearance-manager">
    {loading && <p role="status">Loading appearance...</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" className="sp-btn" disabled={loading || busy} onClick={() => setConfirm('reload')}>Reload</button></div>}
   
    {!loading && <>
      <div className="appearance-toolbar"><span>Revision {state.revision} · {state.draft !== null ? 'Draft available' : state.published !== null ? 'Published' : 'Original design'}</span><div>
        <button className="sp-btn" disabled={disabled || !dirty} onClick={() => void change('save-draft')}><Save size={16} />Save draft</button>
        <button className="sp-btn dark" disabled={disabled || dirty || state.draft === null} onClick={() => setConfirm('publish')}><Eye size={16} />Publish</button>
        <button className="sp-btn" disabled={disabled || dirty || !state.hasPrevious} onClick={() => setConfirm('restore')}><Undo2 size={16} />Restore previous</button>
        <button className="sp-btn" disabled={busy} onClick={() => setConfirm('reset')}><RotateCcw size={16} />Reset to published</button>
        <button className="sp-btn" disabled={disabled} onClick={() => setConfirm('original')}>Original defaults</button>
      </div></div>
      <div className="appearance-tabs" role="group" aria-label="Appearance settings">{groups.map(item => <button type="button" aria-pressed={group === item} aria-controls="appearance-controls" className={`sp-btn${group === item ? ' dark' : ''}`} key={item} onClick={() => setGroup(item)}>{item}</button>)}</div>
      <fieldset disabled={disabled} id="appearance-controls" className="appearance-fields"><legend>{group}</legend>{Object.entries(APPEARANCE_FIELDS).filter(([, field]) => field.group === group).map(([name, field]) => {
        const key = name as AppearanceToken; const active = tokens[key] !== undefined; const value = tokens[key] ?? field.default
        return <div className="appearance-field" key={key}><label className="appearance-override"><input type="checkbox" checked={active} onChange={event => setTokens(old => { const next = { ...old }; if (event.target.checked) next[key] = field.default; else delete next[key]; return next })} />{field.label}</label>
          <div className="appearance-control">{field.kind === 'color' ? <><input aria-label={`${field.label} color picker`} type="color" disabled={!active} value={/^#[\da-f]{6}$/i.test(String(value)) ? String(value) : String(field.default)} onChange={event => setTokens(old => ({ ...old, [key]: event.target.value }))} /><input aria-label={`${field.label} HEX`} type="text" dir="ltr" maxLength={7} pattern="#[0-9a-fA-F]{6}" disabled={!active} value={value} onChange={event => setTokens(old => ({ ...old, [key]: event.target.value }))} /></> : field.kind === 'select' ? <select aria-label={field.label} disabled={!active} value={value} onChange={event => setTokens(old => ({ ...old, [key]: event.target.value }))}>{('options' in field ? field.options ?? [] : []).map(option => <option key={option} value={option}>{option}</option>)}</select> : <input aria-label={field.label} type="number" disabled={!active} min={'min' in field ? field.min : undefined} max={'max' in field ? field.max : undefined} step={key.endsWith('Weight') ? 100 : ['lineHeight', 'disabledOpacity', 'mobileHeadingScale', 'tabletHeadingScale'].includes(key) ? 0.05 : 1} value={value} onChange={event => setTokens(old => ({ ...old, [key]: event.target.value === '' ? '' : Number(event.target.value) }))} />}</div></div>
      })}</fieldset>
      {warnings.length > 0 && <div role="status" className="appearance-warnings">{warnings.map(([, , label]) => <p key={label}>{label}: contrast is below 4.5:1.</p>)}</div>}
      <section className="appearance-preview" aria-label="Draft appearance preview"><div className="appearance-devices" role="group" aria-label="Preview viewport">{([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([name, Icon]) => <button type="button" key={name} title={name} aria-label={`${name} preview`} aria-pressed={device === name} className={`sp-btn${device === name ? ' dark' : ''}`} onClick={() => setDevice(name)}><Icon size={18} /></button>)}</div><div className="appearance-preview-scroll"><iframe title="Unpublished appearance preview" sandbox="" srcDoc={preview} style={{ width: device === 'mobile' ? 375 : device === 'tablet' ? 820 : 1200 }} /></div></section>
    </>}
    <AdminConfirmDialog open={confirm !== null} title={confirm === 'publish' ? 'Publish website appearance?' : confirm === 'restore' ? 'Restore previous published appearance?' : confirm === 'original' ? 'Load original design into the editor?' : confirm === 'reload' ? 'Discard local edits and reload appearance?' : 'Reset editor to published appearance?'} description={confirm === 'publish' || confirm === 'restore' ? 'This changes public appearance only. Content and SEO drafts remain unchanged.' : 'Unsaved local appearance edits will be replaced. The live website will not change.'} confirmLabel={confirm === 'publish' ? 'Publish' : confirm === 'restore' ? 'Restore' : 'Continue'} canConfirm={!busy} onClose={() => setConfirm(null)} onConfirm={() => {
      if (confirm === 'publish' || confirm === 'restore') { void change(confirm); return }
      if (confirm === 'reload') { setConfirm(null); void load(); return }
      setTokens(confirm === 'original' ? {} : state.published ?? {}); setConfirm(null)
    }} />
    <AdminConfirmDialog open={navigation !== null} title="Discard unsaved appearance edits?" confirmLabel="Discard and leave" cancelLabel="Keep editing" canConfirm={!busy} onClose={() => { requestPending.current = false; setNavigation(null) }} onConfirm={() => { guard.current = false; requestPending.current = false; const action = navigation; setNavigation(null); action?.() }} />
  </div>
}
