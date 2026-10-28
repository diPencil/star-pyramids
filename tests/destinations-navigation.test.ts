import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/destinations', useSearchParams: () => new URLSearchParams() }))
import { getEgyptTourNavLinks, getNavConfig, NavLinks } from '@/components/site'
import { copy, extra } from '@/lib/site-copy'

const categoryPaths = ['/trips', '/egypt-tours/one-day-tours', '/egypt-tours/multi-days-tours', '/egypt-tours/nile-cruises', '/egypt-tours/shore-excursions']
describe('Destinations navigation in the existing Egypt Tours group', () => {
  it.each([['en', 'Destinations'], ['es', 'Destinos'], ['it', 'Destinazioni']] as const)('adds exactly one localized desktop link in %s and preserves mobile order', (locale, label) => {
    const links = getEgyptTourNavLinks(copy[locale], extra[locale], locale)
    expect(links.desktop.map(([, href]) => href)).toEqual([...categoryPaths, '/destinations'])
    expect(links.mobile.map(([, href]) => href)).toEqual([...categoryPaths, '/special-offers', '/destinations'])
    for (const group of [links.desktop, links.mobile]) {
      expect(group.filter(([, href]) => href === '/destinations')).toEqual([[label, '/destinations']])
      expect(new Set(group.map(([, href]) => href)).size).toBe(group.length)
    }
    for (const idPrefix of ['primary-nav', 'compact-nav']) {
      const html = renderToStaticMarkup(createElement(NavLinks, {
        nav: getNavConfig(copy[locale], extra[locale], locale), activeKey: 'tours', pathname: '/destinations', idPrefix,
        onToursOpen: () => {}, toursOpen: true, onCompanyOpen: () => {}, companyOpen: false,
        tourLinks: links.desktop, t: copy[locale], ex: extra[locale],
      }))
      expect(html.match(/href="\/destinations"/g)).toHaveLength(1)
      const destinationLink = html.match(/<a\b[^>]*href="\/destinations"[^>]*>[^<]*<\/a>/)?.[0]
      expect(destinationLink).toContain('role="menuitem"')
      expect(destinationLink).toContain(`>${label}</a>`)
      expect(html).toContain(`aria-controls="${idPrefix}-tours-menu"`)
      expect(html).toContain(`id="${idPrefix}-tours-menu" role="menu"`)
      expect(html.indexOf('href="/egypt-tours/shore-excursions"')).toBeLessThan(html.indexOf('href="/destinations"'))
    }
  })
  it('retains the dropdown close handler and Escape behavior', () => {
    const toggle = vi.fn()
    const t = copy.en, ex = extra.en
    const tree = NavLinks({ nav: getNavConfig(t, ex, 'en'), activeKey: 'tours', pathname: '/destinations', idPrefix: 'primary-nav', onToursOpen: toggle, toursOpen: true, onCompanyOpen: () => {}, companyOpen: false, tourLinks: getEgyptTourNavLinks(t, ex, 'en').desktop, t, ex })
    const dropdown = tree.props.children[1]
    dropdown.props.children[0].props.onKeyDown({ key: 'Escape' })
    expect(toggle).toHaveBeenCalledTimes(1)
    const destination = dropdown.props.children[1].props.children.find((link: { props: { href: string } }) => link.props.href === '/destinations')
    destination.props.onClick()
    expect(toggle).toHaveBeenCalledTimes(2)
  })
})
