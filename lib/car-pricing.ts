import { CarInputError } from '@/lib/rent-car-errors';
// Rent Cars pricing (Phase 2): pure helpers shared by server services and
// future UI. All financial amounts travel as integer minor units (cents) —
// floating-point arithmetic is never used for money. The multiplier is also
// integer-scaled (basis points, hundredths: 200 = ×2.00) so every quote is
// computed with exact integer math and deterministic half-up rounding.
import { parseVehicleCapacity, type CarTripType } from '@/lib/car-request';

export const DEFAULT_ROUND_TRIP_MULTIPLIER_BP = 200;
export const MIN_ROUND_TRIP_MULTIPLIER_BP = 100;
export const MAX_ROUND_TRIP_MULTIPLIER_BP = 1000;
export const MAX_MONEY_CENTS = 2_000_000_000;
export const MAX_PASSENGERS = 50;

import { SUPPORTED_CURRENCIES, normalizeCurrency, type SupportedCurrency } from './currency';
export { SUPPORTED_CURRENCIES, normalizeCurrency, type SupportedCurrency } from './currency';

export type RoundTripMode = 'AUTOMATIC' | 'MANUAL';
export type CarPricingMode = 'FIXED_TOTAL' | 'PER_PERSON';
export type CarPricingMetadata = {
  version: 1;
  passengers: number;
  outbound: { tierId: string; minPassengers: number; maxPassengers: number; pricingMode: CarPricingMode; unitCents: number; currency: string };
  returnPricing: { basis: 'manual' | 'legs' | 'multiplier'; tierId?: string; pricingMode?: CarPricingMode; unitCents?: number; currency?: string; multiplierBp?: number } | null;
};

export function readCarPricingMetadata(input: unknown): CarPricingMetadata | undefined {
  try {
    const value = typeof input === 'string' ? JSON.parse(input) : input;
    if (!value || typeof value !== 'object' || value.version !== 1 || !Number.isSafeInteger(value.passengers) || value.passengers < 1 || value.passengers > MAX_PASSENGERS) return undefined;
    const outbound = value.outbound;
    const validUnit = (unit: unknown) => typeof unit === 'number' && Number.isSafeInteger(unit) && unit > 0 && unit <= MAX_MONEY_CENTS;
    const validMode = (mode: unknown) => mode === 'FIXED_TOTAL' || mode === 'PER_PERSON';
    if (!outbound || typeof outbound.tierId !== 'string' || !validMode(outbound.pricingMode) || !validUnit(outbound.unitCents) || !SUPPORTED_CURRENCIES.includes(outbound.currency)) return undefined;
    if (!Number.isSafeInteger(outbound.minPassengers) || !Number.isSafeInteger(outbound.maxPassengers) || outbound.minPassengers < 1 || outbound.maxPassengers > 100 || value.passengers < outbound.minPassengers || value.passengers > outbound.maxPassengers) return undefined;
    const back = value.returnPricing;
    if (back !== null) {
      if (!back || !['manual', 'legs', 'multiplier'].includes(back.basis)) return undefined;
      if (back.basis === 'multiplier') {
        if (!Number.isSafeInteger(back.multiplierBp) || back.multiplierBp < 100 || back.multiplierBp > 1000) return undefined;
      } else if (!validMode(back.pricingMode) || !validUnit(back.unitCents) || back.currency !== outbound.currency || typeof back.tierId !== 'string') return undefined;
      if (back.basis === 'manual' && back.pricingMode !== outbound.pricingMode) return undefined;
    }
    return value as CarPricingMetadata;
  } catch { return undefined; }
}

export function validatePassengerTier(min: unknown, max: unknown, capacity: number | null): void {
  if (capacity === null) throw new CarInputError('Vehicle capacity is unclear.');
  if (typeof min !== 'number' || typeof max !== 'number' || !Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 1 || min > max || max > capacity) {
    throw new CarInputError('Passenger tier must be a valid whole-number range within vehicle capacity.');
  }
}

export function passengerAmount(unitCents: number, passengers: number, mode: CarPricingMode): number {
  const total = mode === 'PER_PERSON' ? unitCents * passengers : unitCents;
  if (!Number.isSafeInteger(total) || total < 1 || total > MAX_MONEY_CENTS) throw new CarInputError('Quoted amount exceeds the supported limit.');
  return total;
}

export type MoneyInput = string | number;

const DECIMAL_PATTERN = /^\d{1,9}(?:\.\d{1,2})?$/;

/**
 * Parse a decimal amount ("49.50", "12", 49.5) into integer cents with exact
 * string-based math. Rejects negative values, more than two fraction digits,
 * more than nine integer digits, and any non-finite numeric input. Returns
 * null for anything unparseable — callers decide how to surface it.
 */
export function parseMoneyToCents(value: unknown): number | null {
  let text: string;
  if (typeof value === 'string') {
    text = value.trim();
  } else if (typeof value === 'number') {
    // Grouping separators in scientific notation are avoided by capping
    // magnitudes: anything beyond the integer cap is rejected below anyway.
    if (!Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER || value < 0) return null;
    text = value.toPrecision(15).replace(/\.?0+$/, '') || '0';
  } else {
    return null;
  }
  if (!DECIMAL_PATTERN.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2));
  if (cents > MAX_MONEY_CENTS) return null;
  return cents;
}

/** Exact cents → "12.50" decimal string (two fraction digits always). */
export function centsToDecimalString(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Parse a configurable round-trip multiplier ("2", "2.0", "2.00", 2) into
 * basis points. Accepted range ×1.00–×10.00; sensible default stays 200.
 */
export function parseRoundTripMultiplier(value: unknown): number | null {
  const cents = parseMoneyToCents(value);
  if (cents === null || cents < MIN_ROUND_TRIP_MULTIPLIER_BP || cents > MAX_ROUND_TRIP_MULTIPLIER_BP) return null;
  return cents;
}

/**
 * Scale cents by a multiplier (hundredths) with exact integer half-up
 * rounding: 495 × 1.50 → 742.50 → 743. Never reaches floating point.
 */
export function scaleCentsByMultiplier(cents: number, multiplierBp: number): number {
  return Math.floor((cents * multiplierBp + 50) / 100);
}

/** Legacy normalizing predicate; use isCurrency for canonical type narrowing. */
export function isSupportedCurrency(value: unknown): boolean {
  return normalizeCurrency(value) !== null;
}

export type QuoteRoundTripBasis = 'manual' | 'legs' | 'multiplier';

export interface CarRouteQuote {
  oneWayCents: number;
  roundTripMode: RoundTripMode;
  roundTripCents: number;
  roundTripBasis: QuoteRoundTripBasis;
  currency: string;
}

export interface CarQuoteResolved {
  kind: 'quote';
  quote: CarRouteQuote;
}

export interface CarQuotePriceOnRequest {
  kind: 'price_on_request';
  reason: 'route_unavailable' | 'price_unavailable' | 'round_trip_unconfigured';
}

export type CarQuoteOutcome = CarQuoteResolved | CarQuotePriceOnRequest;

/**
 * Pure round-trip computation. The multiplier applies ONLY when no real
 * return-leg rate exists ("Price on Request" would hide the fallback).
 */
export function computeRoundTripCents(input: {
  mode: RoundTripMode;
  oneWayCents: number;
  manualRoundTripCents: number | null;
  multiplierBp: number;
  reverseLegCents: number | null;
}): { cents: number; basis: QuoteRoundTripBasis } | { fail: 'round_trip_unconfigured' } {
  if (input.mode === 'MANUAL') {
    return input.manualRoundTripCents !== null && input.manualRoundTripCents > 0
      ? { cents: input.manualRoundTripCents, basis: 'manual' }
      : { fail: 'round_trip_unconfigured' };
  }
  if (input.reverseLegCents !== null && input.reverseLegCents > 0) {
    return { cents: input.oneWayCents + input.reverseLegCents, basis: 'legs' };
  }
  return {
    cents: scaleCentsByMultiplier(input.oneWayCents, input.multiplierBp),
    basis: 'multiplier',
  };
}

export interface QuotePassengerCheck {
  ok: boolean;
  message?: string;
}

/** Quote-time gate mirroring the confirm gate: never guess a capacity. */
export function checkQuotePassengerCapacity(
  seats: string | null,
  passengers: number,
): QuotePassengerCheck {
  if (seats === null) return { ok: false, message: 'Select a vehicle from the fleet list.' };
  const capacity = parseVehicleCapacity(seats);
  if (capacity === null) {
    return {
      ok: false,
      message: `This vehicle's seat capacity is unclear (${seats || 'empty'}).`,
    };
  }
  if (passengers > capacity) {
    return { ok: false, message: `This vehicle seats ${capacity} passengers, but ${passengers} were requested.` };
  }
  return { ok: true };
}

export type QuoteTripType = 'one-way' | 'round-trip';

export const TRIP_TYPE_QUERY: Record<QuoteTripType, CarTripType> = {
  'one-way': 'One Way',
  'round-trip': 'Round Trip',
};

export function tripTypeFromQuery(value: string): QuoteTripType | null {
  return value === 'one-way' || value === 'round-trip' ? value : null;
}
