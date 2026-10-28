import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TierEditor } from '@/components/admin/car-pricing-manager'
import type { PricingTier } from '@/lib/car-pricing-admin'

const route = { id: 'route-id', isActive: true, origin: { nameEn: 'Cairo' }, destination: { nameEn: 'Giza' } }
const vehicle = { slug: 'van', title: 'Van', seats: '6 seats' }
const row: PricingTier = { id: 'tier-id', routeId: route.id, carSlug: vehicle.slug, currency: 'USD', pricingMode: 'PER_PERSON', minPassengers: 3, maxPassengers: 6, oneWayCents: 1025, roundTripMode: 'MANUAL', roundTripCents: 1850, roundTripMultiplierBp: 200, isActive: true }
const props = { routes: [route], vehicles: [vehicle], tiers: [row], initialRoute: route.id, initialVehicle: vehicle.slug, onClose: () => {}, onSaved: () => {} }

describe('pricing editor rendered states', () => {
  it('renders per-person semantics and an integer-calculated example for an existing tier', () => {
    const html = renderToStaticMarkup(createElement(TierEditor, { ...props, row, configurations: [{ id: 'config', routeId: route.id, carSlug: vehicle.slug, currency: 'USD', pricingMode: 'PER_PERSON' }] }))
    expect(html).toContain('One way per passenger')
    expect(html).toContain('Full round trip per passenger')
    expect(html).toContain('3 × $10.25 = $30.75')
    expect(html).toContain('Change them from Configuration')
    expect(html).toContain('Save tier')
  })
  it('renders fixed-total labels without implying per-passenger multiplication', () => {
    const html = renderToStaticMarkup(createElement(TierEditor, { ...props, row: { ...row, pricingMode: 'FIXED_TOTAL' }, configurations: [{ id: 'config', routeId: route.id, carSlug: vehicle.slug, currency: 'USD', pricingMode: 'FIXED_TOTAL' }] }))
    expect(html).toContain('One-way vehicle total')
    expect(html).toContain('3 passengers = $10.25')
    expect(html).not.toContain('One way per passenger')
  })
  it('keeps a new incomplete tier unsavable and presents capacity/range validation', () => {
    const html = renderToStaticMarkup(createElement(TierEditor, { ...props, tiers: [], configurations: [] }))
    expect(html).toContain('within vehicle capacity')
    expect(html).toContain('role="alert"')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save tier<\/button>/)
  })
})
