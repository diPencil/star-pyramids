'use client'
import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { SharedSelect } from '@/components/shared-select'
import { CMS_STATIC_LINKS } from '@/lib/page-sections'

type Option = { value: string; label: string; href: string }
export function CmsRecordPicker({ source, selected, disabled, onChange, onChoose }: { source: string; selected: string[]; disabled: boolean; onChange?: (slugs: string[]) => void; onChoose?: (option: Option) => void }) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<Option[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setOptions([])
    const timer = setTimeout(() => {
      void fetch(`/api/admin/website-cms/reference-options?source=${source}&q=${encodeURIComponent(query)}`, { signal: controller.signal, cache: 'no-store' }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(); if (!controller.signal.aborted) setOptions(data.options) }).catch(() => { if (!controller.signal.aborted) setError('Could not load published content.') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [source, query, retry])
  const move = (index: number, delta: number) => { const next = [...selected]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; onChange?.(next) }
  return <div className="cms-record-picker">
    <label>Search published {source}<input value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} disabled={disabled} /></label>
    {onChange && selected.length > 0 && <ol>{selected.map((slug, index) => <li key={slug}><span>{options.find((option) => option.value === slug)?.label ?? slug}</span><button className="sp-btn" type="button" disabled={disabled || index === 0} title="Move up" aria-label={`Move ${slug} up`} onClick={() => move(index, -1)}><ArrowUp size={16} /></button><button className="sp-btn" type="button" disabled={disabled || index === selected.length - 1} title="Move down" aria-label={`Move ${slug} down`} onClick={() => move(index, 1)}><ArrowDown size={16} /></button><button className="sp-btn" type="button" disabled={disabled} title="Remove selection" aria-label={`Remove ${slug}`} onClick={() => onChange(selected.filter((value) => value !== slug))}><X size={16} /></button></li>)}</ol>}
    {loading && <p role="status">Loading published content…</p>}{error && <p role="alert">{error} <button type="button" className="sp-btn" onClick={() => setRetry((value) => value + 1)}>Retry</button></p>}
    {!loading && !error && options.length === 0 && <p>No matching published content.</p>}
    <div className="cms-record-options">{options.map((option) => onChoose ? <button className="sp-btn" type="button" disabled={disabled} key={option.value} onClick={() => onChoose(option)}>{option.label}</button> : <label key={option.value}><input type="checkbox" checked={selected.includes(option.value)} disabled={disabled || (!selected.includes(option.value) && selected.length >= 30)} onChange={(event) => onChange?.(event.target.checked ? [...selected, option.value] : selected.filter((value) => value !== option.value))} /><span>{option.label}</span></label>)}</div>
  </div>
}
export function CmsLinkField({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }) {
  const [source, setSource] = useState('tours')
  const [browse, setBrowse] = useState(false)
  const custom = !CMS_STATIC_LINKS.includes(value as typeof CMS_STATIC_LINKS[number])
  return <div className="cms-link-field"><label>Link destination<SharedSelect value={custom ? 'custom' : value} label="Link destination" disabled={disabled} options={[...CMS_STATIC_LINKS.map((href) => ({ value: href, label: href })), { value: 'custom', label: 'Content reference or HTTPS URL' }]} onChange={(href) => onChange(href === 'custom' ? 'https://' : href)} /></label>
    {custom && <label>Validated internal content link or HTTPS URL<input value={value} maxLength={2000} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>}
    <details onToggle={(event) => setBrowse(event.currentTarget.open)}><summary>Choose published business content</summary>{browse && <><SharedSelect value={source} label="Content source" disabled={disabled} onChange={setSource} options={['tours', 'destinations', 'blogs', 'offers'].map((value) => ({ value, label: value }))} /><CmsRecordPicker key={source} source={source} selected={[]} disabled={disabled} onChoose={(option) => onChange(option.href)} /></>}</details>
  </div>
}
