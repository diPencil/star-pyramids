'use client'

import { useId, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { tx, type Locale } from '../locale'
import { filterReviewTrips, REVIEW_TRIP_TYPES, reviewTripTypeLabel, type ReviewTripChoice } from '@/lib/reviews/review-trip-options'

/** Inline search/listbox: no native popup or portal can escape the review dialog. */
export function ReviewTripPicker({ tours, value, onChange, disabled, loading, locale }: {
  tours: readonly ReviewTripChoice[]; value: string; onChange: (slug: string) => void; disabled?: boolean; loading?: boolean; locale: Locale
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const search = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const matches = filterReviewTrips(tours, query, category, locale)
  const selected = tours.find(tour => tour.slug === value)
  const index = Math.min(active, Math.max(0, matches.length - 1))
  const choose = (tour: ReviewTripChoice) => { onChange(tour.slug); setOpen(false) }
  const label = tx(locale, { en: 'Choose your trip', es: 'Elige tu viaje', it: 'Scegli il tuo viaggio' })
  return <div className="rev-trip-picker" aria-busy={loading || undefined} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <label htmlFor={id}>{label}</label>
    <input ref={search} id={id} className="rev-trip-search" type="search" role="combobox" data-review-trip-search
      autoComplete="off" maxLength={120} value={query} disabled={disabled} aria-autocomplete="list" aria-expanded={open} aria-controls={open ? id + '-list' : undefined} aria-activedescendant={open && matches.length ? id + '-option-' + index : undefined}
      placeholder={tx(locale, { en: 'Search trip name…', es: 'Buscar por nombre del viaje…', it: 'Cerca il nome del viaggio…' })}
      onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); onChange('') }}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter'].includes(event.key)) return
        if (event.key === 'Enter') { event.preventDefault(); if (open && matches[index]) choose(matches[index]); return }
        // Home/End retain normal text-cursor behavior while editing a search.
        if (query && (event.key === 'Home' || event.key === 'End')) return
        event.preventDefault()
        setOpen(true)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? matches.length - 1 : Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
        setActive(Math.max(0, next))
        list.current?.querySelectorAll<HTMLElement>('[role="option"]')[next]?.scrollIntoView({ block: 'nearest' })
      }}/>
    <div className="rev-trip-types" role="group" aria-label={tx(locale, { en: 'Tour type', es: 'Tipo de viaje', it: 'Tipo di viaggio' })}>
      {['all', ...REVIEW_TRIP_TYPES].map(type => <button key={type} type="button" disabled={disabled} aria-pressed={category === type} onClick={() => { setCategory(type); setActive(0); setOpen(true); onChange('') }}>{reviewTripTypeLabel(type, locale)}</button>)}
    </div>
    {selected && <div className="rev-trip-selected"><div><strong>{selected.title}</strong><small>{reviewTripTypeLabel(selected.category, locale)}</small></div><button type="button" disabled={disabled} aria-label={tx(locale, { en: 'Clear selected trip', es: 'Quitar el viaje seleccionado', it: 'Rimuovi il viaggio selezionato' })} onClick={() => { onChange(''); setQuery(''); setCategory('all'); setActive(0); setOpen(true); search.current?.focus() }}><X size={16}/></button></div>}
    {open && <div ref={list} id={id + '-list'} className="rev-trip-results" role="listbox" aria-label={label}>
      {matches.map((tour, option) => <button key={tour.slug} id={id + '-option-' + option} type="button" role="option" aria-selected={value === tour.slug} tabIndex={-1} disabled={disabled} data-active={option === index || undefined} onMouseDown={event => event.preventDefault()} onClick={() => { setActive(option); choose(tour) }}>
        <span><strong>{tour.title}</strong><small>{reviewTripTypeLabel(tour.category, locale)}</small></span>{value === tour.slug && <Check size={18} aria-hidden="true"/>}
      </button>)}
      {!loading && !matches.length && <p role="status">{tx(locale, { en: 'No matching trips. Try another name or tour type.', es: 'No hay viajes coincidentes. Prueba otro nombre o tipo.', it: 'Nessun viaggio corrispondente. Prova un altro nome o tipo.' })}</p>}
    </div>}
  </div>
}
