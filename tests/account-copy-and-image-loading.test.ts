import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
it('uses project welcome copy without the obsolete Friday plan', () => {
  const source = readFileSync('app/admin/dashboard/page.tsx', 'utf8')
  expect(source).toContain('Welcome to STAR PYRAMIDS.')
  expect(source).not.toContain('Friday plan')
})
it('removes the technical customer notice without changing payment functionality', () => {
  const source = ["components/account/account-portal.tsx","components/account/shared/account-shell.tsx","components/account/shared/account-hooks.tsx","components/account/shared/account-ui.tsx","components/account/shared/account-notifications.tsx","components/account/bookings/booking-sections.tsx","components/account/cars/car-request-sections.tsx","components/account/favorites/favorites-section.tsx","components/account/overview/overview-section.tsx","components/account/payments/payment-sections.tsx","components/account/support/messages-section.tsx","components/account/profile/profile-settings.tsx"].map(path => readFileSync(path, 'utf8')).join('\n')
  expect(source).not.toContain("en: 'Account connected'")
  expect(source).not.toContain('Your identity, profile, sign-in')
})
it('does not eagerly preload every catalogue cover while keeping the homepage hero prioritized', () => {
  const source = readFileSync('components/tours/tour-card.tsx', 'utf8').split('export function CardGallery(')[1].split('export function TourCard(')[0]
  expect(source).toContain('loading="lazy"')
  expect(source).not.toContain('priority=')
  expect(source).toContain('imgs.map(')
  expect(readFileSync('components/home/homepage-hero.tsx', 'utf8')).toContain('fill priority sizes="100vw"')
})
