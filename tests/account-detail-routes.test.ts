import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// Only presentation is stubbed: execute the real server route and validators.
// No APIs, sessions or databases are contacted.
vi.mock('@/components/account/account-portal', () => ({
  BookingDetailPage: ({ reference }: { reference: string }) => createElement('article', null, `Booking detail: ${reference}`),
  CarRequestDetailPage: ({ reference }: { reference: string }) => createElement('article', null, `Car request detail: ${reference}`),
  PaymentDetailPage: ({ reference }: { reference: string }) => createElement('article', null, `Payment detail: ${reference}`),
  CustomerAccountPage: () => createElement('article', null, 'Incorrect profile/list fallback'),
}))
vi.mock('@/components/account/account-custom-trip', () => ({
  CustomerTripRequestDetailPage: ({ reference }: { reference: string }) => createElement('article', null, `Trip request detail: ${reference}`),
}))
vi.mock('@/components/account/account-event-requests', () => ({
  CustomerEventRequestDetailPage: ({ reference }: { reference: string }) => createElement('article', null, `Event request detail: ${reference}`),
}))

import BookingRoute from '@/app/account/bookings/detail/page'
import CarRoute from '@/app/account/car-requests/detail/page'
import PaymentRoute from '@/app/account/payments/detail/page'
import TripRoute from '@/app/account/trip-requests/detail/page'
import EventRoute from '@/app/account/event-requests/detail/page'

const cases = [
  { name: 'booking', route: BookingRoute, reference: 'SP-BK-ABC123', label: 'Booking detail' },
  { name: 'car request', route: CarRoute, reference: 'SP-CR-ABC123', label: 'Car request detail' },
  { name: 'payment', route: PaymentRoute, reference: 'SP-PAY-ABC123', label: 'Payment detail' },
  { name: 'trip request', route: TripRoute, reference: 'SP-TR-ABC123', label: 'Trip request detail' },
  { name: 'event request', route: EventRoute, reference: 'SP-ER-ABC123', label: 'Event request detail' },
]

describe.each(cases)('$name detail route', ({ route, reference, label }) => {
  it('renders its intended detail component with the URL reference', async () => {
    const element = await route({ searchParams: Promise.resolve({ ref: reference }) })
    const html = renderToStaticMarkup(element)
    expect(html).toContain(`${label}: ${reference}`)
    expect(html).not.toContain('fallback')
  })

  it('normalizes accepted surrounding whitespace before passing the reference', async () => {
    const element = await route({ searchParams: Promise.resolve({ ref: ` ${reference} ` }) })
    expect(element.props.reference).toBe(reference)
  })

  it.each([undefined, '', 'invalid', '../profile', 'SP-PAY-ABC123/private', ['SP-BK-ABC123'], ['a', 'b'], 'x'.repeat(2000)])('rejects missing, unsafe or ambiguous references: %j', async ref => {
    await expect(route({ searchParams: Promise.resolve({ ref }) })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
  })
})

it('passes only the explicit booking print flag to the existing detail component', async () => {
  const reference = 'SP-BK-ABC123'
  for (const print of [undefined, '1', '0', ['1']]) {
    const result = await BookingRoute({ searchParams: Promise.resolve({ ref: reference, print }) }) as ReactElement<{ autoPrint: boolean }>
    expect(result.props.autoPrint).toBe(print === '1')
  }
})

it.each(['SP-ABCDEFGHIJ', 'SP-BK-ABC123'])('preserves the booking validator’s supported reference shapes: %s', async ref => {
  const result = await BookingRoute({ searchParams: Promise.resolve({ ref }) })
  expect(result.props.reference).toBe(ref)
})
