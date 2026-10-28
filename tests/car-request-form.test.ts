import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { carTripTypeForKey } from '@/lib/car-request'

const state = vi.hoisted(() => ({ loading: false, error: null as string | null }))
vi.mock('@/lib/events-cars-client', () => ({ useDbCarsStatus: () => ({ data: [{ slug: 'van', title: 'Van', seats: '6 seats', isPublished: true }], ...state }), useDbCars: () => [], useDbEvents: () => [] }))
import { CarRequestForm } from '@/components/extended-pages'

const values = { vehicleSlug: 'van', tripType: 'One Way' as const, pickup: 'Cairo', dropoff: 'Giza', pickupLocationSlug: '', dropoffLocationSlug: '', pickupTime: '', returnTime: '', pickupDate: '', returnDate: '', passengers: '3', fullName: 'Test Traveller', email: 'test@example.com', phone: '+201012345678', notes: '' }
const props = { values, errors: {}, summary: '', submitting: false, editing: false, locations: [], onChange: () => {}, onSubmit: () => {} }

describe('request form rendering without browser interaction', () => {
  it('uses labelled passenger controls and keyboard-accessible single-selection trip radios', () => {
    const html = renderToStaticMarkup(createElement(CarRequestForm, props))
    expect(html).toContain('id="car-passengers"')
    expect(html).toContain('role="radiogroup"')
    expect(html).toMatch(/role="radio" aria-checked="true" tabindex="0"/)
    expect(html).toMatch(/role="radio" aria-checked="false" tabindex="-1"/)
    expect(html).toContain('aria-label="Transfer request details"')
    expect(carTripTypeForKey('One Way', 'ArrowRight')).toBe('Round Trip')
    expect(carTripTypeForKey('Round Trip', 'ArrowLeft')).toBe('One Way')
    expect(carTripTypeForKey('Round Trip', 'Home')).toBe('One Way')
    expect(carTripTypeForKey('One Way', 'End')).toBe('Round Trip')
    expect(carTripTypeForKey('One Way', 'a')).toBeUndefined()
  })
  it('disables edits while submitting and keeps return controls conditional', () => {
    const html = renderToStaticMarkup(createElement(CarRequestForm, { ...props, submitting: true, values: { ...values, tripType: 'Round Trip' } }))
    expect(html).toMatch(/<fieldset[^>]*disabled=""/)
    expect(html).toContain('id="car-return-date"')
    expect(html).toContain('id="car-passengers-rt"')
    expect(html).toContain('Submitting')
  })
  it('does not permit submission while the real fleet is unavailable', () => {
    state.error = 'Fleet unavailable'
    try {
      const html = renderToStaticMarkup(createElement(CarRequestForm, props))
      expect(html).toMatch(/<button class="primary-btn" type="submit" disabled=""/)
    } finally { state.error = null }
  })
})
