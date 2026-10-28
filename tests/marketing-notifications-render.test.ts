import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { NotificationDropdown } from '@/components/site'
import type { useMarketingNotifications } from '@/lib/marketing-notifications-client'
import type { MarketingNotification } from '@/lib/marketing-notifications'
vi.mock('@/lib/server/db', () => { throw Error('No database access in rendering tests') })
const item: MarketingNotification = { id: 'marketing:offer:' + 'a'.repeat(32), type: 'offer_available', title: 'Real saved offer', message: 'Saved offer description', href: '/special-offers/saved-offer', createdAt: '2026-10-28T09:00:00Z', expiresAt: null, readAt: null, localized: { es: { title: 'Oferta guardada', message: 'Descripción guardada' }, it: { title: 'Offerta salvata', message: 'Descrizione salvata' } } }
const state = (extra: Partial<ReturnType<typeof useMarketingNotifications>> = {}): ReturnType<typeof useMarketingNotifications> => ({ owner: null, items: [item], unreadCount: 1, loading: false, error: '', busy: false, refresh: vi.fn(), markRead: vi.fn(async () => {}), markAllRead: vi.fn(async () => {}), ...extra })
describe('real public offer notification presentation', () => {
  it.each([['en', 'Real saved offer'], ['es', 'Oferta guardada'], ['it', 'Offerta salvata']] as const)('renders actual %s offer and its own target', (locale, title) => {
    const html = renderToStaticMarkup(createElement(NotificationDropdown, { locale, state: state(), onClose: vi.fn() }))
    expect(html).toContain(title)
    expect(html).toContain('href="/special-offers/saved-offer"')
    expect(html).not.toContain('STAR2026')
    expect(html).not.toContain('15m ago')
    expect(html).toContain('2026')
    expect(html).toContain('notif-unread-dot')
  })
  it('shows true loading, empty and error states without resurrecting demo offers', () => {
    const render = (extra: Partial<ReturnType<typeof useMarketingNotifications>>) => renderToStaticMarkup(createElement(NotificationDropdown, { locale: 'en', state: state({ items: [], unreadCount: 0, ...extra }), onClose: vi.fn() }))
    expect(render({ loading: true })).toContain('Loading offers')
    expect(render({})).toContain('No current offers')
    expect(render({ error: 'Unavailable' })).toContain('role="alert"')
    expect(render({ error: 'Unavailable' })).toContain('Try again')
    expect(render({})).not.toContain('Save extra 5%')
    expect(render({})).not.toContain('notif-unread-dot')
  })
  it('reflects server read status and retains accessible real mark-read controls', () => {
    const html = renderToStaticMarkup(createElement(NotificationDropdown, { locale: 'en', state: state({ items: [{ ...item, readAt: item.createdAt }], unreadCount: 0 }), onClose: vi.fn() }))
    expect(html).not.toContain('notif-unread-dot')
    expect(html).not.toContain('Mark all read')
    expect(html).toContain('View all special offers')
  })
})
