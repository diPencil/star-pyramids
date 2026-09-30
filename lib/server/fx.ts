// Authoritative FX service. Rates are DECIMAL(18,8) per currency pair;
// the backend converts, the browser never supplies rates. No external
// FX integration in Phase 1A — rates are manual/system-seeded only.
import 'server-only';

import { Prisma } from '@prisma/client';

import { db } from './db';
import { isValidCurrencyCode } from '../core/validation';

export interface FxRateView {
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  source: string;
  effectiveAt: Date;
}

export async function getActiveRate(
  baseCurrency: string,
  quoteCurrency: string,
): Promise<FxRateView | null> {
  const base = baseCurrency.trim().toUpperCase();
  const quote = quoteCurrency.trim().toUpperCase();
  if (!isValidCurrencyCode(base) || !isValidCurrencyCode(quote)) return null;
  if (base === quote) {
    return {
      baseCurrency: base,
      quoteCurrency: quote,
      rate: '1',
      source: 'system',
      effectiveAt: new Date(0),
    };
  }
  const row = await db.fxRate.findUnique({
    where: { baseCurrency_quoteCurrency: { baseCurrency: base, quoteCurrency: quote } },
    select: {
      baseCurrency: true,
      quoteCurrency: true,
      rate: true,
      source: true,
      effectiveAt: true,
      isActive: true,
    },
  });
  if (!row || !row.isActive) return null;
  return {
    baseCurrency: row.baseCurrency,
    quoteCurrency: row.quoteCurrency,
    rate: row.rate.toString(),
    source: row.source,
    effectiveAt: row.effectiveAt,
  };
}

/** Convert a DECIMAL-safe decimal string amount. Caller owns rounding. */
export function convertAmount(
  amount: string,
  rate: string,
): string | null {
  let result: number;
  try {
    const a = new Prisma.Decimal(amount);
    const r = new Prisma.Decimal(rate);
    result = a.mul(r).toNumber();
  } catch {
    return null;
  }
  if (!Number.isFinite(result)) return null;
  return String(result);
}

export async function setRate(input: {
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  source?: string;
}): Promise<FxRateView> {
  const base = input.baseCurrency.trim().toUpperCase();
  const quote = input.quoteCurrency.trim().toUpperCase();
  if (!isValidCurrencyCode(base) || !isValidCurrencyCode(quote)) {
    throw new Error('Invalid currency code.');
  }
  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(input.rate);
  } catch {
    throw new Error('Invalid rate.');
  }
  if (decimal.lte(0)) throw new Error('Rate must be positive.');
  const row = await db.fxRate.upsert({
    where: { baseCurrency_quoteCurrency: { baseCurrency: base, quoteCurrency: quote } },
    update: {
      rate: decimal,
      isActive: true,
      source: input.source ?? 'manual',
      effectiveAt: new Date(),
    },
    create: {
      baseCurrency: base,
      quoteCurrency: quote,
      rate: decimal,
      source: input.source ?? 'manual',
    },
    select: {
      baseCurrency: true,
      quoteCurrency: true,
      rate: true,
      source: true,
      effectiveAt: true,
    },
  });
  return {
    baseCurrency: row.baseCurrency,
    quoteCurrency: row.quoteCurrency,
    rate: row.rate.toString(),
    source: row.source,
    effectiveAt: row.effectiveAt,
  };
}
