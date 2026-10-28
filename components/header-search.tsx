'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowRight, Search } from 'lucide-react'
import { nextSearchOption, searchHref, SEARCH_TYPE_LABELS, type SearchResult } from '@/lib/site-search'
import { usePublicSearch } from '@/lib/use-public-search'
import { tx, useLocale } from './locale'

type HeaderSearchProps = { mobile?: boolean; query: string; onQueryChange(value: string): void; placeholder: string; submitLabel: string }

export function HeaderSearch({ mobile = false, query, onQueryChange, placeholder, submitLabel }: HeaderSearchProps) {
  const router = useRouter()
  const pathname = usePathname()
  const form = useRef<HTMLFormElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [count, setCount] = useState(0)
  const id = useId()
  const show = open && !!query.trim()
  useEffect(() => { setOpen(false); setActive(-1) }, [pathname])
  useEffect(() => { setActive(-1) }, [query])
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => { if (event.target instanceof Node && !form.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1); return }
    const options = form.current?.querySelectorAll<HTMLAnchorElement>('[role="option"]')
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true)
      const next = nextSearchOption(active, event.key, options?.length ?? 0)
      setActive(next)
      options?.[next]?.scrollIntoView?.({ block: 'nearest' })
    }
    if (event.key === 'Enter' && show && active >= 0 && options?.[active]) {
      event.preventDefault()
      router.push(options[active].getAttribute('href')!)
      setOpen(false)
    }
  }
  return <form ref={form} className={mobile ? 'mobile-header-search container public-search-control' : 'site-search public-search-control'} role="search"
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    onSubmit={event => { event.preventDefault(); setOpen(false); router.push(searchHref(query)) }}>
    {mobile ? <Search size={18} aria-hidden="true"/> : <button className="public-search-submit" type="submit" aria-label={submitLabel}><Search size={19}/></button>}
    <input ref={input} type="search" role="combobox" aria-autocomplete="list" aria-expanded={show} aria-controls={show ? id : undefined}
      aria-activedescendant={show && active >= 0 && active < count ? `${id}-${active}` : undefined} autoComplete="off" maxLength={120} enterKeyHint="search"
      value={query} placeholder={placeholder} aria-label={placeholder} onFocus={() => setOpen(true)}
      onChange={event => { onQueryChange(event.target.value); setActive(-1); setOpen(true) }} onKeyDown={onKeyDown}/>
    {mobile && <button type="submit" aria-label={submitLabel}><ArrowRight size={18}/></button>}
    {show && <LiveSearchSuggestions query={query} id={id} active={active} onCountChange={setCount} onClose={() => { setOpen(false); setActive(-1) }}/>}
  </form>
}

function LiveSearchSuggestions({ onCountChange, ...props }: { query: string; id: string; active: number; onCountChange(count: number): void; onClose(): void }) {
  const state = usePublicSearch(props.query)
  const count = Math.min(state.results.length, 8)
  useEffect(() => { onCountChange(count) }, [count, onCountChange])
  return <SearchSuggestions {...props} {...state}/>
}

export function SearchSuggestions({ query, id, active, results, loading, failed, retry, onClose }: {
  query: string; id: string; active: number; results: SearchResult[]; loading: boolean; failed: readonly unknown[]; retry(): void; onClose(): void
}) {
  const { locale } = useLocale()
  const options = results.slice(0, 8)
  return <div className="public-search-dropdown">
    {loading && <p className="public-search-status" role="status">{tx(locale, { en: 'Searching…', es: 'Buscando…', it: 'Ricerca…' })}</p>}
    {failed.length > 0 && <div className="public-search-status" role="alert"><p>{tx(locale, { en: 'Some results could not be loaded.', es: 'No se pudieron cargar algunos resultados.', it: 'Impossibile caricare alcuni risultati.' })}</p><button type="button" onClick={retry}>{tx(locale, { en: 'Retry', es: 'Reintentar', it: 'Riprova' })}</button></div>}
    {!loading && !failed.length && !options.length && <p className="public-search-status" role="status">{tx(locale, { en: 'No matching pages. Try another keyword.', es: 'No hay páginas coincidentes. Prueba otra palabra.', it: 'Nessuna pagina trovata. Prova un’altra parola.' })}</p>}
    <div id={id} role="listbox" aria-label={tx(locale, { en: 'Search suggestions', es: 'Sugerencias de búsqueda', it: 'Suggerimenti di ricerca' })} className="public-search-options">
      {options.map((item, index) => <Link id={`${id}-${index}`} key={`${item.type}:${item.slug}`} role="option" aria-selected={active === index} href={item.href} tabIndex={-1} onClick={onClose} className="public-search-option">
        {item.image && <img src={item.image} alt="" width={48} height={48} loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden' }}/>}
        <span><small>{tx(locale, SEARCH_TYPE_LABELS[item.type])}</small><strong>{item.title}</strong><span>{item.copy}</span></span><ArrowRight size={16} aria-hidden="true"/>
      </Link>)}
    </div>
    <Link href={searchHref(query)} onClick={onClose} className="public-search-all">{tx(locale, { en: 'View all results', es: 'Ver todos los resultados', it: 'Vedi tutti i risultati' })}<ArrowRight size={16}/></Link>
  </div>
}
