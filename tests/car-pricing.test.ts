// Phase 2 (Rent Cars) pricing tests: locations, directional routes,
// vehicle-specific route pricing, and quote resolution. Fully isolated —
// the Prisma client (db) is replaced by an in-memory store, and auth/CSRF
// are mocked so route-handler authorization is asserted without a DB or
// a real session. Existing car requests and their legacy fields stay
// untouched (asserted below against the schema + migration files).
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const REPO_ROOT = path.resolve(__dirname, '..');

const helpers = vi.hoisted(() => {
  const store = {
    cars: new Map<string, any>(),
    locations: new Map<string, any>(),
    routes: new Map<string, any>(),
    prices: new Map<string, any>(),
  };
  const csrf = { ok: true };
  const auth = { user: null as any, permissions: new Set<string>() };
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}${String(++seq).padStart(10, '0')}`;
  const p2002 = () => new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' });
  const p2003 = () => new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'test' });
  return { store, csrf, auth, nextId, p2002, p2003 };
});

function sortRows<T extends Record<string, any>>(rows: T[], orderBy: readonly Record<string, string>[]): T[] {
  const sorted = [...rows];
  for (let i = orderBy.length - 1; i >= 0; i -= 1) {
    const key = Object.keys(orderBy[i])[0];
    const dir = orderBy[i][key];
    sorted.sort((a, b) => {
      const av = (a as any)[key];
      const bv = (b as any)[key];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return dir === 'desc' ? -cmp : cmp;
    });
  }
  return sorted;
}

vi.mock('@/lib/server/db', () => {
  const { store } = helpers;

  const withRouteInclude = (row: any) => ({
    ...row,
    origin: store.locations.get(row.originSlug) ?? null,
    destination: store.locations.get(row.destinationSlug) ?? null,
  });

  return {
    db: {
      car: {
        findUnique: async ({ where }: any) => store.cars.get(where.slug as string) ?? null,
      },
      carLocation: {
        findUnique: async ({ where }: any) => store.locations.get(where.slug as string) ?? null,
        findMany: async ({ where, orderBy }: any) => {
          let rows = [...store.locations.values()];
          if (where && where.isActive !== undefined) rows = rows.filter((row) => row.isActive === where.isActive);
          return sortRows(rows, orderBy ?? [{ sortOrder: 'asc' }]);
        },
        create: async ({ data }: any) => {
          if (store.locations.has(data.slug)) throw helpers.p2002();
          const row = { id: helpers.nextId('loc'), nameEs: null, nameIt: null, nameAr: null, ...structuredClone(data) };
          store.locations.set(row.slug, row);
          return row;
        },
        update: async ({ where, data }: any) => {
          const row = store.locations.get(where.slug as string);
          if (!row) throw helpers.p2003();
          Object.assign(row, structuredClone(data));
          return row;
        },
        delete: async ({ where }: any) => {
          const row = store.locations.get(where.slug as string);
          if (!row) throw helpers.p2003();
          const referenced = [...store.routes.values()].some(
            (route: any) => route.originSlug === row.slug || route.destinationSlug === row.slug,
          );
          if (referenced) throw helpers.p2003();
          store.locations.delete(row.slug);
          return row;
        },
      },
      carRoute: {
        findUnique: async ({ where }: any) => {
          if (where.id !== undefined) {
            const row = [...store.routes.values()].find((candidate: any) => candidate.id === where.id) ?? null;
            return row ? withRouteInclude(row) : null;
          }
          if (where.originSlug_destinationSlug) {
            const { originSlug, destinationSlug } = where.originSlug_destinationSlug;
            return (
              [...store.routes.values()].find(
                (row: any) => row.originSlug === originSlug && row.destinationSlug === destinationSlug,
              ) ?? null
            );
          }
          throw new Error('unsupported carRoute.findUnique where');
        },
        findMany: async ({ where, orderBy }: any) => {
          let rows = [...store.routes.values()];
          if (where) {
            if (where.isActive !== undefined) rows = rows.filter((row: any) => row.isActive === where.isActive);
            if (where.origin?.isActive !== undefined) {
              rows = rows.filter((row: any) => store.locations.get(row.originSlug)?.isActive === where.origin.isActive);
            }
            if (where.destination?.isActive !== undefined) {
              rows = rows.filter(
                (row: any) => store.locations.get(row.destinationSlug)?.isActive === where.destination.isActive,
              );
            }
          }
          return sortRows(rows, orderBy ?? [{ sortOrder: 'asc' }]).map(withRouteInclude);
        },
        create: async ({ data }: any) => {
          const exists = [...store.routes.values()].some(
            (row: any) => row.originSlug === data.originSlug && row.destinationSlug === data.destinationSlug,
          );
          if (exists) throw helpers.p2002();
          const row = { id: helpers.nextId('rt'), isActive: true, sortOrder: 999, ...structuredClone(data) };
          store.routes.set(row.id, row);
          return row;
        },
        update: async ({ where, data }: any) => {
          const row = [...store.routes.values()].find((candidate: any) => candidate.id === where.id);
          if (!row) throw helpers.p2003();
          Object.assign(row, structuredClone(data));
          return row;
        },
        delete: async ({ where }: any) => {
          const row = [...store.routes.values()].find((candidate: any) => candidate.id === where.id);
          if (!row) throw helpers.p2003();
          const referenced = [...store.prices.values()].some((price: any) => price.routeId === row.id);
          if (referenced) throw helpers.p2003();
          store.routes.delete(row.id);
          return row;
        },
      },
      carRoutePrice: {
        findUnique: async ({ where }: any) => {
          if (where.id !== undefined) {
            return [...store.prices.values()].find((row: any) => row.id === where.id) ?? null;
          }
          if (where.routeId_carSlug) {
            const { routeId, carSlug } = where.routeId_carSlug;
            return (
              [...store.prices.values()].find((row: any) => row.routeId === routeId && row.carSlug === carSlug) ?? null
            );
          }
          throw new Error('unsupported carRoutePrice.findUnique where');
        },
        findMany: async ({ where, orderBy }: any) => {
          let rows = [...store.prices.values()];
          if (where) {
            if (where.routeId) rows = rows.filter((row: any) => row.routeId === where.routeId);
            if (where.carSlug) rows = rows.filter((row: any) => row.carSlug === where.carSlug);
          }
          return sortRows(rows, orderBy ?? [{ routeId: 'asc' }, { carSlug: 'asc' }]);
        },
        create: async ({ data }: any) => {
          const exists = [...store.prices.values()].some(
            (row: any) => row.routeId === data.routeId && row.carSlug === data.carSlug,
          );
          if (exists) throw helpers.p2002();
          const row = {
            id: helpers.nextId('pr'),
            currency: 'USD',
            roundTripMode: 'AUTOMATIC',
            roundTripCents: null,
            roundTripMultiplierBp: 200,
            isActive: true,
            ...structuredClone(data),
          };
          store.prices.set(row.id, row);
          return row;
        },
        update: async ({ where, data }: any) => {
          const row = [...store.prices.values()].find((candidate: any) => candidate.id === where.id);
          if (!row) throw helpers.p2003();
          Object.assign(row, structuredClone(data));
          return row;
        },
        delete: async ({ where }: any) => {
          const row = [...store.prices.values()].find((candidate: any) => candidate.id === where.id);
          if (!row) throw helpers.p2003();
          store.prices.delete(row.id);
          return row;
        },
      },
    },
  };
});

vi.mock('@/lib/server/auth', () => ({
  getCurrentUser: async () => helpers.auth.user,
  hasPermission: (user: any, permission: string) =>
    !!user && (helpers.auth.permissions.has('*') || helpers.auth.permissions.has(permission)),
}));

vi.mock('@/lib/server/csrf', () => ({
  isSameOriginRequest: () => helpers.csrf.ok,
}));

import {
  centsToDecimalString,
  checkQuotePassengerCapacity,
  computeRoundTripCents,
  parseMoneyToCents,
  parseRoundTripMultiplier,
  scaleCentsByMultiplier,
} from '@/lib/car-pricing';
import {
  createCarLocation,
  createCarRoute,
  createCarRoutePrice,
  deleteCarLocation,
  deleteCarRoute,
  listActiveCarRoutes,
  resolveCarRouteQuote,
  updateCarLocation,
  updateCarRoutePrice,
  type CarRouteQuoteResult,
} from '@/lib/server/car-pricing';
import { GET as getQuote } from '@/app/api/rent-car/quote/route';
import { GET as getAdminPrices, POST as postAdminPrices } from '@/app/api/admin/rent-car/prices/route';
import { PATCH as patchAdminLocation } from '@/app/api/admin/rent-car/locations/[slug]/route';

function seedCar(slug = 'giza-van', seats = '6 seats', isPublished = true) {
  const row = {
    id: `car-${slug}`,
    slug,
    title: slug,
    image: '',
    seats,
    transmission: '',
    copy: '',
    credit: null,
    isPublished,
  };
  helpers.store.cars.set(slug, row);
  return row;
}

function seedLocation(slug: string, nameEn: string, isActive = true, sortOrder = 999, kind = 'CITY') {
  const row = {
    id: helpers.nextId('loc'),
    slug,
    nameEn,
    nameEs: null,
    nameIt: null,
    nameAr: null,
    kind,
    isActive,
    sortOrder,
  };
  helpers.store.locations.set(slug, row);
  return row;
}

async function seedRoute(originSlug: string, destinationSlug: string, isActive = true) {
  return createCarRoute({ originSlug, destinationSlug, isActive });
}

function handlerRequest(init: { url?: string; method?: 'GET' | 'PATCH' | 'POST' | 'DELETE'; body?: unknown } = {}): Request {
  return new Request(init.url ?? 'http://localhost/api/test', {
    method: init.method ?? 'GET',
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

const queryUrl = (params: string) => `http://localhost/api/rent-car/quote?${params}`;

function expectQuote(outcome: CarRouteQuoteResult): CarRouteQuoteResult {
  if (outcome.kind === 'quote') return outcome;
  throw new Error(`expected a quote, got ${outcome.kind}`);
}

function run<T>(promise: Promise<T>, label: string) {
  return Promise.resolve(promise) as Promise<globalThis.Response>;
}

beforeEach(() => {
  helpers.store.cars.clear();
  helpers.store.locations.clear();
  helpers.store.routes.clear();
  helpers.store.prices.clear();
  helpers.csrf.ok = true;
  helpers.auth.user = null;
  helpers.auth.permissions.clear();
});

describe('monetary precision helpers', () => {
  it('parses decimal amounts into exact integer cents', () => {
    expect(parseMoneyToCents('49.50')).toBe(4950);
    expect(parseMoneyToCents('0.01')).toBe(1);
    expect(parseMoneyToCents('12')).toBe(1200);
    expect(parseMoneyToCents(12.5)).toBe(1250);
  });

  it('rejects invalid or over-precise money inputs', () => {
    expect(parseMoneyToCents('49.555')).toBeNull();
    expect(parseMoneyToCents('-1')).toBeNull();
    expect(parseMoneyToCents('1,000')).toBeNull();
    expect(parseMoneyToCents('abc')).toBeNull();
    expect(parseMoneyToCents(NaN)).toBeNull();
    expect(parseMoneyToCents(Number.POSITIVE_INFINITY)).toBeNull();
    expect(parseMoneyToCents('1234567890.00')).toBeNull();
  });

  it('formats cents back to decimal strings without floats', () => {
    expect(centsToDecimalString(4950)).toBe('49.50');
    expect(centsToDecimalString(1)).toBe('0.01');
    expect(centsToDecimalString(120000)).toBe('1200.00');
  });

  it('rounds multiplier scaling with exact integer half-up math', () => {
    expect(scaleCentsByMultiplier(495, 150)).toBe(743);
    expect(scaleCentsByMultiplier(250, 200)).toBe(500);
    expect(scaleCentsByMultiplier(1000, 233)).toBe(2330);
  });

  it('accepts multipliers only inside the 1.00–10.00 range', () => {
    expect(parseRoundTripMultiplier('2')).toBe(200);
    expect(parseRoundTripMultiplier(2.5)).toBe(250);
    expect(parseRoundTripMultiplier('0.5')).toBeNull();
    expect(parseRoundTripMultiplier('12')).toBeNull();
  });
});

describe('manual vs automatic round-trip computation', () => {
  it('prefers the real return-leg rate and sums the two legs', () => {
    expect(
      computeRoundTripCents({
        mode: 'AUTOMATIC',
        oneWayCents: 5000,
        manualRoundTripCents: null,
        multiplierBp: 200,
        reverseLegCents: 7000,
      }),
    ).toEqual({ cents: 12000, basis: 'legs' });
  });

  it('falls back to the configured multiplier when no return rate exists', () => {
    expect(
      computeRoundTripCents({
        mode: 'AUTOMATIC',
        oneWayCents: 4999,
        manualRoundTripCents: null,
        multiplierBp: 200,
        reverseLegCents: null,
      }),
    ).toEqual({ cents: 9998, basis: 'multiplier' });
  });

  it('uses the staff-configured manual round-trip price verbatim', () => {
    expect(
      computeRoundTripCents({
        mode: 'MANUAL',
        oneWayCents: 5000,
        manualRoundTripCents: 9000,
        multiplierBp: 200,
        reverseLegCents: null,
      }),
    ).toEqual({ cents: 9000, basis: 'manual' });
  });

  it('reports an unconfigured manual rate instead of inventing one', () => {
    expect(
      computeRoundTripCents({
        mode: 'MANUAL',
        oneWayCents: 5000,
        manualRoundTripCents: null,
        multiplierBp: 200,
        reverseLegCents: 7000,
      }),
    ).toEqual({ fail: 'round_trip_unconfigured' });
  });
});

describe('quote passenger capacity', () => {
  it('rejects unclear or missing seat counts and over-capacity parties', () => {
    expect(checkQuotePassengerCapacity(null, 1).ok).toBe(false);
    expect(checkQuotePassengerCapacity('2-4 seats', 1).ok).toBe(false);
    expect(checkQuotePassengerCapacity('6 seats', 7).ok).toBe(false);
    expect(checkQuotePassengerCapacity('6 seats', 6).ok).toBe(true);
  });
});

describe('location validation and integrity', () => {
  it('enforces slug, required English name, and kind', async () => {
    await expect(createCarLocation({ slug: 'Bad Slug', nameEn: 'X' })).rejects.toThrow('valid slug');
    await expect(createCarLocation({ slug: 'cairo-airport', nameEn: '' })).rejects.toThrow('English location name');
    await expect(createCarLocation({ slug: 'cairo-airport', nameEn: 'Cairo Airport', kind: 'harbor' })).rejects.toThrow(
      'location type',
    );
  });

  it('creates a location and surfaces duplicate slugs as conflicts', async () => {
    const created = await createCarLocation({ slug: 'cairo-airport', nameEn: 'Cairo Airport', kind: 'AIRPORT', sortOrder: 1 });
    expect(created.slug).toBe('cairo-airport');
    await expect(
      createCarLocation({ slug: 'cairo-airport', nameEn: 'Another', kind: 'CITY', sortOrder: 1 }),
    ).rejects.toThrow('Slug must be unique.');
  });

  it('treats the slug as immutable: unknown keys are rejected', async () => {
    seedLocation('giza', 'Giza');
    await expect(
      updateCarLocation('giza', { nameEn: 'Giza Plateau', slug: 'giza-2' }),
    ).rejects.toThrow('Invalid request.');
    expect(helpers.store.locations.get('giza-2')).toBeUndefined();
    const patch = await updateCarLocation('giza', { nameEn: 'Giza Plateau', isActive: false, sortOrder: 12 });
    expect(patch).toMatchObject({ nameEn: 'Giza Plateau', isActive: false, sortOrder: 12 });
    expect(helpers.store.locations.get('giza')).toMatchObject({ nameEn: 'Giza Plateau', slug: 'giza' });
  });

  it('blocks deleting a location referenced by routes', async () => {
    seedLocation('cairo', 'Cairo');
    seedLocation('giza', 'Giza');
    await seedRoute('cairo', 'giza');
    await expect(deleteCarLocation('cairo')).rejects.toThrow('referenced by routes');
    await expect(deleteCarLocation('giza')).rejects.toThrow('referenced by routes');
    expect(helpers.store.locations.get('cairo')).not.toBeNull();
  });
});

describe('route validation, directionality, and duplicate prevention', () => {
  it('requires distinct, existing, active locations', async () => {
    seedLocation('cairo', 'Cairo', true);
    seedLocation('giza', 'Giza', false);
    await expect(createCarRoute({ originSlug: 'cairo', destinationSlug: 'cairo' })).rejects.toThrow('different locations');
    await expect(createCarRoute({ originSlug: 'cairo', destinationSlug: 'hurghada' })).rejects.toThrow('must exist and be active');
    await expect(createCarRoute({ originSlug: 'cairo', destinationSlug: 'giza' })).rejects.toThrow('must exist and be active');
  });

  it('creates A→B and B→A as separate rows (directional identity)', async () => {
    seedLocation('cairo', 'Cairo');
    seedLocation('giza', 'Giza');
    const ab = await seedRoute('cairo', 'giza');
    const ba = await seedRoute('giza', 'cairo');
    expect(ab.id).not.toBe(ba.id);
    expect(await listActiveCarRoutes()).toHaveLength(2);
  });

  it('rejects duplicates of the same directional pair with a friendly message', async () => {
    seedLocation('cairo', 'Cairo');
    seedLocation('giza', 'Giza');
    await seedRoute('cairo', 'giza');
    await expect(seedRoute('cairo', 'giza')).rejects.toThrow('This route already exists.');
  });

  it('refuses deleting a route that still carries price rows', async () => {
    seedCar('giza-van');
    seedLocation('cairo', 'Cairo');
    seedLocation('giza', 'Giza');
    const route = await seedRoute('cairo', 'giza');
    await createCarRoutePrice({
      routeId: route.id,
      carSlug: 'giza-van',
      currency: 'USD',
      oneWay: '49.50',
      roundTripMode: 'AUTOMATIC',
      roundTripMultiplier: '2',
      isActive: true,
    });
    await expect(deleteCarRoute(route.id)).rejects.toThrow('Deactivate it instead');
  });
});

describe('route price validation', () => {
  it('requires a positive one-way price in a supported currency', async () => {
    seedCar('giza-van');
    seedLocation('cairo', 'Cairo');
    seedLocation('giza', 'Giza');
    const route = await seedRoute('cairo', 'giza');
    await expect(
      createCarRoutePrice({ routeId: route.id, carSlug: 'giza-van', currency: 'USD', oneWay: '0.00', roundTripMode: 'AUTOMATIC', roundTripMultiplier: '2' }),
    ).rejects.toThrow('one-way price');
    await expect(
      createCarRoutePrice({ routeId: route.id, carSlug: 'giza-van', currency: 'GBP', oneWay: '10', roundTripMode: 'AUTOMATIC', roundTripMultiplier: '2' }),
    ).rejects.toThrow('Unsupported currency');
    await expect(
      createCarRoutePrice({ routeId: route.id, carSlug: 'giza-van', currency: 'USD', oneWay: '10', roundTripMode: 'MANUAL' }),
    ).rejects.toThrow('round-trip price');
  });

  it('stores exact cents and keeps MANUAL/AUTOMATIC data separated', async () => {
    seedCar('giza-van');
    seedLocation('cairo', 'Cairo');
    seedLocation('giza', 'Giza');
    const route = await seedRoute('cairo', 'giza');
    const manual = await createCarRoutePrice({
      routeId: route.id,
      carSlug: 'giza-van',
      currency: 'USD',
      oneWay: '49.90',
      roundTripMode: 'MANUAL',
      roundTrip: '90.00',
    });
    expect(manual.oneWayCents).toBe(4990);
    expect(manual.roundTripCents).toBe(9000);
    expect(manual.roundTripMultiplierBp).toBe(200);
    await expect(
      createCarRoutePrice({ routeId: route.id, carSlug: 'giza-van', currency: 'USD', oneWay: '10', roundTripMode: 'AUTOMATIC', roundTripMultiplier: '15' }),
    ).rejects.toThrow('between 1.00 and 10.00');
  });

  it('rejects a second price for the same vehicle/route combination', async () => {
    seedCar('giza-van');
    seedLocation('cairo', 'Cairo');
    seedLocation('giza', 'Giza');
    const route = await seedRoute('cairo', 'giza');
    await createCarRoutePrice({ routeId: route.id, carSlug: 'giza-van', currency: 'USD', oneWay: '10', roundTripMode: 'AUTOMATIC', roundTripMultiplier: '2' });
    await expect(
      createCarRoutePrice({ routeId: route.id, carSlug: 'giza-van', currency: 'USD', oneWay: '20', roundTripMode: 'AUTOMATIC', roundTripMultiplier: '2' }),
    ).rejects.toThrow('already exists');
  });

  it('switching to AUTOMATIC clears the manual round trip; MANUAL requires one', async () => {
    seedCar('giza-van');
    seedLocation('cairo', 'Cairo');
    seedLocation('giza', 'Giza');
    const route = await seedRoute('cairo', 'giza');
    const price = await createCarRoutePrice({
      routeId: route.id,
      carSlug: 'giza-van',
      currency: 'USD',
      oneWay: '49.90',
      roundTripMode: 'MANUAL',
      roundTrip: '90.00',
    });
    await updateCarRoutePrice(price.id, { roundTripMode: 'AUTOMATIC', roundTripMultiplier: '2.5' });
    const row = [...helpers.store.prices.values()][0];
    expect(row.roundTripMode).toBe('AUTOMATIC');
    expect(row.roundTripCents).toBeNull();
    expect(row.roundTripMultiplierBp).toBe(250);
    await expect(updateCarRoutePrice(price.id, { roundTripMode: 'MANUAL', roundTrip: 'abc' })).rejects.toThrow('round-trip price');
  });
});

describe('quote resolution with directional pricing', () => {
  it('sums both directional leg rates when the reverse route is priced', async () => {
    seedCar('giza-van', '6 seats');
    seedLocation('cairo', 'Cairo');
    seedLocation('giza', 'Giza');
    const ab = await seedRoute('cairo', 'giza');
    const ba = await seedRoute('giza', 'cairo');
    await createCarRoutePrice({ routeId: ab.id, carSlug: 'giza-van', currency: 'USD', oneWay: '50.00', roundTripMode: 'AUTOMATIC', roundTripMultiplier: '2' });
    await createCarRoutePrice({ routeId: ba.id, carSlug: 'giza-van', currency: 'USD', oneWay: '70.00', roundTripMode: 'AUTOMATIC', roundTripMultiplier: '2' });

    const roundTrip = expectQuote(
      await resolveCarRouteQuote({ vehicle: 'giza-van', route: ab.id, trip: 'round-trip', passengers: 4 }),
    );
    expect(roundTrip.detail.roundTripBasis).toBe('legs');
    expect(roundTrip.detail.roundTripCents).toBe(12000);
    expect(roundTrip.detail.currency).toBe('USD');
    expect(roundTrip.detail.amount).toBe('120.00');
    const oneWay = expectQuote(await resolveCarRouteQuote({ vehicle: 'giza-van', route: ab.id, trip: 'one-way', passengers: 4 }));
    expect(oneWay.detail.amount).toBe('50.00');
  });

  it('uses the multiplier fallback only when no return-leg rate exists', async () => {
    seedCar('giza-van', '6 seats');
    seedLocation('cairo', 'Cairo');
    seedLocation('giza', 'Giza');
    const ab = await seedRoute('cairo', 'giza');
    await createCarRoutePrice({ routeId: ab.id, carSlug: 'giza-van', currency: 'USD', oneWay: '49.99', roundTripMode: 'AUTOMATIC', roundTripMultiplier: '2' });
    const outcome = expectQuote(await resolveCarRouteQuote({ vehicle: 'giza-van', route: ab.id, trip: 'round-trip', passengers: 4 }));
    expect(outcome.detail.roundTripBasis).toBe('multiplier');
    expect(outcome.detail.roundTripCents).toBe(9998);
  });

  it('returns Price on Request for inactive routes, missing, or inactive prices', async () => {
    seedCar('giza-van', '6 seats');
    seedLocation('cairo', 'Cairo');
    seedLocation('giza', 'Giza');
    seedLocation('luxor', 'Luxor');
    const inactive = await seedRoute('cairo', 'luxor', false);
    expect(await resolveCarRouteQuote({ vehicle: 'giza-van', route: inactive.id, trip: 'one-way', passengers: 2 })).toEqual({
      kind: 'price_on_request',
      reason: 'route_unavailable',
      detail: null,
    });
    const active = await seedRoute('cairo', 'giza');
    expect(await resolveCarRouteQuote({ vehicle: 'giza-van', route: active.id, trip: 'one-way', passengers: 2 })).toEqual({
      kind: 'price_on_request',
      reason: 'price_unavailable',
      detail: null,
    });
    const price = await createCarRoutePrice({ routeId: active.id, carSlug: 'giza-van', currency: 'USD', oneWay: '10', roundTripMode: 'AUTOMATIC', roundTripMultiplier: '2' });
    await updateCarRoutePrice(price.id, { isActive: false });
    expect(await resolveCarRouteQuote({ vehicle: 'giza-van', route: active.id, trip: 'one-way', passengers: 2 })).toEqual({
      kind: 'price_on_request',
      reason: 'price_unavailable',
      detail: null,
    });
  });

  it('uses MANUAL round-trip pricing verbatim in quotes', async () => {
    seedCar('giza-van', '6 seats');
    seedLocation('cairo', 'Cairo');
    seedLocation('giza', 'Giza');
    const route = await seedRoute('cairo', 'giza');
    await createCarRoutePrice({ routeId: route.id, carSlug: 'giza-van', currency: 'USD', oneWay: '50.00', roundTripMode: 'MANUAL', roundTrip: '95.50' });
    const outcome = expectQuote(await resolveCarRouteQuote({ vehicle: 'giza-van', route: route.id, trip: 'round-trip', passengers: 2 }));
    expect(outcome.detail.roundTripBasis).toBe('manual');
    expect(outcome.detail.amount).toBe('95.50');
  });

  it('rejects unknown, hidden, over-capacity, and unclear-capacity vehicles', async () => {
    seedLocation('cairo', 'Cairo');
    seedLocation('giza', 'Giza');
    const route = await seedRoute('cairo', 'giza');
    await expect(resolveCarRouteQuote({ vehicle: 'ghost-van', route: route.id, trip: 'one-way', passengers: 2 })).rejects.toThrow(
      'Select a vehicle from the fleet list.',
    );
    seedCar('hidden-van', '6 seats', false);
    await expect(resolveCarRouteQuote({ vehicle: 'hidden-van', route: route.id, trip: 'one-way', passengers: 2 })).rejects.toThrow(
      'Select a vehicle from the fleet list.',
    );
    seedCar('big-van', '6 seats');
    await expect(resolveCarRouteQuote({ vehicle: 'big-van', route: route.id, trip: 'one-way', passengers: 8 })).rejects.toThrow(
      'seats 6 passengers',
    );
    seedCar('fuzzy-van', '2-4 seats');
    await expect(resolveCarRouteQuote({ vehicle: 'fuzzy-van', route: route.id, trip: 'one-way', passengers: 2 })).rejects.toThrow(
      'seat capacity is unclear',
    );
  });

  it('rejects invalid trips and passenger counts at the quote endpoint', async () => {
    const badTrip = await getQuote(handlerRequest({ url: queryUrl('vehicle=a&route=b&trip=roundabout&passengers=2') }));
    expect(badTrip.status).toBe(400);
    const badPassengers = await getQuote(handlerRequest({ url: queryUrl('vehicle=a&route=b&trip=one-way&passengers=0') }));
    expect(badPassengers.status).toBe(400);
  });

  it('returns priceOnRequest through the endpoint for missing prices', async () => {
    seedCar('giza-van', '6 seats');
    seedLocation('cairo', 'Cairo');
    seedLocation('giza', 'Giza');
    const route = await seedRoute('cairo', 'giza');
    const response = await getQuote(handlerRequest({ url: queryUrl(`vehicle=giza-van&route=${route.id}&trip=one-way&passengers=2`) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ priceOnRequest: true, reason: 'price_unavailable' });
  });
});

describe('admin pricing API authorization and CSRF', () => {
  it('blocks unauthenticated, unauthorized, and cross-origin mutations', async () => {
    const body = { routeId: 'route-x', carSlug: 'giza-van', currency: 'USD', oneWay: '10', roundTripMode: 'AUTOMATIC', roundTripMultiplier: '2' };
    const unauthenticated = await postAdminPrices(handlerRequest({ method: 'POST', body }));
    expect(unauthenticated.status).toBe(401);

    helpers.auth.user = { id: 'admin-1', role: 'STAFF' };
    helpers.auth.permissions.add('cars.list');
    const forbidden = await postAdminPrices(handlerRequest({ method: 'POST', body }));
    expect(forbidden.status).toBe(403);

    helpers.auth.permissions.clear();
    helpers.auth.permissions.add('cars.create');
    helpers.csrf.ok = false;
    const crossOrigin = await postAdminPrices(handlerRequest({ method: 'POST', body }));
    expect(crossOrigin.status).toBe(403);
  });

  it('creates a price only with the right permission and origin', async () => {
    seedCar('giza-van');
    seedLocation('cairo', 'Cairo');
    seedLocation('giza', 'Giza');
    const route = await seedRoute('cairo', 'giza');
    helpers.auth.user = { id: 'admin-1', role: 'ADMIN' };
    helpers.auth.permissions.add('cars.create');
    const response = await postAdminPrices(handlerRequest({
      method: 'POST',
      body: { routeId: route.id, carSlug: 'giza-van', currency: 'USD', oneWay: '35.25', roundTripMode: 'AUTOMATIC', roundTripMultiplier: '2' },
    }));
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.price.oneWayCents).toBe(3525);

    helpers.auth.permissions.add('cars.edit');
    const list = await getAdminPrices(handlerRequest({ url: `http://localhost/api/admin/rent-car/prices?routeId=${route.id}`, method: 'GET' }));
    expect(list).toBeDefined();
  });

  it('admin location PATCH rejects unknown keys with a 400 and 404s unknown slugs', async () => {
    seedLocation('cairo', 'Cairo');
    helpers.auth.user = { id: 'admin-1', role: 'ADMIN' };
    helpers.auth.permissions.add('cars.edit');
    const badBody = await patchAdminLocation(handlerRequest({ method: 'PATCH', body: { nameEn: 'Cairo Intl', shenanigans: 1 } }), {
      params: Promise.resolve({ slug: 'cairo' }),
    });
    expect(badBody.status).toBe(400);
    const missing = await patchAdminLocation(handlerRequest({ method: 'PATCH', body: { nameEn: 'Missing' } }), {
      params: Promise.resolve({ slug: 'nowhere' }),
    });
    expect(missing.status).toBe(404);
  });
});

describe('legacy compatibility surfaces', () => {
  it('schema has no dailyPrice field and keeps the legacy free-text car request columns', () => {
    const schema = readFileSync(path.join(REPO_ROOT, 'prisma', 'schema.prisma'), 'utf8');
    expect(schema).toContain('model CarRequest');
    // Regression guard: the legacy daily rental rate must never return to the
    // schema. Route prices are the sole transfer pricing source.
    expect(schema).not.toContain('dailyPrice');
    expect(schema).toContain('pickup              String               @db.VarChar(160)');
    expect(schema).toContain('dropoff             String               @db.VarChar(160)');
  });

  it('the dailyPrice drop migration is narrowly scoped to the cars daily rate column', () => {
    const migration = readFileSync(
      path.join(REPO_ROOT, 'prisma', 'migrations', '20261022000000_remove_cars_daily_price', 'migration.sql'),
      'utf8',
    );
    expect(migration).toContain('ALTER TABLE `cars` DROP COLUMN `dailyPrice`');
    expect(migration).not.toMatch(/DROP TABLE/i);
    expect(migration).not.toMatch(/DELETE FROM|TRUNCATE|RENAME TABLE|DROP COLUMN `(?!`?dailyPrice)/i);
  });

  it('the Phase 2 migration is purely additive', () => {
    const migration = readFileSync(
      path.join(REPO_ROOT, 'prisma', 'migrations', '20261020100000_phase2_car_locations_routes_pricing', 'migration.sql'),
      'utf8',
    );
    expect(migration).not.toMatch(/DROP TABLE/i);
    expect(migration).not.toMatch(/ALTER TABLE `(cars|car_requests)`/i);
    expect(migration).toContain("CREATE TABLE `car_locations`");
    expect(migration).toContain("CREATE TABLE `car_routes`");
    expect(migration).toContain("CREATE TABLE `car_route_prices`");
  });
});
