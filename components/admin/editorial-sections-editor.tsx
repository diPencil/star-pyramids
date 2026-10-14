'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { AdminConfirmDialog } from './admin-confirm-dialog'
import { SharedSelect } from '@/components/shared-select'
import { FAQ_HERO_DESTINATIONS, type EditorialSection } from '@/lib/faq-hero'
import type { EnabledLocale } from '@/lib/locale-config'

export function EditorialSectionsEditor({ sections, locale, disabled, onChange }: {
  sections: EditorialSection[]; locale: EnabledLocale; disabled: boolean; onChange: (sections: EditorialSection[]) => void
}) {
  const [removeId, setRemoveId] = useState<string | null>(null)
  const change = (index: number, field: 'heading' | 'description' | 'action', value: string) => {
    onChange(sections.map((section, position) => position === index ? { ...section, text: { ...section.text, [locale]: { ...section.text[locale], [field]: value } } } : section))
  }
  const move = (index: number, step: number) => {
    const next = [...sections]
    const target = index + step
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }
  const add = () => {
    if (disabled || sections.length >= 8) return
    const fields = () => ({ heading: '', description: '', action: '' })
    onChange([...sections, { id: 'section-' + crypto.randomUUID(), text: { en: fields(), es: fields(), it: fields() }, href: '/contact' }])
  }
  return <section className="cms-page-sections" aria-labelledby="cms-page-sections-title">
    <h2 id="cms-page-sections-title">Page sections</h2>
    {sections.map((section, index) => <fieldset key={section.id} className="cms-page-section" disabled={disabled}>
      <legend>{index + 1}. {section.text[locale].heading || 'New section'}</legend>
      <div className="cms-hero-actions">
        <button type="button" className="sp-btn" title="Move section up" aria-label={`Move section ${index + 1} up`} disabled={disabled || index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button>
        <button type="button" className="sp-btn" title="Move section down" aria-label={`Move section ${index + 1} down`} disabled={disabled || index === sections.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button>
        <button type="button" className="sp-btn" title="Remove section" aria-label={`Remove section ${index + 1}`} disabled={disabled} onClick={() => setRemoveId(section.id)}><Trash2 size={16} /></button>
      </div>
      <label>Section heading ({locale.toUpperCase()})<input required maxLength={120} value={section.text[locale].heading} onChange={(event) => change(index, 'heading', event.target.value)} /></label>
      <label>Section content ({locale.toUpperCase()})<textarea required maxLength={1200} rows={5} value={section.text[locale].description} onChange={(event) => change(index, 'description', event.target.value)} /></label>
      <div className="cms-hero-fields">
        <label>Link label ({locale.toUpperCase()})<input required maxLength={100} value={section.text[locale].action} onChange={(event) => change(index, 'action', event.target.value)} /></label>
        <label>Link destination<SharedSelect value={section.href} label={`Section ${index + 1} destination`} disabled={disabled} options={FAQ_HERO_DESTINATIONS.map((href) => ({ value: href, label: href }))} onChange={(href) => onChange(sections.map((item, position) => position === index ? { ...item, href } : item))} /></label>
      </div>
    </fieldset>)}
    <button type="button" className="sp-btn" disabled={disabled || sections.length >= 8} onClick={add}><Plus size={16} /> Add section</button>
    <AdminConfirmDialog open={removeId !== null} onClose={() => setRemoveId(null)} title="Remove this section from the draft?" description="The public page changes only after saving and publishing the draft." confirmLabel="Remove section" canConfirm={!disabled} onConfirm={() => { onChange(sections.filter((section) => section.id !== removeId)); setRemoveId(null) }} />
  </section>
}
