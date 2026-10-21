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
  if (typeof input !== 'object' || input === null) throw new Error('Invalid request.');
  const body = input as Record<string, unknown>;
  const allowed = new Set(['slug', 'nameEn', 'nameEs', 'nameIt', 'nameAr', 'kind', 'isActive', 'sortOrder']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new Error('Invalid request.');
  }
  const slug = validSlug(body.slug);
  if (!slug) throw new Error('Enter a valid slug: lowercase letters, numbers, and hyphens.');

  const nameEn = nonEmpty(body.nameEn);
  if (!nameEn || nameEn.length > NAME_MAX || hasControlChars(nameEn)) {
    throw new Error('Enter the English location name (120 characters or fewer).');
  }
  const localized = (value: unknown): string | null => {
    const name = typeof value === 'string' ? value.trim() : '';
    if (name === '') return null;
    if (name.length > NAME_MAX || hasControlChars(name)) {
      throw new Error('Localized location names must be 120 characters or fewer.');
    }
    return name;
  };
  const kind = body.kind === undefined || body.kind === '' ? 'CITY' : body.kind;
  if (typeof kind !== 'string' || !LOCATION_KINDS.includes(kind)) {
    throw new Error('Choose a location type: airport, hotel, city, or custom.');
  }
  const isActive = body.isActive === undefined ? true : body.isActive !== false;
  const sortOrder = body.sortOrder === undefined ? 999 : validSortOrder(body.sortOrder);
  if (sortOrder === null) throw new Error('Sort order must be a whole number from 0 to 100000.');

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
      throw new Error('Slug must be unique.');
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
    if (!allowed.has(key)) throw new Error('Invalid request.');
  }
  const existing = await db.carLocation.findUnique({ where: { slug } });
  if (!existing) return null;

  const patch: CarLocationPatch = {};
  if (body.nameEn !== undefined) {
    const nameEn = nonEmpty(body.nameEn);
    if (!nameEn || nameEn.length > NAME_MAX || hasControlChars(nameEn)) {
      throw new Error('Enter the English location name (120 characters or fewer).');
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
      throw new Error('Localized location names must be 120 characters or fewer.');
    }
    patch[key] = name;
  }
  if (body.kind !== undefined && body.kind !== '') {
    if (typeof body.kind !== 'string' || !LOCATION_KINDS.includes(body.kind)) {
      throw new Error('Choose a location type: airport, hotel, city, or custom.');
    }
    patch.kind = body.kind as CarLocationKind;
  }
  if (body.isActive !== undefined) patch.isActive = body.isActive !== false;
  if (body.sortOrder !== undefined) {
    const sortOrder = validSortOrder(body.sortOrder);
    if (sortOrder === null) throw new Error('Sort order must be a whole number from 0 to 100000.');
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
      throw new Error('This location is referenced by routes. Remove those routes first.');
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
}

/**
 * Route creation: origin and destination must be distinct, existing, ACTIVE
 * locations (a route cannot be offered through a hidden location). Duplicate
 * prevention is enforced by the directional unique index and surfaced as a
 * friendly conflict — directionality is identity, so A→B and B→A coexist.
 */
export async function createCarRoute(input: unknown): Promise<CarRouteDraft & { id: string }> {
  if (typeof input !== 'object' || input === null) throw new Error('Invalid request.');
  const body = input as Record<string, unknown>;
  const allowed = new Set(['originSlug', 'destinationSlug', 'isActive']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new Error('Invalid request.');
  }
  const originSlug = validSlug(body.originSlug);
  const destinationSlug = validSlug(body.destinationSlug);
  if (!originSlug || !destinationSlug) {
    throw new Error('Choose the origin and destination locations.');
  }
  if (originSlug === destinationSlug) {
    throw new Error('The origin and destination must be different locations.');
  }
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    throw new Error('Invalid request.');
  }
  const isActive = body.isActive === undefined ? true : body.isActive;

  const [origin, destination] = await Promise.all([
    db.carLocation.findUnique({ where: { slug: originSlug } }),
    db.carLocation.findUnique({ where: { slug: destinationSlug } }),
  ]);
  if (!origin || !origin.isActive || !destination || !destination.isActive) {
    throw new Error('Both locations must exist and be active.');
  }

  try {
    const row = await db.carRoute.create({
      data: { originSlug, destinationSlug, isActive },
    });
    return { id: row.id, originSlug, destinationSlug, isActive };
  } catch (error) {
    if (isPrismaUniqueOrForeignKey(error) && error.code === 'P2002') {
      throw new Error('This route already exists.');
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
    if (!allowed.has(key)) throw new Error('Invalid request.');
  }
  const existing = await db.carRoute.findUnique({ where: { id } });
  if (!existing) return null;
  const patch: CarRoutePatch = {};
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') throw new Error('Invalid request.');
    patch.isActive = body.isActive;
  }
  if (body.sortOrder !== undefined) {
    const sortOrder = validSortOrder(body.sortOrder);
    if (sortOrder === null) throw new Error('Sort order must be a whole number from 0 to 100000.');
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
      throw new Error('This route has vehicle prices. Deactivate it instead of deleting.');
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
  if (typeof input !== 'object' || input === null) throw new Error('Invalid request.');
  const body = input as Record<string, unknown>;
  const allowed = new Set(['routeId', 'carSlug', 'currency', 'oneWay', 'roundTripMode', 'roundTrip', 'roundTripMultiplier', 'isActive']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new Error('Invalid request.');
  }

  const routeId = nonEmpty(body.routeId);
  if (opts.requireRoute && !routeId) throw new Error('Choose the route for this price.');
  if (routeId && !/^[a-zA-Z0-9_-]{6,40}$/.test(routeId)) throw new Error('Choose the route for this price.');

  const carSlug = validSlug(body.carSlug);
  if (opts.requireCar && !carSlug) throw new Error('Choose the fleet vehicle for this price.');
  if (carSlug && !SLUG_PATTERN.test(carSlug)) throw new Error('Choose the fleet vehicle for this price.');

  const currency = normalizeCurrency(body.currency === undefined || body.currency === '' ? 'USD' : body.currency);
  if (!currency) throw new Error('Unsupported currency code.');

  const oneWayCents = parseMoneyToCents(body.oneWay);
  if (oneWayCents === null || oneWayCents < 1 || oneWayCents > CENTS_MAX) {
    throw new Error('Enter a valid one-way price greater than zero.');
  }

  const mode = body.roundTripMode === undefined || body.roundTripMode === '' ? 'AUTOMATIC' : body.roundTripMode;
  if (mode !== 'AUTOMATIC' && mode !== 'MANUAL') {
    throw new Error('Round-trip mode must be AUTOMATIC or MANUAL.');
  }
  const isActive = body.isActive === undefined ? true : body.isActive !== false;

  // Round-trip figures never leak across modes: a MANUAL entry must carry a
  // positive manual price; AUTOMATIC entries validate (and later ignore) the
  // multiplier instead.
  if (mode === 'MANUAL') {
    const roundTripCents = parseMoneyToCents(body.roundTrip);
    if (roundTripCents === null || roundTripCents < 1 || roundTripCents > CENTS_MAX) {
      throw new Error('Enter a valid round-trip price greater than zero.');
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
    throw new Error('The automatic round-trip multiplier must be between 1.00 and 10.00.');
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
  const car = await db.car.findUnique({ where: { slug: value.carSlug } });
  if (!car) throw new Error('Choose the fleet vehicle for this price.');
  const route = await db.carRoute.findUnique({ where: { id: value.routeId } });
  if (!route) throw new Error('Choose the route for this price.');
  try {
    const row = await db.carRoutePrice.create({ data: priceData(value) });
    return { ...value, id: row.id };
  } catch (error) {
    if (isPrismaUniqueOrForeignKey(error) && error.code === 'P2002') {
      throw new Error('A price for this vehicle and route already exists.');
    }
    throw error;
  }
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
export async function updateCarRoutePrice(id: string, input: unknown): Promise<CarRoutePricePatch | null> {
  if (!/^[a-zA-Z0-9_-]{6,40}$/.test(id)) return null;
  const body = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const allowed = new Set(['currency', 'oneWay', 'roundTripMode', 'roundTrip', 'roundTripMultiplier', 'isActive']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new Error('Invalid request.');
  }
  const existing = await db.carRoutePrice.findUnique({ where: { id } });
  if (!existing) return null;

  const patch: CarRoutePricePatch = {};
  if (body.currency !== undefined) {
    const currency = normalizeCurrency(body.currency);
    if (!currency) throw new Error('Unsupported currency code.');
    patch.currency = currency;
  }
  if (body.oneWay !== undefined) {
    const oneWayCents = parseMoneyToCents(body.oneWay);
    if (oneWayCents === null || oneWayCents < 1 || oneWayCents > CENTS_MAX) {
      throw new Error('Enter a valid one-way price greater than zero.');
    }
    patch.oneWayCents = oneWayCents;
  }
  if (body.isActive !== undefined) patch.isActive = body.isActive !== false;

  const nextMode = body.roundTripMode === undefined
    ? (existing.roundTripMode === DbRoundTripMode.MANUAL ? 'MANUAL' : 'AUTOMATIC')
    : body.roundTripMode;
  if (nextMode !== 'AUTOMATIC' && nextMode !== 'MANUAL') {
    throw new Error('Round-trip mode must be AUTOMATIC or MANUAL.');
  }

  if (nextMode === 'MANUAL') {
    let roundTripCents = body.roundTrip !== undefined ? parseMoneyToCents(body.roundTrip) : existing.roundTripCents;
    if (existing.roundTripMode !== DbRoundTripMode.MANUAL && body.roundTrip === undefined) roundTripCents = null;
    if (roundTripCents === null || roundTripCents < 1 || roundTripCents > CENTS_MAX) {
      throw new Error('Enter a valid round-trip price greater than zero.');
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
      throw new Error('The automatic round-trip multiplier must be between 1.00 and 10.00.');
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

export async function deleteCarRoutePrice(id: string): Promise<boolean> {
  if (!/^[a-zA-Z0-9_-]{6,40}$/.test(id)) return false;
  const existing = await db.carRoutePrice.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return false;
  await db.carRoutePrice.delete({ where: { id } });
  return true;
}

export async function listAllCarPricesAdmin(filters: { routeId?: string; carSlug?: string } = {}) {
  const rows = await db.carRoutePrice.findMany({
    where: {
      ...(filters.routeId ? { routeId: filters.routeId } : {}),
      ...(filters.carSlug ? { carSlug: filters.carSlug } : {}),
    },
    orderBy: [{ routeId: 'asc' }, { carSlug: 'asc' }],
  });
  return rows;
}

// -------------------------------------------------------------------- quote

export interface CarRouteQuoteRequest {
  vehicleSlug: string;
  routeId: string;
  trip: QuoteTripType;
  passengers: number;
}

export interface CarRouteQuoteResolved {
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
  if (typeof input !== 'object' || input === null) throw new Error('Invalid request.');
  const body = input as Record<string, unknown>;
  const allowed = new Set(['vehicle', 'route', 'trip', 'passengers', 'from', 'to']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new Error('Invalid request.');
  }

  const vehicleSlug = typeof body.vehicle === 'string' ? body.vehicle.trim().toLowerCase() : '';
  if (!SLUG_PATTERN.test(vehicleSlug)) throw new Error('Select a vehicle from the fleet list.');
  let routeId = nonEmpty(body.route);
  if (!routeId) {
    // Location-slug convenience resolution: `from` + `to` address the
    // directional route directly so public UIs do not need route IDs.
    const from = typeof body.from === 'string' ? body.from.trim() : '';
    const to = typeof body.to === 'string' ? body.to.trim() : '';
    if (!SLUG_PATTERN.test(from) || !SLUG_PATTERN.test(to)) {
      throw new Error('Choose a route to price.');
    }
    const pair = await db.carRoute.findUnique({
      where: { originSlug_destinationSlug: { originSlug: from, destinationSlug: to } },
    });
    if (!pair) throw new Error('Choose a route to price.');
    routeId = pair.id;
  }
  const trip = tripTypeFromQuery(typeof body.trip === 'string' ? body.trip : '');
  if (!trip) throw new Error('Choose One Way or Round Trip.');
  const passengers = body.passengers;
  if (typeof passengers !== 'number' || !Number.isSafeInteger(passengers) || passengers < 1 || passengers > 50) {
    throw new Error('Passengers must be a whole number from 1 to 50.');
  }

  const vehicle = await db.car.findUnique({ where: { slug: vehicleSlug } });
  if (!vehicle || !vehicle.isPublished) throw new Error('Select a vehicle from the fleet list.');
  const capacityCheck = checkQuotePassengerCapacity(vehicle.seats, passengers);
  if (!capacityCheck.ok) throw new Error(capacityCheck.message ?? 'Invalid request.');

  // Same route/price computation as the snapshot path, re-wrapped in the
  // public quote endpoint's richer detail shape (tests pin this shape).
  const excerpt = await computeRouteQuoteResult(vehicleSlug, routeId, trip);
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
    },
  };
}

/**
 * Route-only pricing excerpt shared by the public quote endpoint and the
 * CarRequest snapshot builder. No vehicle/capacity gates: the request flow
 * is inquiry-first, so capacity mismatches surface as a pre-submit warning
 * in the UI instead of blocking submission.
 */
export type CarRequestQuoteResult =
  | {
      kind: 'quote';
      currency: string;
      /** Trip's final amount in integer cents (one-way or full round-trip). */
      cents: number;
      oneWayCents: number;
      roundTripCents: number;
      roundTripMode: 'MANUAL' | 'AUTOMATIC';
      basis: 'legs' | 'multiplier' | 'manual';
    }
  | { kind: 'price_on_request'; reason: 'route_unavailable' | 'price_unavailable' | 'round_trip_unconfigured' };

async function computeRouteQuoteResult(
  vehicleSlug: string,
  routeId: string,
  trip: 'one-way' | 'round-trip',
): Promise<CarRequestQuoteResult> {
  const route = await db.carRoute.findUnique({
    where: { id: routeId },
    include: ROUTE_INCLUDE,
  });
  if (!route || !route.isActive || !route.origin.isActive || !route.destination.isActive) {
    return { kind: 'price_on_request', reason: 'route_unavailable' };
  }

  const price = await db.carRoutePrice.findUnique({
    where: { routeId_carSlug: { routeId, carSlug: vehicleSlug } },
  });
  if (!price || !price.isActive) {
    return { kind: 'price_on_request', reason: 'price_unavailable' };
  }

  let reverseLegCents: number | null = null;
  if (price.roundTripMode === DbRoundTripMode.AUTOMATIC) {
    // Return leg uses the REAL reverse-route rate when one exists; the
    // multiplier fallback applies only when pricing for B→A is absent.
    const reverseRoute = await db.carRoute.findUnique({
      where: { originSlug_destinationSlug: { originSlug: route.destinationSlug, destinationSlug: route.originSlug } },
    });
    if (reverseRoute) {
      const reversePrice = await db.carRoutePrice.findUnique({
        where: { routeId_carSlug: { routeId: reverseRoute.id, carSlug: vehicleSlug } },
      });
      if (reversePrice && reversePrice.isActive) reverseLegCents = reversePrice.oneWayCents;
    }
  }

  const roundTrip = computeRoundTripCents({
    mode: price.roundTripMode === DbRoundTripMode.MANUAL ? 'MANUAL' : 'AUTOMATIC',
    oneWayCents: price.oneWayCents,
    manualRoundTripCents: price.roundTripCents,
    multiplierBp: price.roundTripMultiplierBp,
    reverseLegCents,
  });
  if ('fail' in roundTrip) {
    return { kind: 'price_on_request', reason: roundTrip.fail };
  }

  return {
    kind: 'quote',
    currency: price.currency,
    cents: trip === 'one-way' ? price.oneWayCents : roundTrip.cents,
    oneWayCents: price.oneWayCents,
    roundTripCents: roundTrip.cents,
    roundTripMode: price.roundTripMode === DbRoundTripMode.MANUAL ? 'MANUAL' : 'AUTOMATIC',
    basis: roundTrip.basis,
  };
}

/**
 * CarRequest-side snapshot resolver. Same pricing excerpt as the public
 * quote endpoint but WITHOUT vehicle/capacity gates: submission is
 * inquiry-first and must stay valid for Price on Requests. Invalid or
 * untrusted payloads throw (mapped to 400 by the caller).
 */
export async function resolveCarRequestQuote(input: unknown): Promise<CarRequestQuoteResult> {
  if (typeof input !== 'object' || input === null) throw new Error('Invalid request.');
  const body = input as Record<string, unknown>;
  const allowed = new Set(['vehicle', 'route', 'trip', 'passengers']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new Error('Invalid request.');
  }
  const vehicleSlug = typeof body.vehicle === 'string' ? body.vehicle.trim().toLowerCase() : '';
  if (!SLUG_PATTERN.test(vehicleSlug)) throw new Error('Select a vehicle from the fleet list.');
  const routeId = nonEmpty(body.route);
  if (!routeId) throw new Error('Choose a route to price.');
  const trip = tripTypeFromQuery(typeof body.trip === 'string' ? body.trip : '');
  if (!trip) throw new Error('Choose One Way or Round Trip.');
  const passengers = body.passengers;
  if (typeof passengers !== 'number' || !Number.isSafeInteger(passengers) || passengers < 1 || passengers > 50) {
    throw new Error('Passengers must be a whole number from 1 to 50.');
  }
  return computeRouteQuoteResult(vehicleSlug, routeId, trip);
}/** Trip type for journeys placed on CarRequest (shared mapping helper). */
export function mapQuoteTripToCarRequestTrip(trip: QuoteTripType) {
  return TRIP_TYPE_QUERY[trip];
}
