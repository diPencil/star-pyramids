import { parseVehicleCapacity } from './car-request'
import { parseMoneyToCents, parseRoundTripMultiplier, passengerAmount, computeRoundTripCents, validatePassengerTier, type CarPricingMode, type RoundTripMode } from './car-pricing'

export type PricingConfiguration = { id: string; routeId: string; carSlug: string; currency: string; pricingMode: CarPricingMode }
export type PricingTier = { id: string; routeId: string; carSlug: string; currency: string; pricingMode: CarPricingMode; minPassengers: number; maxPassengers: number; oneWayCents: number; roundTripMode: RoundTripMode; roundTripCents: number | null; roundTripMultiplierBp: number; isActive: boolean }
export type TierDraft = { minPassengers: string; maxPassengers: string; oneWay: string; roundTripMode: RoundTripMode; roundTrip: string; roundTripMultiplier: string; isActive: boolean }
export type TierIssue = 'capacity' | 'range' | 'overlap' | 'money' | 'manual' | 'multiplier' | 'limit'

export function tierDraftIssue(draft: TierDraft, seats: string, siblings: PricingTier[], mode: CarPricingMode, exceptId?: string): TierIssue | null {
  const capacity = parseVehicleCapacity(seats)
  if (capacity === null) return 'capacity'
  const min = Number(draft.minPassengers), max = Number(draft.maxPassengers)
  if (!/^\d+$/.test(draft.minPassengers) || !/^\d+$/.test(draft.maxPassengers)) return 'range'
  try { validatePassengerTier(min, max, capacity) } catch { return 'range' }
  if (siblings.some(row => row.id !== exceptId && row.minPassengers <= max && row.maxPassengers >= min)) return 'overlap'
  const amount = parseMoneyToCents(draft.oneWay)
  if (amount === null || amount < 1) return 'money'
  const manual = parseMoneyToCents(draft.roundTrip)
  if (draft.roundTripMode === 'MANUAL' && (manual === null || manual < 1)) return 'manual'
  const multiplier = parseRoundTripMultiplier(draft.roundTripMultiplier)
  if (draft.roundTripMode === 'AUTOMATIC' && multiplier === null) return 'multiplier'
  try {
    const outbound = passengerAmount(amount, max, mode)
    const result = computeRoundTripCents({ mode: draft.roundTripMode, oneWayCents: outbound, manualRoundTripCents: manual === null ? null : passengerAmount(manual, max, mode), multiplierBp: multiplier ?? 200, reverseLegCents: null })
    if ('fail' in result) return 'manual'
    passengerAmount(result.cents, 1, 'FIXED_TOTAL')
  } catch { return 'limit' }
  return null
}

export function tierPayload(draft: TierDraft) {
  return { minPassengers: Number(draft.minPassengers), maxPassengers: Number(draft.maxPassengers), oneWay: draft.oneWay, roundTripMode: draft.roundTripMode, isActive: draft.isActive, ...(draft.roundTripMode === 'MANUAL' ? { roundTrip: draft.roundTrip } : { roundTripMultiplier: draft.roundTripMultiplier }) }
}
