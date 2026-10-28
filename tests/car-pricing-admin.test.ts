import { describe, expect, it } from 'vitest'
import { tierDraftIssue, tierPayload, type PricingTier, type TierDraft } from '@/lib/car-pricing-admin'
import { readFileSync } from 'node:fs'

const draft: TierDraft = { minPassengers: '1', maxPassengers: '3', oneWay: '10.25', roundTripMode: 'AUTOMATIC', roundTrip: '', roundTripMultiplier: '1.50', isActive: true }
const tier: PricingTier = { id: 'tier-id', routeId: 'route-id', carSlug: 'van', currency: 'USD', pricingMode: 'FIXED_TOTAL', minPassengers: 1, maxPassengers: 3, oneWayCents: 1025, roundTripMode: 'AUTOMATIC', roundTripCents: null, roundTripMultiplierBp: 150, isActive: false }

describe('pricing management form contracts', () => {
  it('accepts both pricing modes with exact decimal string payloads', () => {
    for (const mode of ['FIXED_TOTAL', 'PER_PERSON'] as const) expect(tierDraftIssue(draft, '6 seats', [], mode)).toBeNull()
    expect(tierPayload(draft)).toEqual({ minPassengers: 1, maxPassengers: 3, oneWay: '10.25', roundTripMode: 'AUTOMATIC', roundTripMultiplier: '1.50', isActive: true })
  })
  it('rejects invalid, ambiguous, fractional, empty or over-capacity ranges', () => {
    for (const [minPassengers, maxPassengers] of [['', '3'], ['1.5', '3'], ['0', '3'], ['4', '3'], ['1', '7'], ['1e0', '3']]) expect(tierDraftIssue({ ...draft, minPassengers, maxPassengers }, '6 seats', [], 'FIXED_TOTAL')).toBe('range')
    expect(tierDraftIssue(draft, 'up to 6', [], 'FIXED_TOTAL')).toBe('capacity')
  })
  it('checks disabled overlaps, permits adjacent ranges and excludes the edited tier', () => {
    expect(tierDraftIssue(draft, '6 seats', [tier], 'FIXED_TOTAL')).toBe('overlap')
    expect(tierDraftIssue(draft, '6 seats', [tier], 'FIXED_TOTAL', tier.id)).toBeNull()
    expect(tierDraftIssue({ ...draft, minPassengers: '4', maxPassengers: '6' }, '6 seats', [tier], 'FIXED_TOTAL')).toBeNull()
  })
  it('validates money and manual/automatic settings without submitting stale mode fields', () => {
    expect(tierDraftIssue({ ...draft, oneWay: '1.234' }, '6 seats', [], 'FIXED_TOTAL')).toBe('money')
    expect(tierDraftIssue({ ...draft, roundTripMultiplier: '10.01' }, '6 seats', [], 'FIXED_TOTAL')).toBe('multiplier')
    const manual = { ...draft, roundTripMode: 'MANUAL' as const, roundTrip: '18.50' }
    expect(tierDraftIssue(manual, '6 seats', [], 'PER_PERSON')).toBeNull()
    expect(tierPayload(manual)).toMatchObject({ roundTrip: '18.50' })
    expect(tierPayload(manual)).not.toHaveProperty('roundTripMultiplier')
    expect(tierPayload(draft)).not.toHaveProperty('roundTrip')
  })
  it('preserves Locations and Routes and connects tier controls to real APIs', () => {
    const page = readFileSync('app/admin/rent-cars/page.tsx', 'utf8')
    expect(page).toContain("tab === 'locations'")
    expect(page).toContain("tab === 'routes'")
    expect(page).toContain('<CarPricingManager')
    const component = readFileSync('components/admin/car-pricing-manager.tsx', 'utf8')
    expect(component).toContain("'/api/admin/rent-car/configurations', 'PATCH'")
    expect(component).toContain('tierPayload(draft)')
    expect(component).toContain('isActive: !row.isActive')
    expect(component).toContain("'cars.delete'")
    expect(component).toContain("'cars.create'")
    expect(component).toContain("'cars.edit'")
  })
})
