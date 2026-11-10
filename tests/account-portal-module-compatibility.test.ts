import * as portal from '@/components/account/account-portal'
import { CustomerConfirmDialog } from '@/components/account/customer-confirm-dialog'
import { LocaleProvider } from '@/components/locale'
import { describe, expect, it } from 'vitest'

describe('account portal public compatibility and owner boundaries', () => {
  it('retains the complete original runtime export surface', () => { expect(Object.keys(portal).sort()).toEqual(["AccountShell","BookingDetailPage","CarRequestDetailPage","CustomerAccountPage","CustomerConfirmDialog","CustomerPagination","EmptyState","GuestBookingPage","PaymentDetailPage","useCustomerBookings","useImpersonated","useVisibleBookings","useVisibleInquiries"]) })
  it('preserves the existing confirmation dialog identity', () => { expect(portal.CustomerConfirmDialog).toBe(CustomerConfirmDialog) })
  it('forwards components/account/shared/account-hooks.tsx without wrappers', async () => {
    const feature = await import('@/components/account/shared/account-hooks')
    for (const name of ["useImpersonated","useVisibleInquiries"]) expect((portal as unknown as Record<string, unknown>)[name]).toBe((feature as unknown as Record<string, unknown>)[name])
  })
  it('forwards components/account/shared/account-ui.tsx without wrappers', async () => {
    const feature = await import('@/components/account/shared/account-ui')
    for (const name of ["EmptyState","CustomerPagination"]) expect((portal as unknown as Record<string, unknown>)[name]).toBe((feature as unknown as Record<string, unknown>)[name])
  })
  it('forwards components/account/bookings/booking-sections.tsx without wrappers', async () => {
    const feature = await import('@/components/account/bookings/booking-sections')
    for (const name of ["useCustomerBookings","useVisibleBookings"]) expect((portal as unknown as Record<string, unknown>)[name]).toBe((feature as unknown as Record<string, unknown>)[name])
  })
  it('preserves bookings shell/provider and feature identity', async () => {
    const feature = await import('@/components/account/bookings/booking-sections')
    const page = portal.CustomerAccountPage({ section: 'bookings' })
    expect(page.type).toBe(LocaleProvider)
    expect(page.props.children.type).toBe(portal.AccountShell)
    expect(page.props.children.props.children.type).toBe((feature as unknown as Record<string, unknown>)['BookingsSection'])
  })
  it('preserves car-requests shell/provider and feature identity', async () => {
    const feature = await import('@/components/account/cars/car-request-sections')
    const page = portal.CustomerAccountPage({ section: 'car-requests' })
    expect(page.type).toBe(LocaleProvider)
    expect(page.props.children.type).toBe(portal.AccountShell)
    expect(page.props.children.props.children.type).toBe((feature as unknown as Record<string, unknown>)['CarRequestsSection'])
  })
  it('preserves favorites shell/provider and feature identity', async () => {
    const feature = await import('@/components/account/favorites/favorites-section')
    const page = portal.CustomerAccountPage({ section: 'favorites' })
    expect(page.type).toBe(LocaleProvider)
    expect(page.props.children.type).toBe(portal.AccountShell)
    expect(page.props.children.props.children.type).toBe((feature as unknown as Record<string, unknown>)['FavoritesSection'])
  })
  it('preserves overview shell/provider and feature identity', async () => {
    const feature = await import('@/components/account/overview/overview-section')
    const page = portal.CustomerAccountPage({ section: 'overview' })
    expect(page.type).toBe(LocaleProvider)
    expect(page.props.children.type).toBe(portal.AccountShell)
    expect(page.props.children.props.children.type).toBe((feature as unknown as Record<string, unknown>)['OverviewSection'])
  })
  it('preserves payments shell/provider and feature identity', async () => {
    const feature = await import('@/components/account/payments/payment-sections')
    const page = portal.CustomerAccountPage({ section: 'payments' })
    expect(page.type).toBe(LocaleProvider)
    expect(page.props.children.type).toBe(portal.AccountShell)
    expect(page.props.children.props.children.type).toBe((feature as unknown as Record<string, unknown>)['PaymentsSection'])
  })
  it('preserves messages shell/provider and feature identity', async () => {
    const feature = await import('@/components/account/support/messages-section')
    const page = portal.CustomerAccountPage({ section: 'messages' })
    expect(page.type).toBe(LocaleProvider)
    expect(page.props.children.type).toBe(portal.AccountShell)
    expect(page.props.children.props.children.type).toBe((feature as unknown as Record<string, unknown>)['MessagesSection'])
  })
  it('preserves profile shell/provider and feature identity', async () => {
    const feature = await import('@/components/account/profile/profile-settings')
    const page = portal.CustomerAccountPage({ section: 'profile' })
    expect(page.type).toBe(LocaleProvider)
    expect(page.props.children.type).toBe(portal.AccountShell)
    expect(page.props.children.props.children.type).toBe((feature as unknown as Record<string, unknown>)['PersonalProfileSection'])
  })
  it('preserves settings shell/provider and feature identity', async () => {
    const feature = await import('@/components/account/profile/profile-settings')
    const page = portal.CustomerAccountPage({ section: 'settings' })
    expect(page.type).toBe(LocaleProvider)
    expect(page.props.children.type).toBe(portal.AccountShell)
    expect(page.props.children.props.children.type).toBe((feature as unknown as Record<string, unknown>)['SettingsSection'])
  })
  it('preserves change-password shell/provider and feature identity', async () => {
    const feature = await import('@/components/account/profile/profile-settings')
    const page = portal.CustomerAccountPage({ section: 'change-password' })
    expect(page.type).toBe(LocaleProvider)
    expect(page.props.children.type).toBe(portal.AccountShell)
    expect(page.props.children.props.children.type).toBe((feature as unknown as Record<string, unknown>)['ChangePasswordSection'])
  })
})
