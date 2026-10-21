// Rent Cars pricing (Phase 2): pure helpers shared by server services and
// future UI. All financial amounts travel as integer minor units (cents) —
// floating-point arithmetic is never used for money. The multiplier is also
// integer-scaled (basis points, hundredths: 200 = ×2.00) so every quote is
// computed with exact integer math and deterministic half-up rounding.
import 'server-only';

import { parseVehicleCapacity, type CarTripType } from '@/lib/car-request';

export const DEFAULT_ROUND_TRIP_MULTIPLIER_BP = 200;
export const MIN_ROUND_TRIP_MULTIPLIER_BP = 100;
export const MAX_ROUND_TRIP_MULTIPLIER_BP = 1000;
export const MAX_MONEY_CENTS = 2_000_000_000;
export const MAX_PASSENGERS = 50;

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'EGP'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export type RoundTripMode = 'AUTOMATIC' | 'MANUAL';

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

export function isSupportedCurrency(value: unknown): value is SupportedCurrency {
  return (
    typeof value === 'string' &&
    (SUPPORTED_CURRENCIES as readonly string[]).includes(value.toUpperCase())
  );
}

/** Normalize a currency input; uppercase + allowlist, null when unsupported. */
export function normalizeCurrency(value: unknown): SupportedCurrency | null {
  return isSupportedCurrency(value) ? (value.toUpperCase() as SupportedCurrency) : null;
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
