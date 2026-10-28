'use client'
import Link from 'next/link'
import './navigation-menu.css'
import { ChevronDown, ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { navigationActive, navigationLabel, visibleNavigation, type PublicNavigation, type ResolvedNavigationItem } from '@/lib/navigation'
export function NavigationMenu({ navigation, locale, pathname, mobile = false, idPrefix = 'cms-nav', onNavigate, preview = false, actions = false }: { navigation: PublicNavigation; locale: string; pathname: string; mobile?: boolean; idPrefix?: string; onNavigate?: () => void; preview?: boolean; actions?: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => { setOpen(null) }, [pathname, navigation.revision])
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => { if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(null) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(null); container.current?.querySelector<HTMLButtonElement>(`button[aria-controls="${idPrefix}-${open}"]`)?.focus() } }
    document.addEventListener('click', close); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', escape) }
  }, [open, idPrefix])
  const rows = visibleNavigation(navigation.items, mobile ? 'mobile' : 'desktop').filter(item => mobile || Boolean(item.placement === 'action') === actions)
  const anchor = (item: ResolvedNavigationItem, child = false) => <Link key={item.id} href={item.href!} target={!preview && item.newTab ? '_blank' : undefined} rel={item.newTab ? 'noopener noreferrer' : undefined} className={mobile ? undefined : `${navigationActive(item, pathname) ? 'active' : ''}${item.placement === 'action' ? ' make-trip-link' : ''}`} aria-current={item.href?.split(/[?#]/)[0] === pathname ? 'page' : undefined} role={!mobile && child ? 'menuitem' : undefined} onClick={event => { if (preview) event.preventDefault(); setOpen(null); onNavigate?.() }}>{navigationLabel(item, locale, navigation.primaryLocale)}{mobile && <ArrowRight size={16} aria-hidden="true"/>}</Link>
  return <div ref={container} className="cms-navigation-items">{rows.map(item => item.type === 'link' ? (mobile ? <section key={item.id}>{anchor(item)}</section> : anchor(item)) : mobile ? <section key={item.id}><h2>{navigationLabel(item, locale, navigation.primaryLocale)}</h2>{item.children.map(child => anchor(child))}</section> : <div className="nav-dropdown" key={item.id} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null) }} onMouseLeave={() => setOpen(null)}>
    <button type="button" className={navigationActive(item, pathname) ? 'active' : ''} aria-expanded={open === item.id} aria-controls={`${idPrefix}-${item.id}`} aria-haspopup="menu" onClick={() => setOpen(open === item.id ? null : item.id)} onKeyDown={event => { if (event.key === 'Escape') { setOpen(null); event.currentTarget.focus() }; if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(item.id); requestAnimationFrame(() => document.getElementById(`${idPrefix}-${item.id}`)?.querySelector<HTMLElement>('a')?.focus()) } }}>{navigationLabel(item, locale, navigation.primaryLocale)} <ChevronDown size={14}/></button>
    {open === item.id && <div className={item.id === 'company' ? 'tour-menu company-menu' : 'tour-menu'} id={`${idPrefix}-${item.id}`} role="menu" onKeyDown={event => { const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('a')); const index = links.indexOf(document.activeElement as HTMLAnchorElement); if (event.key === 'Escape') { setOpen(null); event.currentTarget.parentElement?.querySelector('button')?.focus() }; if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length; links[next]?.focus() } }}>{item.children.map(child => anchor(child, true))}</div>}
  </div>)}</div>
}
