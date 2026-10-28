import { CarInputError } from '@/lib/rent-car-errors';
// Rent Cars pricing services (Phase 2). Server owns validation, directional
// route identity, and quote resolution. Money is integer cents end-to-end;
// no floating-point arithmetic touches financial amounts.
//
// Access model: public surfaces only ever read ACTIVE/published rows and
// resolve quotes. All catalog mutations run through staff-only API routes
// (RBAC `cars.*` + same-origin CSRF); nothing here is publicly writable.
import 'server-only';

import { Prisma, CarLocationKind as DbLocationKind, CarRoundTripMode as DbRoundTripMode } from '@prisma/client';

import { db } from './db';
import { parseVehicleCapacity } from '@/lib/car-request';
import {
  checkQuotePassengerCapacity,
  computeRoundTripCents,
  centsToDecimalString,
  normalizeCurrency,
  parseMoneyToCents,
  parseRoundTripMultiplier,
  tripTypeFromQuery,
  TRIP_TYPE_QUERY,
  DEFAULT_ROUND_TRIP_MULTIPLIER_BP,
  type QuoteTripType,
  type RoundTripMode,
  type CarPricingMode,
  type CarPricingMetadata,
  validatePassengerTier,
  passengerAmount,
} from '@/lib/car-pricing';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NAME_MAX = 120;
const SORT_MIN = 0;
const SORT_MAX = 100000;
const CENTS_MAX = 2_000_000_000;

const LOCATION_KINDS: readonly string[] = ['AIRPORT', 'HOTEL', 'CITY', 'CUSTOM'];

export type CarLocationKind = 'AIRPORT' | 'HOTEL' | 'CITY' | 'CUSTOM';

function hasControlChars(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function isPrismaUniqueOrForeignKey(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2002' || error.code === 'P2003')
  );
}

function isForeignKeyViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
}

// ---------------------------------------------------------------- locations

export interface CarLocationDraft {
  slug: string;
  nameEn: string;
  nameEs: string | null;
  nameIt: string | null;
  nameAr: string | null;
  kind: CarLocationKind;
  isActive: boolean;
  sortOrder: number;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function validSlug(value: unknown): string | null {
  const slug = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return SLUG_PATTERN.test(slug) && slug.length <= 80 ? slug : null;
}

function validSortOrder(value: unknown): number | null {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= SORT_MIN && value <= SORT_MAX
      ? value
      : null
  );
}

/**
 * Strict location validation. Unknown/controlled keys only; localized names
 * follow the project EN/ES/IT/AR conventions — EN is required.
 */
export function validateCarLocationDraft(input: unknown): CarLocationDraft {
  if (typeof input !== 'object' || input === null) throw new CarInputError('Invalid request.');
  const body = input as Record<string, unknown>;
  const allowed = new Set(['slug', 'nameEn', 'nameEs', 'nameIt', 'nameAr', 'kind', 'isActive', 'sortOrder']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new CarInputError('Invalid request.');
  }
  const slug = validSlug(body.slug);
  if (!slug) throw new CarInputError('Enter a valid slug: lowercase letters, numbers, and hyphens.');

  const nameEn = nonEmpty(body.nameEn);
  if (!nameEn || nameEn.length > NAME_MAX || hasControlChars(nameEn)) {
    throw new CarInputError('Enter the English location name (120 characters or fewer).');
  }
  const localized = (value: unknown): string | null => {
    const name = typeof value === 'string' ? value.trim() : '';
    if (name === '') return null;
    if (name.length > NAME_MAX || hasControlChars(name)) {
      throw new CarInputError('Localized location names must be 120 characters or fewer.');
    }
    return name;
  };
  const kind = body.kind === undefined || body.kind === '' ? 'CITY' : body.kind;
  if (typeof kind !== 'string' || !LOCATION_KINDS.includes(kind)) {
    throw new CarInputError('Choose a location type: airport, hotel, city, or custom.');
  }
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') throw new CarInputError('Active status must be boolean.');
  const isActive = body.isActive === undefined ? true : body.isActive;
  const sortOrder = body.sortOrder === undefined ? 999 : validSortOrder(body.sortOrder);
  if (sortOrder === null) throw new CarInputError('Sort order must be a whole number from 0 to 100000.');

  return {
    slug,
    nameEn,
    nameEs: localized(body.nameEs),
    nameIt: localized(body.nameIt),
    nameAr: localized(body.nameAr),
    kind: kind as CarLocationKind,
    isActive,
    sortOrder,
  };
}

function locationData(draft: CarLocationDraft) {
  return {
    slug: draft.slug,
    nameEn: draft.nameEn,
    nameEs: draft.nameEs,
    nameIt: draft.nameIt,
    nameAr: draft.nameAr,
    kind: draft.kind as DbLocationKind,
    isActive: draft.isActive,
    sortOrder: draft.sortOrder,
  };
}

export async function createCarLocation(input: unknown): Promise<CarLocationDraft & { id: string }> {
  const draft = validateCarLocationDraft(input);
  try {
    const row = await db.carLocation.create({ data: locationData(draft) });
    return { ...draft, id: row.id };
  } catch (error) {
    if (isPrismaUniqueOrForeignKey(error) && error.code === 'P2002') {
      throw new CarInputError('Slug must be unique.');
    }
    throw error;
  }
}

export interface CarLocationPatch {
  nameEn?: string;
  nameEs?: string | null;
  nameIt?: string | null;
  nameAr?: string | null;
  kind?: CarLocationKind;
  isActive?: boolean;
  sortOrder?: number;
}

/**
 * Update an existing location. Slugs are immutable: location slugs are FK
 * targets for routes, and renaming would rewrite every referencing route.
 */
export async function updateCarLocation(slug: string, input: unknown): Promise<CarLocationPatch | null> {
  const body = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const allowed = new Set(['nameEn', 'nameEs', 'nameIt', 'nameAr', 'kind', 'isActive', 'sortOrder']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new CarInputError('Invalid request.');
  }
  const existing = await db.carLocation.findUnique({ where: { slug } });
  if (!existing) return null;

  const patch: CarLocationPatch = {};
  if (body.nameEn !== undefined) {
    const nameEn = nonEmpty(body.nameEn);
    if (!nameEn || nameEn.length > NAME_MAX || hasControlChars(nameEn)) {
      throw new CarInputError('Enter the English location name (120 characters or fewer).');
    }
    patch.nameEn = nameEn;
  }
  const localizedKeys = ['nameEs', 'nameIt', 'nameAr'] as const;
  for (const key of localizedKeys) {
    if (body[key] === undefined) continue;
    if (body[key] === null) {
      patch[key] = null;
      continue;
    }
    const name = typeof body[key] === 'string' ? body[key].trim() : '';
    if (name === '') {
      patch[key] = null;
      continue;
    }
    if (name.length > NAME_MAX || hasControlChars(name)) {
      throw new CarInputError('Localized location names must be 120 characters or fewer.');
    }
    patch[key] = name;
  }
  if (body.kind !== undefined && body.kind !== '') {
    if (typeof body.kind !== 'string' || !LOCATION_KINDS.includes(body.kind)) {
      throw new CarInputError('Choose a location type: airport, hotel, city, or custom.');
    }
    patch.kind = body.kind as CarLocationKind;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') throw new CarInputError('Active status must be boolean.');
    patch.isActive = body.isActive;
  }
  if (body.sortOrder !== undefined) {
    const sortOrder = validSortOrder(body.sortOrder);
    if (sortOrder === null) throw new CarInputError('Sort order must be a whole number from 0 to 100000.');
    patch.sortOrder = sortOrder;
  }

  await db.carLocation.update({ where: { slug }, data: patch });
  return patch;
}

export async function deleteCarLocation(slug: string): Promise<boolean> {
  try {
    await db.carLocation.delete({ where: { slug } });
    return true;
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new CarInputError('This location is referenced by routes. Remove those routes first.');
    }
    throw error;
  }
}

/** Public ordering helper shape reused by both lists. */
const LOCATION_ORDER: Prisma.CarLocationOrderByWithRelationInput[] = [{ sortOrder: 'asc' }, { nameEn: 'asc' }];

export async function listActiveCarLocations() {
  const rows = await db.carLocation.findMany({
    where: { isActive: true },
    orderBy: LOCATION_ORDER,
  });
  return rows;
}

export async function listAllCarLocationsAdmin() {
  const rows = await db.carLocation.findMany({ orderBy: LOCATION_ORDER });
  return rows;
}

// ------------------------------------------------------------------- routes

export interface CarRouteDraft {
  originSlug: string;
  destinationSlug: string;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Route creation: origin and destination must be distinct, existing, ACTIVE
 * locations (a route cannot be offered through a hidden location). Duplicate
 * prevention is enforced by the directional unique index and surfaced as a
 * friendly conflict — directionality is identity, so A→B and B→A coexist.
 */
export async function createCarRoute(input: unknown): Promise<CarRouteDraft & { id: string }> {
  if (typeof input !== 'object' || input === null) throw new CarInputError('Invalid request.');
  const body = input as Record<string, unknown>;
  const allowed = new Set(['originSlug', 'destinationSlug', 'isActive', 'sortOrder']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new CarInputError('Invalid request.');
  }
  const originSlug = validSlug(body.originSlug);
  const destinationSlug = validSlug(body.destinationSlug);
  if (!originSlug || !destinationSlug) {
    throw new CarInputError('Choose the origin and destination locations.');
  }
  if (originSlug === destinationSlug) {
    throw new CarInputError('The origin and destination must be different locations.');
  }
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    throw new CarInputError('Invalid request.');
  }
  const isActive = body.isActive === undefined ? true : body.isActive;
  const sortOrder = body.sortOrder === undefined ? 999 : validSortOrder(body.sortOrder);
  if (sortOrder === null) throw new CarInputError('Sort order must be a whole number from 0 to 100000.');

  const [origin, destination] = await Promise.all([
    db.carLocation.findUnique({ where: { slug: originSlug } }),
    db.carLocation.findUnique({ where: { slug: destinationSlug } }),
  ]);
  if (!origin || !origin.isActive || !destination || !destination.isActive) {
    throw new CarInputError('Both locations must exist and be active.');
  }

  try {
    const row = await db.carRoute.create({
      data: { originSlug, destinationSlug, isActive, sortOrder },
    });
    return { id: row.id, originSlug, destinationSlug, isActive, sortOrder };
  } catch (error) {
    if (isPrismaUniqueOrForeignKey(error) && error.code === 'P2002') {
      throw new CarInputError('This route already exists.');
    }
    throw error;
  }
}

export interface CarRoutePatch {
  isActive?: boolean;
  sortOrder?: number;
}

/** Route updates are operational (active/sortOrder) — the location pair is identity. */
export async function updateCarRoute(id: string, input: unknown): Promise<CarRoutePatch | null> {
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return null;
  const body = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const allowed = new Set(['isActive', 'sortOrder']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new CarInputError('Invalid request.');
  }
  const existing = await db.carRoute.findUnique({ where: { id } });
  if (!existing) return null;
  const patch: CarRoutePatch = {};
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') throw new CarInputError('Invalid request.');
    patch.isActive = body.isActive;
  }
  if (body.sortOrder !== undefined) {
    const sortOrder = validSortOrder(body.sortOrder);
    if (sortOrder === null) throw new CarInputError('Sort order must be a whole number from 0 to 100000.');
    patch.sortOrder = sortOrder;
  }
  await db.carRoute.update({ where: { id }, data: patch });
  return patch;
}

export async function deleteCarRoute(id: string): Promise<boolean> {
  try {
    await db.carRoute.delete({ where: { id } });
    return true;
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new CarInputError('This route has vehicle prices. Deactivate it instead of deleting.');
    }
    throw error;
  }
}

const ROUTE_INCLUDE = {
  origin: true,
  destination: true,
} satisfies Prisma.CarRouteInclude;

export async function listActiveCarRoutes() {
  const rows = await db.carRoute.findMany({
    where: {
      isActive: true,
      origin: { isActive: true },
      destination: { isActive: true },
    },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: ROUTE_INCLUDE,
  });
  return rows;
}

export async function listAllCarRoutesAdmin() {
  const rows = await db.carRoute.findMany({
    orderBy: [{ sortOrder: 'asc' }, { originSlug: 'asc' }],
    include: ROUTE_INCLUDE,
  });
  return rows;
}

// ------------------------------------------------------------------- prices

export interface CarRoutePriceInput {
  minPassengers?: number;
  maxPassengers?: number;
  pricingMode?: CarPricingMode;
  routeId: string;
  carSlug: string;
  currency: string;
  oneWayCents: number;
  roundTripMode: RoundTripMode;
  roundTripCents: number | null;
  roundTripMultiplierBp: number;
  isActive: boolean;
}

/**
 * Price validation. Round-trip rules:
 *  - MANUAL → `roundTrip` is required and must be a positive amount.
 *  - AUTOMATIC → any manual round-trip figure is discarded (kept NULL); the
 *    multiplier must fall inside ×1.00–×10.00 (default ×2.00).
 * The vehicle and route must both exist staff-side; publication/activation
 * only affects public visibility, never storage.
 */
export function validateCarRoutePriceInput(input: unknown, opts: { requireCar: boolean; requireRoute: boolean }): CarRoutePriceInput {
  if (typeof input !== 'object' || input === null) throw new CarInputError('Invalid request.');
  const body = input as Record<string, unknown>;
  const allowed = new Set(['routeId', 'carSlug', 'currency', 'oneWay', 'roundTripMode', 'roundTrip', 'roundTripMultiplier', 'isActive', 'minPassengers', 'maxPassengers', 'pricingMode']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new CarInputError('Invalid request.');
  }

  const routeId = nonEmpty(body.routeId);
  if (opts.requireRoute && !routeId) throw new CarInputError('Choose the route for this price.');
  if (routeId && !/^[a-zA-Z0-9_-]{6,40}$/.test(routeId)) throw new CarInputError('Choose the route for this price.');

  const carSlug = validSlug(body.carSlug);
  if (opts.requireCar && !carSlug) throw new CarInputError('Choose the fleet vehicle for this price.');
  if (carSlug && !SLUG_PATTERN.test(carSlug)) throw new CarInputError('Choose the fleet vehicle for this price.');

  const currency = normalizeCurrency(body.currency === undefined || body.currency === '' ? 'USD' : body.currency);
  if (!currency) throw new CarInputError('Unsupported currency code.');

  const oneWayCents = parseMoneyToCents(body.oneWay);
  if (oneWayCents === null || oneWayCents < 1 || oneWayCents > CENTS_MAX) {
    throw new CarInputError('Enter a valid one-way price greater than zero.');
  }

  const mode = body.roundTripMode === undefined || body.roundTripMode === '' ? 'AUTOMATIC' : body.roundTripMode;
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') throw new CarInputError('Active status must be boolean.');
  if (mode !== 'AUTOMATIC' && mode !== 'MANUAL') {
    throw new CarInputError('Round-trip mode must be AUTOMATIC or MANUAL.');
  }
  const isActive = body.isActive === undefined ? true : body.isActive !== false;

  // Round-trip figures never leak across modes: a MANUAL entry must carry a
  // positive manual price; AUTOMATIC entries validate (and later ignore) the
  // multiplier instead.
  if (mode === 'MANUAL') {
    const roundTripCents = parseMoneyToCents(body.roundTrip);
    if (roundTripCents === null || roundTripCents < 1 || roundTripCents > CENTS_MAX) {
      throw new CarInputError('Enter a valid round-trip price greater than zero.');
    }
    return {
      routeId: routeId ?? '',
      carSlug: carSlug ?? '',
      currency,
      oneWayCents,
      roundTripMode: 'MANUAL',
      roundTripCents,
      roundTripMultiplierBp: DEFAULT_ROUND_TRIP_MULTIPLIER_BP,
      isActive,
    };
  }
  const multiplierInput =
    body.roundTripMultiplier === undefined || body.roundTripMultiplier === ''
      ? null
      : body.roundTripMultiplier;
  const roundTripMultiplierBp = multiplierInput === null
    ? DEFAULT_ROUND_TRIP_MULTIPLIER_BP
    : parseRoundTripMultiplier(multiplierInput);
  if (roundTripMultiplierBp === null) {
    throw new CarInputError('The automatic round-trip multiplier must be between 1.00 and 10.00.');
  }
  return {
    routeId: routeId ?? '',
    carSlug: carSlug ?? '',
    currency,
    oneWayCents,
    roundTripMode: 'AUTOMATIC',
    roundTripCents: null,
    roundTripMultiplierBp,
    isActive,
  };
}

function priceData(input: CarRoutePriceInput) {
  return {
    routeId: input.routeId,
    carSlug: input.carSlug,
    currency: input.currency,
    oneWayCents: input.oneWayCents,
    roundTripMode: input.roundTripMode === 'MANUAL' ? DbRoundTripMode.MANUAL : DbRoundTripMode.AUTOMATIC,
    roundTripCents: input.roundTripCents,
    roundTripMultiplierBp: input.roundTripMultiplierBp,
    isActive: input.isActive,
  };
}

export async function createCarRoutePrice(input: unknown): Promise<CarRoutePriceInput & { id: string }> {
  const value = validateCarRoutePriceInput(input, { requireCar: true, requireRoute: true });
  const body = input as Record<string, unknown>;
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT slug FROM cars WHERE slug = ${value.carSlug} FOR UPDATE`;
    const car = await tx.car.findUnique({ where: { slug: value.carSlug } });
    if (!car) throw new CarInputError('Choose the fleet vehicle for this price.');
    if (!await tx.carRoute.findUnique({ where: { id: value.routeId } })) throw new CarInputError('Choose the route for this price.');
    const key = { routeId: value.routeId, carSlug: value.carSlug };
    const mode = pricingMode(body.pricingMode);
    const config = await tx.carRoutePricing.upsert({ where: { routeId_carSlug: key }, create: { ...key, currency: value.currency, pricingMode: mode }, update: {} });
    await lockPricing(tx, config.id);
    if (config.currency !== value.currency || (body.pricingMode !== undefined && config.pricingMode !== mode)) throw new CarInputError('Pricing mode and currency must match the vehicle-route configuration.');
    const minPassengers = body.minPassengers === undefined ? 1 : body.minPassengers;
    const maxPassengers = body.maxPassengers === undefined ? parseVehicleCapacity(car.seats) : body.maxPassengers;
    validatePassengerTier(minPassengers, maxPassengers, parseVehicleCapacity(car.seats));
    validateTierAmounts(value, maxPassengers as number, config.pricingMode);
    await rejectOverlap(tx, key, minPassengers as number, maxPassengers as number);
    const row = await tx.carRoutePrice.create({ data: { ...priceData(value), minPassengers: minPassengers as number, maxPassengers: maxPassengers as number } });
    return { ...value, id: row.id, minPassengers: row.minPassengers, maxPassengers: row.maxPassengers, pricingMode: config.pricingMode };
  });
}

function pricingMode(value: unknown): CarPricingMode {
  if (value === undefined) return 'FIXED_TOTAL';
  if (value !== 'FIXED_TOTAL' && value !== 'PER_PERSON') throw new CarInputError('Pricing mode must be FIXED_TOTAL or PER_PERSON.');
  return value;
}

function validateTierAmounts(price: Pick<CarRoutePriceInput, 'oneWayCents' | 'roundTripCents' | 'roundTripMode' | 'roundTripMultiplierBp'>, maxPassengers: number, mode: CarPricingMode) {
  const outbound = passengerAmount(price.oneWayCents, maxPassengers, mode);
  const roundTrip = computeRoundTripCents({ mode: price.roundTripMode, oneWayCents: outbound, manualRoundTripCents: price.roundTripCents === null ? null : passengerAmount(price.roundTripCents, maxPassengers, mode), multiplierBp: price.roundTripMultiplierBp, reverseLegCents: null });
  if ('fail' in roundTrip) throw new CarInputError('Enter a valid round-trip price greater than zero.');
  passengerAmount(roundTrip.cents, 1, 'FIXED_TOTAL');
}

async function lockPricing(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM car_route_pricing WHERE id = ${id} FOR UPDATE`;
}

export async function validateCarCapacityChange(tx: Prisma.TransactionClient, slug: string, seats: string): Promise<void> {
  await tx.$queryRaw`SELECT slug FROM cars WHERE slug = ${slug} FOR UPDATE`;
  const tiers = await tx.carRoutePrice.findMany({ where: { carSlug: slug } });
  const confirmed = await tx.carRequest.findMany({ where: { assignedVehicleSlug: slug, status: 'CONFIRMED' }, select: { passengers: true } });
  if (!tiers.length && !confirmed.length) return;
  const capacity = parseVehicleCapacity(seats);
  if (capacity === null || tiers.some(tier => tier.maxPassengers > capacity)) throw new CarInputError('Vehicle capacity would invalidate existing passenger price tiers. Update or remove those tiers first.');
  if (confirmed.some(request => request.passengers > capacity)) throw new CarInputError('Vehicle capacity would invalidate a confirmed transfer. Reassign that request first.');
}

async function rejectOverlap(tx: Prisma.TransactionClient, key: { routeId: string; carSlug: string }, min: number, max: number, except?: string) {
  const tiers = await tx.carRoutePrice.findMany({ where: { routeId: key.routeId, carSlug: key.carSlug } });
  if (tiers.some(tier => tier.id !== except && tier.minPassengers <= max && tier.maxPassengers >= min)) throw new CarInputError('A price for this vehicle and route already exists in an overlapping passenger tier.');
}

export interface CarRoutePricePatch {
  currency?: string;
  oneWayCents?: number;
  roundTripMode?: RoundTripMode;
  roundTripCents?: number | null;
  roundTripMultiplierBp?: number;
  isActive?: boolean;
}

/**
 * Price edits. Mode switches enforce the same rules as creation and never
 * leave stale figures behind (AUTOMATIC clears the manual price; MANUAL
 * clears the multiplier back to the default).
 */
async function updateLegacyPrice(db: Prisma.TransactionClient, id: string, input: unknown): Promise<CarRoutePricePatch | null> {
  if (!/^[a-zA-Z0-9_-]{6,40}$/.test(id)) return null;
  const body = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') throw new CarInputError('Active status must be boolean.');
  const allowed = new Set(['currency', 'oneWay', 'roundTripMode', 'roundTrip', 'roundTripMultiplier', 'isActive']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new CarInputError('Invalid request.');
  }
  const existing = await db.carRoutePrice.findUnique({ where: { id } });
  if (!existing) return null;

  const patch: CarRoutePricePatch = {};
  if (body.currency !== undefined) {
    const currency = normalizeCurrency(body.currency);
    if (!currency) throw new CarInputError('Unsupported currency code.');
    patch.currency = currency;
  }
  if (body.oneWay !== undefined) {
    const oneWayCents = parseMoneyToCents(body.oneWay);
    if (oneWayCents === null || oneWayCents < 1 || oneWayCents > CENTS_MAX) {
      throw new CarInputError('Enter a valid one-way price greater than zero.');
    }
    patch.oneWayCents = oneWayCents;
  }
  if (body.isActive !== undefined) patch.isActive = body.isActive !== false;

  const nextMode = body.roundTripMode === undefined
    ? (existing.roundTripMode === DbRoundTripMode.MANUAL ? 'MANUAL' : 'AUTOMATIC')
    : body.roundTripMode;
  if (nextMode !== 'AUTOMATIC' && nextMode !== 'MANUAL') {
    throw new CarInputError('Round-trip mode must be AUTOMATIC or MANUAL.');
  }

  if (nextMode === 'MANUAL') {
    let roundTripCents = body.roundTrip !== undefined ? parseMoneyToCents(body.roundTrip) : existing.roundTripCents;
    if (existing.roundTripMode !== DbRoundTripMode.MANUAL && body.roundTrip === undefined) roundTripCents = null;
    if (roundTripCents === null || roundTripCents < 1 || roundTripCents > CENTS_MAX) {
      throw new CarInputError('Enter a valid round-trip price greater than zero.');
    }
    patch.roundTripMode = 'MANUAL';
    patch.roundTripCents = roundTripCents;
    patch.roundTripMultiplierBp = DEFAULT_ROUND_TRIP_MULTIPLIER_BP;
  } else {
    const multiplierInput =
      body.roundTripMultiplier === undefined || body.roundTripMultiplier === ''
        ? null
        : body.roundTripMultiplier;
    // No input keeps the existing AUTOMATIC multiplier (or the default when
    // the row just switched from MANUAL) — never re-parses a stored bp value.
    const roundTripMultiplierBp = multiplierInput === null
      ? (existing.roundTripMode === DbRoundTripMode.AUTOMATIC ? existing.roundTripMultiplierBp : DEFAULT_ROUND_TRIP_MULTIPLIER_BP)
      : parseRoundTripMultiplier(multiplierInput);
    if (roundTripMultiplierBp === null) {
      throw new CarInputError('The automatic round-trip multiplier must be between 1.00 and 10.00.');
    }
    patch.roundTripMode = 'AUTOMATIC';
    patch.roundTripCents = null;
    patch.roundTripMultiplierBp = roundTripMultiplierBp;
  }

  await db.carRoutePrice.update({
    where: { id },
    data: {
      ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
      ...(patch.oneWayCents !== undefined ? { oneWayCents: patch.oneWayCents } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      roundTripMode: patch.roundTripMode === 'MANUAL' ? DbRoundTripMode.MANUAL : DbRoundTripMode.AUTOMATIC,
      roundTripCents: patch.roundTripMode === 'MANUAL' ? (patch.roundTripCents ?? null) : null,
      roundTripMultiplierBp: patch.roundTripMultiplierBp ?? DEFAULT_ROUND_TRIP_MULTIPLIER_BP,
    },
  });
  return patch;
}

export async function updateCarRoutePrice(id: string, input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new CarInputError('Invalid request.');
  const { minPassengers, maxPassengers, pricingMode: mode, expectedPricingMode, expectedCurrency, ...legacy } = input as Record<string, unknown>;
  const hint = await db.carRoutePrice.findUnique({ where: { id } });
  if (!hint) return null;
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT slug FROM cars WHERE slug = ${hint.carSlug} FOR UPDATE`;
    const config = await tx.carRoutePricing.findUniqueOrThrow({ where: { routeId_carSlug: { routeId: hint.routeId, carSlug: hint.carSlug } } });
    await lockPricing(tx, config.id);
    if ((expectedPricingMode !== undefined && expectedPricingMode !== config.pricingMode) || (expectedCurrency !== undefined && expectedCurrency !== config.currency)) throw new CarInputError('Configuration changed. Reload before saving.');
    const row = await tx.carRoutePrice.findUnique({ where: { id } });
    if (!row) return null;
    const car = await tx.car.findUniqueOrThrow({ where: { slug: row.carSlug } });
    const min = minPassengers === undefined ? row.minPassengers : minPassengers;
    const max = maxPassengers === undefined ? row.maxPassengers : maxPassengers;
    validatePassengerTier(min, max, parseVehicleCapacity(car.seats));
    await rejectOverlap(tx, row, min as number, max as number, id);
    const nextCurrency = legacy.currency === undefined ? config.currency : normalizeCurrency(legacy.currency);
    if (!nextCurrency) throw new CarInputError('Unsupported currency code.');
    const nextMode = mode === undefined ? config.pricingMode : pricingMode(mode);
    const siblings = await tx.carRoutePrice.findMany({ where: { routeId: row.routeId, carSlug: row.carSlug } });
    if (siblings.length > 1 && (nextMode !== config.pricingMode || nextCurrency !== config.currency)) throw new CarInputError('Cannot change pricing mode or currency through one tier of a multi-tier configuration.');
    await tx.carRoutePricing.update({ where: { id: config.id }, data: { pricingMode: nextMode, currency: nextCurrency } });
    const patch = await updateLegacyPrice(tx, id, legacy);
    const updated = await tx.carRoutePrice.findUnique({ where: { id } });
    if (!updated) throw new CarInputError('Price not found.');
    validateTierAmounts(updated, max as number, nextMode);
    await tx.carRoutePrice.update({ where: { id }, data: { minPassengers: min as number, maxPassengers: max as number } });
    return { ...patch, minPassengers: min, maxPassengers: max, pricingMode: nextMode };
  });
}

export async function deleteCarRoutePrice(id: string): Promise<boolean> {
  if (!/^[a-zA-Z0-9_-]{6,40}$/.test(id)) return false;
  const existing = await db.carRoutePrice.findUnique({ where: { id } });
  if (!existing) return false;
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT slug FROM cars WHERE slug = ${existing.carSlug} FOR UPDATE`;
    const config = await tx.carRoutePricing.findUniqueOrThrow({ where: { routeId_carSlug: { routeId: existing.routeId, carSlug: existing.carSlug } } });
    await lockPricing(tx, config.id);
    if (!await tx.carRoutePrice.findUnique({ where: { id } })) return false;
    await tx.carRoutePrice.delete({ where: { id } });
    return true;
  });
}

export async function listAllCarPricesAdmin(filters: { routeId?: string; carSlug?: string } = {}) {
  const rows = await db.carRoutePrice.findMany({
    where: {
      ...(filters.routeId ? { routeId: filters.routeId } : {}),
      ...(filters.carSlug ? { carSlug: filters.carSlug } : {}),
    },
    orderBy: [{ routeId: 'asc' }, { carSlug: 'asc' }, { minPassengers: 'asc' }],
    include: { configuration: true },
  });
  return rows.map(row => ({ ...row, pricingMode: row.configuration.pricingMode }));
}

export async function listCarPricingConfigurations() {
  return db.carRoutePricing.findMany({ orderBy: [{ routeId: 'asc' }, { carSlug: 'asc' }] });
}

export async function updateCarPricingConfiguration(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new CarInputError('Invalid request.');
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some(key => !['id', 'pricingMode', 'currency', 'previousMode', 'previousCurrency', 'acknowledge'].includes(key))) throw new CarInputError('Invalid request.');
  if (typeof body.id !== 'string' || body.acknowledge !== true) throw new CarInputError('Confirm the configuration change.');
  const mode = pricingMode(body.pricingMode);
  const currency = normalizeCurrency(body.currency);
  if (!currency || body.pricingMode === undefined) throw new CarInputError('Choose a valid pricing mode and currency.');
  const config = await db.carRoutePricing.findUnique({ where: { id: body.id } });
  if (!config) return null;
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT slug FROM cars WHERE slug = ${config.carSlug} FOR UPDATE`;
    await lockPricing(tx, config.id);
    const current = await tx.carRoutePricing.findUniqueOrThrow({ where: { id: config.id } });
    if (current.pricingMode !== body.previousMode || current.currency !== body.previousCurrency) throw new CarInputError('Configuration changed. Reload before saving.');
    const car = await tx.car.findUniqueOrThrow({ where: { slug: config.carSlug } });
    const tiers = await tx.carRoutePrice.findMany({ where: { routeId: config.routeId, carSlug: config.carSlug } });
    for (const tier of tiers) {
      validatePassengerTier(tier.minPassengers, tier.maxPassengers, parseVehicleCapacity(car.seats));
      validateTierAmounts(tier, tier.maxPassengers, mode);
    }
    return tx.carRoutePricing.update({ where: { id: config.id }, data: { pricingMode: mode, currency } });
  });
}

// -------------------------------------------------------------------- quote

export interface CarRouteQuoteRequest {
  vehicleSlug: string;
  routeId: string;
  trip: QuoteTripType;
  passengers: number;
}

export interface CarRouteQuoteResolved {
  pricingMetadata?: CarPricingMetadata;
  vehicleSlug: string;
  routeId: string;
  tripType: QuoteTripType;
  currency: string;
  oneWayCents: number;
  roundTripMode: RoundTripMode;
  roundTripCents: number;
  roundTripBasis: 'manual' | 'legs' | 'multiplier';
  amount: string;
}

/**
 * Quote resolution for a published vehicle + active route.
 * Order of outcomes:
 *  1. bad input / auth-free validation errors → thrown (400 at the route);
 *  2. vehicle unknown/hidden, unclear or insufficient capacity → thrown;
 *  3. route or price missing/inactive, unconfigured manual round-trip →
 *     `price_on_request` with a machine-readable reason (200 at the route) —
 *     no silent default prices, ever.
 */
export type CarRouteQuoteResult =
  | { kind: 'quote'; detail: CarRouteQuoteResolved }
  | { kind: 'price_on_request'; reason: 'route_unavailable' | 'price_unavailable' | 'round_trip_unconfigured'; detail: null };

export async function resolveCarRouteQuote(input: unknown): Promise<CarRouteQuoteResult> {
  if (typeof input !== 'object' || input === null) throw new CarInputError('Invalid request.');
  const body = input as Record<string, unknown>;
  const allowed = new Set(['vehicle', 'route', 'trip', 'passengers', 'from', 'to']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new CarInputError('Invalid request.');
  }

  const vehicleSlug = typeof body.vehicle === 'string' ? body.vehicle.trim().toLowerCase() : '';
  if (!SLUG_PATTERN.test(vehicleSlug)) throw new CarInputError('Select a vehicle from the fleet list.');
  let routeId = nonEmpty(body.route);
  if (!routeId) {
    // Location-slug convenience resolution: `from` + `to` address the
    // directional route directly so public UIs do not need route IDs.
    const from = typeof body.from === 'string' ? body.from.trim() : '';
    const to = typeof body.to === 'string' ? body.to.trim() : '';
    if (!SLUG_PATTERN.test(from) || !SLUG_PATTERN.test(to)) {
      throw new CarInputError('Choose a route to price.');
    }
    const pair = await db.carRoute.findUnique({
      where: { originSlug_destinationSlug: { originSlug: from, destinationSlug: to } },
    });
    routeId = pair?.id ?? null;
  }
  const trip = tripTypeFromQuery(typeof body.trip === 'string' ? body.trip : '');
  if (!trip) throw new CarInputError('Choose One Way or Round Trip.');
  const passengers = body.passengers;
  if (typeof passengers !== 'number' || !Number.isSafeInteger(passengers) || passengers < 1 || passengers > 50) {
    throw new CarInputError('Passengers must be a whole number from 1 to 50.');
  }

  const vehicle = await db.car.findUnique({ where: { slug: vehicleSlug } });
  if (!vehicle || !vehicle.isPublished) throw new CarInputError('Select a vehicle from the fleet list.');
  const capacityCheck = checkQuotePassengerCapacity(vehicle.seats, passengers);
  if (!capacityCheck.ok) throw new CarInputError(capacityCheck.message ?? 'Invalid request.');
  if (!routeId) return { kind: 'price_on_request', reason: 'route_unavailable', detail: null };

  // Same route/price computation as the snapshot path, re-wrapped in the
  // public quote endpoint's richer detail shape (tests pin this shape).
  const excerpt = await computeRouteQuoteResult(vehicleSlug, routeId, trip, passengers);
  if (excerpt.kind === 'price_on_request') {
    return { kind: 'price_on_request', reason: excerpt.reason, detail: null };
  }
  return {
    kind: 'quote',
    detail: {
      vehicleSlug,
      routeId,
      tripType: trip,
      currency: excerpt.currency,
      oneWayCents: excerpt.oneWayCents,
      roundTripMode: excerpt.roundTripMode,
      roundTripCents: excerpt.roundTripCents,
      roundTripBasis: excerpt.basis,
      amount: centsToDecimalString(excerpt.cents),
      pricingMetadata: excerpt.pricingMetadata,
    },
  };
}

/**
 * Route-only pricing excerpt shared by the public quote endpoint and the
 * CarRequest snapshot builder. Unsafe capacity selections receive no price;
 * the request itself remains inquiry-first and can still be submitted.
 */
export type CarRequestQuoteResult =
  | {
      kind: 'quote';
      pricingMetadata?: CarPricingMetadata;
      currency: string;
      /** Trip's final amount in integer cents (one-way or full round-trip). */
      cents: number;
      oneWayCents: number;
      roundTripCents: number;
      roundTripMode: 'MANUAL' | 'AUTOMATIC';
      basis: 'legs' | 'multiplier' | 'manual';
    }
  | { kind: 'price_on_request'; reason: 'route_unavailable' | 'price_unavailable' | 'round_trip_unconfigured' };

async function computeRouteQuoteResult(vehicleSlug: string, routeId: string, trip: QuoteTripType, passengers: number, client?: Prisma.TransactionClient): Promise<CarRequestQuoteResult> {
  try {
    return client ? await computeTierQuote(client, vehicleSlug, routeId, trip, passengers) : await db.$transaction(tx => computeTierQuote(tx, vehicleSlug, routeId, trip, passengers));
  } catch (error) {
    if (error instanceof CarInputError) return { kind: 'price_on_request', reason: 'price_unavailable' };
    throw error;
  }
}

async function computeTierQuote(
  db: Prisma.TransactionClient,
  vehicleSlug: string,
  routeId: string,
  trip: 'one-way' | 'round-trip',
  passengers: number,
): Promise<CarRequestQuoteResult> {
  const route = await db.carRoute.findUnique({
    where: { id: routeId },
    include: ROUTE_INCLUDE,
  });
  if (!route || !route.isActive || !route.origin.isActive || !route.destination.isActive) {
    return { kind: 'price_on_request', reason: 'route_unavailable' };
  }

  const car = await db.car.findUnique({ where: { slug: vehicleSlug } });
  if (!car || !car.isPublished || !checkQuotePassengerCapacity(car.seats, passengers).ok) return { kind: 'price_on_request', reason: 'price_unavailable' };
  const candidates = await db.carRoutePrice.findMany({ where: { routeId, carSlug: vehicleSlug, isActive: true }, include: { configuration: true } });
  const matches = candidates.filter(t => t.minPassengers <= passengers && t.maxPassengers >= passengers);
  const price = matches.length === 1 ? matches[0] : null;
  if (!price || price.maxPassengers > (parseVehicleCapacity(car.seats) ?? 0) || price.minPassengers < 1 || price.currency !== price.configuration.currency) {
    return { kind: 'price_on_request', reason: 'price_unavailable' };
  }

  let reverseLegCents: number | null = null;
  const oneWayCents = passengerAmount(price.oneWayCents, passengers, price.configuration.pricingMode);
  let returnPricing: CarPricingMetadata['returnPricing'] = null;
  if (price.roundTripMode === DbRoundTripMode.AUTOMATIC) {
    // Return leg uses the REAL reverse-route rate when one exists; the
    // multiplier fallback applies only when pricing for B→A is absent.
    const reverseRoute = await db.carRoute.findUnique({
      where: { originSlug_destinationSlug: { originSlug: route.destinationSlug, destinationSlug: route.originSlug } },
    });
    if (reverseRoute?.isActive) {
      const reversePrices = await db.carRoutePrice.findMany({ where: { routeId: reverseRoute.id, carSlug: vehicleSlug, isActive: true }, include: { configuration: true } });
      const reverseMatches = reversePrices.filter(t => t.minPassengers <= passengers && t.maxPassengers >= passengers);
      if (reverseMatches.length > 1) return { kind: 'price_on_request', reason: 'price_unavailable' };
      const reversePrice = reverseMatches[0];
      if (reversePrice) {
        if (reversePrice.currency !== price.currency || reversePrice.currency !== reversePrice.configuration.currency) {
          if (trip === 'round-trip') return { kind: 'price_on_request', reason: 'price_unavailable' };
        } else if (reversePrice.minPassengers >= 1 && reversePrice.maxPassengers <= (parseVehicleCapacity(car.seats) ?? 0)) {
          reverseLegCents = passengerAmount(reversePrice.oneWayCents, passengers, reversePrice.configuration.pricingMode);
          returnPricing = { basis: 'legs', tierId: reversePrice.id, pricingMode: reversePrice.configuration.pricingMode, unitCents: reversePrice.oneWayCents, currency: reversePrice.currency };
        } else return { kind: 'price_on_request', reason: 'price_unavailable' };
      }
    }
  }

  const roundTrip = computeRoundTripCents({
    mode: price.roundTripMode === DbRoundTripMode.MANUAL ? 'MANUAL' : 'AUTOMATIC',
    oneWayCents,
    manualRoundTripCents: price.roundTripCents === null ? null : passengerAmount(price.roundTripCents, passengers, price.configuration.pricingMode),
    multiplierBp: price.roundTripMultiplierBp,
    reverseLegCents,
  });
  if ('fail' in roundTrip) {
    return { kind: 'price_on_request', reason: roundTrip.fail };
  }
  passengerAmount(roundTrip.cents, 1, 'FIXED_TOTAL');
  if (!returnPricing) returnPricing = roundTrip.basis === 'manual'
    ? { basis: 'manual', tierId: price.id, pricingMode: price.configuration.pricingMode, unitCents: price.roundTripCents!, currency: price.currency }
    : { basis: 'multiplier', multiplierBp: price.roundTripMultiplierBp };

  return {
    kind: 'quote',
    currency: price.currency,
    cents: trip === 'one-way' ? oneWayCents : roundTrip.cents,
    oneWayCents,
    roundTripCents: roundTrip.cents,
    roundTripMode: price.roundTripMode === DbRoundTripMode.MANUAL ? 'MANUAL' : 'AUTOMATIC',
    basis: roundTrip.basis,
    pricingMetadata: { version: 1, passengers, outbound: { tierId: price.id, minPassengers: price.minPassengers, maxPassengers: price.maxPassengers, pricingMode: price.configuration.pricingMode, unitCents: price.oneWayCents, currency: price.currency }, returnPricing: trip === 'round-trip' ? returnPricing : null },
  };
}

/**
 * CarRequest-side snapshot resolver. Same pricing excerpt as the public
 * quote endpoint. Invalid capacity produces Price on Request without blocking
 * inquiry-first submission. Invalid/untrusted payloads still throw.
 */
export async function resolveCarRequestQuote(input: unknown, client?: Prisma.TransactionClient): Promise<CarRequestQuoteResult> {
  if (typeof input !== 'object' || input === null) throw new CarInputError('Invalid request.');
  const body = input as Record<string, unknown>;
  const allowed = new Set(['vehicle', 'route', 'trip', 'passengers']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new CarInputError('Invalid request.');
  }
  const vehicleSlug = typeof body.vehicle === 'string' ? body.vehicle.trim().toLowerCase() : '';
  if (!SLUG_PATTERN.test(vehicleSlug)) throw new CarInputError('Select a vehicle from the fleet list.');
  const routeId = nonEmpty(body.route);
  if (!routeId) throw new CarInputError('Choose a route to price.');
  const trip = tripTypeFromQuery(typeof body.trip === 'string' ? body.trip : '');
  if (!trip) throw new CarInputError('Choose One Way or Round Trip.');
  const passengers = body.passengers;
  if (typeof passengers !== 'number' || !Number.isSafeInteger(passengers) || passengers < 1 || passengers > 50) {
    throw new CarInputError('Passengers must be a whole number from 1 to 50.');
  }
  return computeRouteQuoteResult(vehicleSlug, routeId, trip, passengers, client);
}/** Trip type for journeys placed on CarRequest (shared mapping helper). */
export function mapQuoteTripToCarRequestTrip(trip: QuoteTripType) {
  return TRIP_TYPE_QUERY[trip];
}
