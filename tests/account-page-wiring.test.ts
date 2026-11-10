import { describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'
import { CustomerAccountPage, AccountShell } from '@/components/account/account-portal'
import { CustomerTripRequestsPage } from '@/components/account/account-custom-trip'
import { CustomerEventRequestsPage } from '@/components/account/account-event-requests'
import { LocaleProvider } from '@/components/locale'
import TripRequestsRoute from '@/app/account/trip-requests/page'
import EventRequestsRoute from '@/app/account/event-requests/page'
import ChangePasswordRoute from '@/app/account/change-password/page'

describe('customer request page wiring', () => {
  it.each([
    ['overview', 'OverviewSection'],
    ['bookings', 'BookingsSection'],
    ['car-requests', 'CarRequestsSection'],
    ['favorites', 'FavoritesSection'],
    ['payments', 'PaymentsSection'],
    ['messages', 'MessagesSection'],
    ['profile', 'PersonalProfileSection'],
    ['settings', 'SettingsSection'],
    ['change-password', 'ChangePasswordSection'],
  ] as const)('preserves the existing %s content', (section, content) => {
    const page = CustomerAccountPage({ section }) as ReactElement<{ children: ReactElement<{ children: ReactElement }> }>
    expect(page.type).toBe(LocaleProvider)
    expect(page.props.children.type).toBe(AccountShell)
    expect((page.props.children.props.children.type as { name: string }).name).toBe(content)
  })

  it('opens the dedicated trip requests page instead of the profile', async () => {
    const route = await TripRequestsRoute({ searchParams: Promise.resolve({}) })
    expect(route.type).toBe(CustomerTripRequestsPage)
    expect(CustomerAccountPage({ section: 'trip-requests' }).type).toBe(CustomerTripRequestsPage)
  })

  it('connects the password route to the existing change-password functionality', () => {
    const route = ChangePasswordRoute()
    expect(route.type).toBe(CustomerAccountPage)
    expect(route.props.section).toBe('change-password')
    const page = CustomerAccountPage(route.props)
    expect(page.props.children.props.children.type.name).toBe('ChangePasswordSection')
  })

  it.each([
    [{ new: '1' }, true, null],
    [{ edit: ' SP-TR-ABC123 ' }, false, 'SP-TR-ABC123'],
    [{ new: '1', edit: 'SP-TR-ABC123' }, true, 'SP-TR-ABC123'],
    [{ new: ['1', '0'] }, false, null],
    [{ new: '0' }, false, null],
  ] as const)('passes safe deep-link options to the existing page: %j', async (query, startNew, editRef) => {
    const route = await TripRequestsRoute({ searchParams: Promise.resolve({ ...query, ...('new' in query && Array.isArray(query.new) ? { new: [...query.new] } : {}) }) })
    expect(route.type).toBe(CustomerTripRequestsPage)
    expect(route.props).toEqual({ startNew, editRef })
  })

  it.each(['', '../profile', 'SP-TR-ABC123/private', ['SP-TR-ABC123'], ['a', 'b']])('rejects malformed or ambiguous edit references: %j', async edit => {
    await expect(TripRequestsRoute({ searchParams: Promise.resolve({ edit }) })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
  })

  it('opens the dedicated event requests page instead of the profile', () => {
    const route = EventRequestsRoute()
    expect(route.type).toBe(CustomerAccountPage)
    expect(CustomerAccountPage(route.props).type).toBe(CustomerEventRequestsPage)
  })

  it.each([
    ['trip-requests', CustomerTripRequestsPage, 'TripRequestsSection'],
    ['event-requests', CustomerEventRequestsPage, 'EventRequestsSection'],
  ] as const)('keeps one existing locale provider and shell for %s', (section, Page, content) => {
    const page = Page({}) as ReactElement<{ children: ReactElement<{ section: string; children: ReactElement }> }>
    expect(page.type).toBe(LocaleProvider)
    expect(page.props.children.type).toBe(AccountShell)
    expect(page.props.children.props.section).toBe(section)
    expect((page.props.children.props.children.type as { name: string }).name).toBe(content)
  })
})
