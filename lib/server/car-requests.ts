import { CarInputError } from '@/lib/rent-car-errors';
// Car-request domain service (Phase 2C). Server owns validation,
// reference issuance, ownership, status lifecycle, and response shaping.
// The browser never supplies userId, status, references, or internal notes.
//
// Vehicle slugs are resolved against the DB fleet catalogue. A requested
// vehicleSlug and a staff assignment must resolve to a real, published
// vehicle; legacy rows keep their stored slugs untouched. Confirmation
// additionally requires an assigned vehicle and an unambiguous capacity
// that covers the requested passenger count — no capacity is guessed.
import 'server-only';

import { randomInt } from 'node:crypto';
import { Prisma, CarRequestStatus as DbStatus, CarTripType as DbTripType } from '@prisma/client';

import { db } from './db';
import type { Car } from '@prisma/client';
import {
  isValidEmail,
  isValidPhone,
  isValidYmd,
  normalizeEmail,
  normalizePhone,
} from '../core/validation';
import {
  canTransitionCarRequest,
  labelForCarTransition,
  parseVehicleCapacity,
  CAR_EMAIL_MAX,
  CAR_LOCATION_MAX,
  CAR_NAME_MAX,
  CAR_NOTE_MAX,
  CAR_PASSENGER_MAX,
  CAR_PHONE_MAX,
  type CarRequest,
  type CarRequestStatus,
  type CarTripType,
  type StaffCarRequest,
} from '@/lib/car-request';
import { notifyUser, notifyStaff } from './notifications';
import { sendCustomerEmailSafe, sendStaffEmailSafe } from './email';
import { resolveCarRequestQuote } from './car-pricing';
import { readCarPricingMetadata } from '@/lib/car-pricing';

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const REF_ATTEMPTS = 5;

function mintReferenceCandidate(): string {
  let suffix = '';
  for (let i = 0; i < 6; i += 1) suffix += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `SP-CR-${suffix}`;
}

const TO_DB_STATUS: Record<CarRequestStatus, DbStatus> = {
  new: 'NEW',
  reviewing: 'REVIEWING',
  confirmed: 'CONFIRMED',
  cancelled: 'CANCELLED',
};

const FROM_DB_STATUS: Record<DbStatus, CarRequestStatus> = {
  NEW: 'new',
  REVIEWING: 'reviewing',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
};

const TO_DB_TRIP_TYPE: Record<CarTripType, DbTripType> = {
  'One Way': 'ONE_WAY',
  'Round Trip': 'ROUND_TRIP',
};

const FROM_DB_TRIP_TYPE: Record<DbTripType, CarTripType> = {
  ONE_WAY: 'One Way',
  ROUND_TRIP: 'Round Trip',
};

const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/;

/**
 * Resolve a vehicle slug to a real, published fleet vehicle. Hidden
 * vehicles (`isPublished=false`) and unknown slugs return null; existing
 * CarRequest rows keep their stored slugs untouched (legacy preserved).
 */
async function findPublishedFleetVehicle(slug: string, client: Prisma.TransactionClient = db): Promise<Car | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  const row = await client.car.findUnique({ where: { slug } });
  return row && row.isPublished ? row : null;
}

/**
 * Confirmation gate: the assigned vehicle must resolve to a real, published
 * vehicle whose unambiguous capacity covers the request's passengers.
 * No capacity is ever guessed — unclear seats strings block confirmation
 * with actionable copy. `client` accepts the interactive transaction so the
 * check reads the freshest assignment.
 */
async function assertConfirmableAssignment(
  request: { assignedVehicleSlug: string | null; passengers: number },
  client: Prisma.TransactionClient,
): Promise<void> {
  const assigned = (request.assignedVehicleSlug ?? '').trim();
  if (assigned === '') {
    throw new CarInputError('Assign a fleet vehicle before confirming this request.');
  }
  if (!SLUG_PATTERN.test(assigned)) {
    throw new CarInputError('Select a vehicle from the fleet list.');
  }
  await client.$queryRaw`SELECT slug FROM cars WHERE slug = ${assigned} FOR UPDATE`;
  const vehicle = await client.car.findUnique({ where: { slug: assigned } });
  if (!vehicle || !vehicle.isPublished) {
    throw new CarInputError('Select a vehicle from the fleet list.');
  }
  const capacity = parseVehicleCapacity(vehicle.seats);
  if (capacity === null) {
    throw new CarInputError(
      `The assigned vehicle's seat capacity is unclear (${vehicle.seats || 'empty'}). Set an unambiguous seat count (e.g. "6 seats") on the vehicle before confirming.`,
    );
  }
  if (request.passengers > capacity) {
    throw new CarInputError(
      `The assigned vehicle seats ${capacity} passengers, but this request has ${request.passengers}.`,
    );
  }
}

function hasControlChars(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function toDbDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function toYmd(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : '';
}

export interface ValidatedCarDraft {
  vehicleSlug: string;
  tripType: CarTripType;
  pickup: string;
  dropoff: string;
  preferredPickupDate: string;
  preferredReturnDate: string;
  passengers: number;
  notes: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  /**
   * Optional structured transfer references. Both location slugs are
   * provided together or not at all; the server resolves the directional
   * route and captures the authoritative quote snapshot at submit/edit
   * time. Prices are NEVER read from the request body.
   */
  pickupLocationSlug: string;
  dropoffLocationSlug: string;
  pickupTime: string;
  returnTime: string;
}

const DRAFT_KEYS = new Set([
  'vehicleSlug',
  'tripType',
  'pickup',
  'dropoff',
  'preferredPickupDate',
  'preferredReturnDate',
  'passengers',
  'notes',
  'contact',
  'currency',
  'pickupLocationSlug',
  'dropoffLocationSlug',
  'pickupTime',
  'returnTime',
]);

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Strict server validation mirroring the product contract. Unknown keys are
 * rejected (no mass assignment); ownership/status/reference fields are never
 * read from the body — the signature takes no such input. `currency` is
 * accepted (client locale echo) and ignored: car requests carry no prices.
 */
export function validateCarDraft(input: unknown): ValidatedCarDraft {
  if (typeof input !== 'object' || input === null) throw new CarInputError('Invalid request.');
  const body = input as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!DRAFT_KEYS.has(key)) throw new CarInputError('Invalid request.');
  }
  const fail = (message: string): never => {
    throw new CarInputError(message);
  };

  const vehicleSlug = text(body.vehicleSlug)?.trim() ?? '';
  if (!SLUG_PATTERN.test(vehicleSlug)) fail('Select a vehicle from the fleet list.');

  const tripType = text(body.tripType);
  if (tripType !== 'One Way' && tripType !== 'Round Trip') fail('Choose One Way or Round Trip.');

  const pickup = text(body.pickup)?.trim() ?? '';
  if (pickup === '') fail('Enter the pick-up location.');
  if (pickup.length > CAR_LOCATION_MAX || hasControlChars(pickup)) fail('Invalid request.');

  const dropoff = text(body.dropoff)?.trim() ?? '';
  if (dropoff === '') fail('Enter the drop-off location.');
  if (dropoff.length > CAR_LOCATION_MAX || hasControlChars(dropoff)) fail('Invalid request.');

  const validYmd = (value: string): boolean => {
    if (!isValidYmd(value)) return false;
    const year = Number(value.slice(0, 4));
    return year >= 2000 && year <= 2100;
  };
  const preferredPickupDate = text(body.preferredPickupDate)?.trim() ?? '';
  const preferredReturnDate = text(body.preferredReturnDate)?.trim() ?? '';
  if (preferredPickupDate === '' || !validYmd(preferredPickupDate)) {
    fail('Enter a valid preferred pick-up date.');
  }
  const today = utcToday();
  if (preferredPickupDate < today) fail('Preferred dates must be today or later.');
  if (tripType === 'Round Trip') {
    if (preferredReturnDate === '' || !validYmd(preferredReturnDate)) {
      fail('Enter a valid preferred return date.');
    }
    if (preferredReturnDate < today) fail('Preferred dates must be today or later.');
    if (preferredReturnDate < preferredPickupDate) {
      fail('The return date must be on or after the pick-up date.');
    }
  } else if (preferredReturnDate !== '') {
    fail('Invalid request.');
  }

  const passengers = body.passengers;
  if (typeof passengers !== 'number' || !Number.isSafeInteger(passengers) || passengers < 1 || passengers > CAR_PASSENGER_MAX) {
    fail('Passengers must be a whole number from 1 to 50.');
  }

  const notes = text(body.notes) ?? '';
  if (notes.length > CAR_NOTE_MAX || hasControlChars(notes)) fail('Notes must be 1,000 characters or fewer.');

  const contact = body.contact;
  if (typeof contact !== 'object' || contact === null) fail('Invalid request.');
  const contactRecord = contact as Record<string, unknown>;
  for (const key of Object.keys(contactRecord)) {
    if (key !== 'fullName' && key !== 'email' && key !== 'phone') fail('Invalid request.');
  }
  const contactName = text(contactRecord.fullName)?.trim() ?? '';
  if (
    contactName === '' || contactName.length > CAR_NAME_MAX ||
    contactName.length < 2 ||
    /^\d+$/.test(contactName.replace(/[\s.'-]+/g, '')) ||
    hasControlChars(contactName)
  ) {
    fail('Enter a name with at least 2 letters.');
  }
  const contactEmail = normalizeEmail(text(contactRecord.email) ?? '');
  if (contactEmail === '' || contactEmail.length > CAR_EMAIL_MAX || !isValidEmail(contactEmail)) {
    fail('Enter a valid email address.');
  }
  const contactPhoneRaw = text(contactRecord.phone)?.trim() ?? '';
  if (!isValidPhone(contactPhoneRaw) || contactPhoneRaw.length > CAR_PHONE_MAX) {
    fail('Enter a valid phone number.');
  }

  // Optional structured transfer references (both together or none).
  const pickupLocationSlug = text(body.pickupLocationSlug)?.trim() ?? '';
  const dropoffLocationSlug = text(body.dropoffLocationSlug)?.trim() ?? '';
  if (pickupLocationSlug !== '' && !SLUG_PATTERN.test(pickupLocationSlug)) fail('Invalid request.');
  if (dropoffLocationSlug !== '' && !SLUG_PATTERN.test(dropoffLocationSlug)) fail('Invalid request.');
  if ((pickupLocationSlug === '') !== (dropoffLocationSlug === '')) {
    fail('Select both the pick-up and drop-off locations from the list.');
  }

  const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const pickupTime = text(body.pickupTime)?.trim() ?? '';
  if (pickupTime !== '' && !TIME_PATTERN.test(pickupTime)) fail('Invalid request.');
  const returnTime = text(body.returnTime)?.trim() ?? '';
  if (returnTime !== '' && (!TIME_PATTERN.test(returnTime) || tripType !== 'Round Trip')) {
    fail('Invalid request.');
  }

  return {
    vehicleSlug,
    tripType: tripType as CarTripType,
    pickup,
    dropoff,
    preferredPickupDate,
    preferredReturnDate,
    passengers: passengers as number,
    notes,
    contactName,
    contactEmail,
    contactPhone: normalizePhone(contactPhoneRaw),
    pickupLocationSlug,
    dropoffLocationSlug,
    pickupTime,
    returnTime,
  };
}

/**
 * Server-owned transfer/quote snapshot for a validated draft. Route IDs and
 * prices NEVER come from the client: when both structured location slugs are
 * present, this resolves the directional route, revalidates both location
 * rows as active, and (if an active price exists) recomputes the quote with
 * the authoritative pricing service at submit/edit time. Otherwise nothing
 * is snapshotted (legacy free-text flow, kept fully intact).
 */
type CarRequestTransfer = {
  pickupLocationSlug: string;
  dropoffLocationSlug: string;
  routeId: string | null;
  pickupTime: string | null;
  returnTime: string | null;
  quoteCurrency: string | null;
  quotedCents: number | null;
  quoteBasis: string | null;
  quoteRoundTripCents: number | null;
  quotePricingMetadata: string | null;
  quotedAt: Date;
  /** Canonical location names (English) written over pickup/dropoff copy. */
  pickup: string;
  dropoff: string;
};

async function buildCarRequestTransfer(
  draft: ValidatedCarDraft,
  client: Prisma.TransactionClient = db,
): Promise<CarRequestTransfer | null> {
  if (!draft.pickupLocationSlug || !draft.dropoffLocationSlug) return null;
  const [pickupLoc, dropoffLoc, route] = await Promise.all([
    client.carLocation.findUnique({ where: { slug: draft.pickupLocationSlug } }),
    client.carLocation.findUnique({ where: { slug: draft.dropoffLocationSlug } }),
    client.carRoute.findUnique({
      where: {
        originSlug_destinationSlug: {
          originSlug: draft.pickupLocationSlug,
          destinationSlug: draft.dropoffLocationSlug,
        },
      },
    }),
  ]);
  if (!pickupLoc || !pickupLoc.isActive || !dropoffLoc || !dropoffLoc.isActive) {
    throw new CarInputError('Select the pick-up and drop-off locations from the list.');
  }

  let routeId: string | null = null;
  let quoteCurrency: string | null = null;
  let quotedCents: number | null = null;
  let quoteBasis: string | null = null;
  let quoteRoundTripCents: number | null = null;
  let quotePricingMetadata: string | null = null;
  if (route && route.isActive) {
    routeId = route.id;
    // Authoritative re-quote at submission time. Price on Request (route
    // inactive/unconfigured, round-trip unconfigured, no active price row)
    // keeps the monetary columns NULL — the request is still valid.
    const quote = await resolveCarRequestQuote({
      vehicle: draft.vehicleSlug,
      route: route.id,
      trip: draft.tripType === 'Round Trip' ? 'round-trip' : 'one-way',
      passengers: draft.passengers,
    }, client);
    if (quote.kind === 'quote') {
      quoteCurrency = quote.currency;
      quotedCents = quote.cents;
      quoteBasis = quote.basis;
      quoteRoundTripCents = draft.tripType === 'Round Trip' ? quote.cents : null;
      quotePricingMetadata = quote.pricingMetadata ? JSON.stringify(quote.pricingMetadata) : null;
    }
  }

  return {
    pickupLocationSlug: draft.pickupLocationSlug,
    dropoffLocationSlug: draft.dropoffLocationSlug,
    routeId,
    pickupTime: draft.pickupTime === '' ? null : draft.pickupTime,
    returnTime: draft.returnTime === '' ? null : draft.returnTime,
    quoteCurrency,
    quotedCents,
    quoteBasis,
    quoteRoundTripCents,
    quotePricingMetadata,
    quotedAt: new Date(),
    pickup: pickupLoc.nameEn,
    dropoff: dropoffLoc.nameEn,
  };
}

type RequestRow = Prisma.CarRequestGetPayload<{
  include: { activities: true; user: { select: { email: true; firstName: true; lastName: true } } };
}>;

function accountName(row: RequestRow): string {
  if (!row.user) return '';
  const full = `${row.user.firstName ?? ''} ${row.user.lastName ?? ''}`.trim();
  return full || row.user.email;
}

/**
 * Customer-safe projection: no database IDs, no user linkage, no internal
 * activity. Internal activity rows are excluded entirely so staff notes
 * never reach customer responses.
 */
export function toCustomerView(row: RequestRow): CarRequest {
  return {
    reference: row.reference,
    vehicleSlug: row.vehicleSlug,
    assignedVehicleSlug: row.assignedVehicleSlug ?? '',
    tripType: FROM_DB_TRIP_TYPE[row.tripType],
    pickup: row.pickup,
    dropoff: row.dropoff,
    preferredPickupDate: toYmd(row.pickupDate),
    preferredReturnDate: toYmd(row.returnDate),
    passengers: row.passengers,
    contact: {
      name: row.contactName,
      email: row.contactEmail,
      phone: row.contactPhone,
    },
    notes: row.notes ?? '',
    status: FROM_DB_STATUS[row.status],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    activity: [...row.activities]
      .filter((a) => !a.isInternal)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((a) => ({
        at: a.createdAt.toISOString(),
        by: (a.actorRole === 'staff' || a.actorRole === 'system' ? a.actorRole : 'customer') as 'customer' | 'staff' | 'system',
        action: a.action,
        ...(a.note ? { note: a.note } : {}),
      })),
    ...(row.pickupLocationSlug
      ? { pickupLocationSlug: row.pickupLocationSlug, dropoffLocationSlug: row.dropoffLocationSlug ?? '' }
      : {}),
    ...(row.routeId ? { routeId: row.routeId } : {}),
    ...(row.pickupTime ? { pickupTime: row.pickupTime } : {}),
    ...(row.returnTime ? { returnTime: row.returnTime } : {}),
    quote:
      row.quotedCents !== null && row.quoteCurrency !== null && row.quoteBasis !== null
        ? {
            currency: row.quoteCurrency,
            cents: row.quotedCents,
            ...(row.quoteRoundTripCents !== null ? { roundTripCents: row.quoteRoundTripCents } : {}),
            basis: row.quoteBasis as 'legs' | 'multiplier' | 'manual',
            quotedAt: (row.quotedAt ?? row.updatedAt).toISOString(),
            ...(row.quotePricingMetadata ? { pricingMetadata: readCarPricingMetadata(row.quotePricingMetadata) } : {}),
          }
        : null,
  };
}

/** Staff projection: everything customer-safe plus the linked account. */
export function toStaffView(row: RequestRow): StaffCarRequest {
  const base = toCustomerView(row);
  return {
    ...base,
    activity: [...row.activities]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((a) => ({
        at: a.createdAt.toISOString(),
        by: (a.actorRole === 'staff' || a.actorRole === 'system' ? a.actorRole : 'customer') as 'customer' | 'staff' | 'system',
        action: a.action,
        ...(a.note ? { note: a.note } : {}),
        ...(a.isInternal ? { internal: true as const } : {}),
      })),
    account: row.user ? { email: row.user.email, name: accountName(row) } : null,
  };
}

const rowInclude = {
  activities: true,
  user: { select: { email: true, firstName: true, lastName: true } },
} satisfies Prisma.CarRequestInclude;

const LEGACY_TRANSFER_COLUMNS = {
  pickupLocationSlug: null,
  dropoffLocationSlug: null,
  routeId: null,
  pickupTime: null,
  returnTime: null,
  quoteCurrency: null,
  quotedCents: null,
  quoteBasis: null,
  quoteRoundTripCents: null,
  quotePricingMetadata: null,
  quotedAt: null,
} as const;

function transferDataColumns(transfer: CarRequestTransfer) {
  return {
    pickupLocationSlug: transfer.pickupLocationSlug,
    dropoffLocationSlug: transfer.dropoffLocationSlug,
    routeId: transfer.routeId,
    pickupTime: transfer.pickupTime,
    returnTime: transfer.returnTime,
    quoteCurrency: transfer.quoteCurrency,
    quotedCents: transfer.quotedCents,
    quoteBasis: transfer.quoteBasis,
    quoteRoundTripCents: transfer.quoteRoundTripCents,
    quotePricingMetadata: transfer.quotePricingMetadata,
    quotedAt: transfer.quotedAt,
  } as const;
}

export async function createCarRequestRecord(
  userId: string | null,
  draft: ValidatedCarDraft,
): Promise<CarRequest> {
  // The requested vehicle is a preference only, but it must still point at
  // a real, published fleet vehicle — fabricated or stale slugs are rejected
  // before any record is written.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt += 1) {
    const reference = mintReferenceCandidate();
    try {
      const row = await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT slug FROM cars WHERE slug = ${draft.vehicleSlug} FOR UPDATE`;
        if (!await findPublishedFleetVehicle(draft.vehicleSlug, tx)) throw new CarInputError('Select a vehicle from the fleet list.');
        const transfer = await buildCarRequestTransfer(draft, tx);
        return tx.carRequest.create({
        data: {
          reference,
          userId,
          vehicleSlug: draft.vehicleSlug,
          tripType: TO_DB_TRIP_TYPE[draft.tripType],
          pickup: transfer?.pickup ?? draft.pickup,
          dropoff: transfer?.dropoff ?? draft.dropoff,
          ...(transfer ? transferDataColumns(transfer) : LEGACY_TRANSFER_COLUMNS),
          pickupDate: toDbDate(draft.preferredPickupDate),
          returnDate: draft.preferredReturnDate === '' ? null : toDbDate(draft.preferredReturnDate),
          passengers: draft.passengers,
          contactName: draft.contactName,
          contactEmail: draft.contactEmail,
          contactPhone: draft.contactPhone,
          notes: draft.notes === '' ? null : draft.notes,
          status: 'NEW',
          activities: {
            create: { actorRole: 'customer', action: 'Request created' },
          },
        },
        include: rowInclude,
      });
      });
      const created = toCustomerView(row);
      // Submission receipt for signed-in customers. Guests (userId
      // NULL) are skipped — no account to notify. Staff are always
      // notified (guests included): a new request needs review.
      await notifyUser(userId, {
        type: 'car_request_submitted',
        title: 'Car request received',
        message: `We received your car request ${reference}. Our team will review it shortly.`,
        href: `/account/car-requests/detail?ref=${encodeURIComponent(reference)}`,
      });
      await notifyStaff({
        type: 'admin_car_request_submitted',
        title: 'New car request',
        message: `Car request ${reference} needs review.`,
        href: `/admin/car-requests/${encodeURIComponent(reference)}`,
      });
      // Email receipts (best-effort). Customer copy to the address
      // given at submit (guests included); staff copy to the
      // configured operational recipient.
      await sendCustomerEmailSafe('car_request_submitted', draft.contactEmail, {
        name: draft.contactName,
        reference,
        detailUrl: `/account/car-requests/detail?ref=${encodeURIComponent(reference)}`,
      }, { relatedReference: reference, idempotencyKey: `car_request_submitted:${reference}` });
      await sendStaffEmailSafe('admin_car_request_submitted', {
        name: draft.contactName,
        reference,
        detailUrl: `/admin/car-requests/${encodeURIComponent(reference)}`,
      }, { relatedReference: reference, idempotencyKey: `admin_car_request_submitted:${reference}` });
      return created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new CarInputError('Could not create the request. Please try again.');
}

export async function listCustomerCarRequests(userId: string): Promise<CarRequest[]> {
  const rows = await db.carRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { activities: false, user: false },
  });
  return rows.map((row) =>
    toCustomerView({ ...row, activities: [], user: null }),
  );
}

export async function getCustomerCarRequest(
  userId: string,
  reference: string,
): Promise<CarRequest | null> {
  const row = await db.carRequest.findUnique({
    where: { reference },
    include: rowInclude,
  });
  if (!row || row.userId !== userId) return null;
  return toCustomerView(row);
}

export async function updateCustomerCarRequest(
  userId: string,
  reference: string,
  draft: ValidatedCarDraft,
): Promise<CarRequest | null> {
  const existing = await db.carRequest.findUnique({
    where: { reference },
    include: rowInclude,
  });
  if (!existing || existing.userId !== userId) return null;
  const current = FROM_DB_STATUS[existing.status];
  if (current !== 'new' && current !== 'reviewing') {
    throw new CarInputError('This request can no longer be edited.');
  }
  // No-op saves must not pollute the timeline: when every persisted field
  // already matches the draft, return the current view without writing.
  // (DB NULL and draft '' both mean "not set" for optional fields.)
  const sameStructuredLocations = !!draft.pickupLocationSlug && !!draft.dropoffLocationSlug && existing.pickupLocationSlug === draft.pickupLocationSlug && existing.dropoffLocationSlug === draft.dropoffLocationSlug;
  const unchanged =
    existing.vehicleSlug === draft.vehicleSlug &&    FROM_DB_TRIP_TYPE[existing.tripType] === draft.tripType &&
    (sameStructuredLocations || existing.pickup === draft.pickup) &&
    (sameStructuredLocations || existing.dropoff === draft.dropoff) &&
    toYmd(existing.pickupDate) === draft.preferredPickupDate &&
    toYmd(existing.returnDate) === draft.preferredReturnDate &&
    existing.passengers === draft.passengers &&
    existing.contactName === draft.contactName &&
    existing.contactEmail === draft.contactEmail &&
    existing.contactPhone === draft.contactPhone &&
    (existing.notes ?? '') === draft.notes &&
    (existing.pickupLocationSlug ?? '') === draft.pickupLocationSlug &&
    (existing.dropoffLocationSlug ?? '') === draft.dropoffLocationSlug &&
    (existing.pickupTime ?? '') === draft.pickupTime &&
    (existing.returnTime ?? '') === draft.returnTime;
  if (unchanged) return toCustomerView(existing);
  // Edited drafts must still point at a real, published fleet vehicle —
  // same rule as initial submission.
  // Quote/transfer snapshot is recomputed at edit time so a price change
  // between submission and editing never leaves stale money on the record.
  const row = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM car_requests WHERE id = ${existing.id} FOR UPDATE`;
    const fresh = await tx.carRequest.findUnique({ where: { id: existing.id } });
    if (!fresh || fresh.userId !== userId || !['NEW', 'REVIEWING'].includes(fresh.status)) throw new CarInputError('This request can no longer be edited.');
    await tx.$queryRaw`SELECT slug FROM cars WHERE slug = ${draft.vehicleSlug} FOR UPDATE`;
    if (!await findPublishedFleetVehicle(draft.vehicleSlug, tx)) throw new CarInputError('Select a vehicle from the fleet list.');
    const transfer = await buildCarRequestTransfer(draft, tx);
    await tx.carRequest.update({
      where: { id: existing.id },
      data: {
        vehicleSlug: draft.vehicleSlug,
        tripType: TO_DB_TRIP_TYPE[draft.tripType],
        pickup: transfer?.pickup ?? draft.pickup,
        dropoff: transfer?.dropoff ?? draft.dropoff,
        ...(transfer ? transferDataColumns(transfer) : LEGACY_TRANSFER_COLUMNS),
        pickupDate: toDbDate(draft.preferredPickupDate),
        returnDate: draft.preferredReturnDate === '' ? null : toDbDate(draft.preferredReturnDate),
        passengers: draft.passengers,
        contactName: draft.contactName,
        contactEmail: draft.contactEmail,
        contactPhone: draft.contactPhone,
        notes: draft.notes === '' ? null : draft.notes,
        activities: {
          create: { actorRole: 'customer', action: 'Request updated' },
        },
      },
    });
    return tx.carRequest.findUnique({ where: { id: existing.id }, include: rowInclude });
  });
  if (!row) return null;
  return toCustomerView(row);
}

export async function cancelCustomerCarRequest(
  userId: string,
  reference: string,
): Promise<CarRequest | null> {
  const existing = await db.carRequest.findUnique({
    where: { reference },
    select: { id: true, userId: true, status: true },
  });
  if (!existing || existing.userId !== userId) return null;
  const current = FROM_DB_STATUS[existing.status];
  if (!canTransitionCarRequest(current, 'cancelled')) {
    throw new CarInputError('This request can no longer be cancelled.');
  }
  const row = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM car_requests WHERE id = ${existing.id} FOR UPDATE`;
    const fresh = await tx.carRequest.findUnique({ where: { id: existing.id } });
    if (!fresh || fresh.userId !== userId || fresh.status !== existing.status) throw new CarInputError('This request changed. Reload before cancelling.');
    await tx.carRequest.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELLED',
        activities: {
          create: { actorRole: 'customer', action: labelForCarTransition(current, 'cancelled') },
        },
      },
    });
    return tx.carRequest.findUnique({ where: { id: existing.id }, include: rowInclude });
  });
  if (!row) return null;
  return toCustomerView(row);
}

export async function listStaffCarRequests(): Promise<StaffCarRequest[]> {
  const rows = await db.carRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: { activities: false, user: { select: { email: true, firstName: true, lastName: true } } },
  });
  return rows.map((row) =>
    toStaffView({ ...row, activities: [] }),
  );
}

export async function getStaffCarRequest(reference: string): Promise<StaffCarRequest | null> {
  const row = await db.carRequest.findUnique({
    where: { reference },
    include: rowInclude,
  });
  if (!row) return null;
  return toStaffView(row);
}

export async function transitionStaffCarRequest(
  reference: string,
  to: CarRequestStatus,
  note: string,
  internal: boolean,
): Promise<StaffCarRequest | null> {
  const existing = await db.carRequest.findUnique({
    where: { reference },
    select: { id: true, status: true, userId: true },
  });
  if (!existing) return null;
  const current = FROM_DB_STATUS[existing.status];
  if (!canTransitionCarRequest(current, to)) {
    throw new CarInputError('This status change is not allowed.');
  }
  if (note.length > CAR_NOTE_MAX || hasControlChars(note)) {
    throw new CarInputError('Notes must be 1,000 characters or fewer.');
  }
  const row = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM car_requests WHERE id = ${existing.id} FOR UPDATE`;
    const currentRow = await tx.carRequest.findUnique({ where: { id: existing.id } });
    if (!currentRow || currentRow.status !== existing.status) throw new CarInputError('This request changed. Reload before updating.');
    if (to === 'confirmed') {
      // Server-side integrity (mirrors the UI hint): confirming requires a
      // real, published assigned vehicle with unambiguous capacity for the
      // requested passengers. Validated inside the transaction against the
      // fresh assignment so a concurrent reassignment cannot slip past;
      // non-confirmed transitions stay unchanged.
      const fresh = await tx.carRequest.findUnique({
        where: { id: existing.id },
        select: { passengers: true, assignedVehicleSlug: true },
      });
      if (!fresh) throw new CarInputError('This status change is not allowed.');
      await assertConfirmableAssignment(fresh, tx);
    }
    await tx.carRequest.update({
      where: { id: existing.id },
      data: {
        status: TO_DB_STATUS[to],
        activities: {
          create: {
            actorRole: 'staff',
            action: labelForCarTransition(current, to),
            note: note === '' ? null : note,
            isInternal: note === '' ? false : internal,
          },
        },
      },
    });
    return tx.carRequest.findUnique({ where: { id: existing.id }, include: rowInclude });
  });
  if (!row) return null;
  // Customer-visible outcomes only. The transition guard rejects
  // repeats, so each status notifies at most once. Internal notes
  // and vehicle assignment never notify.
  if (to === 'confirmed' || to === 'cancelled') {
    await notifyUser(existing.userId, {
      type: 'car_request_update',
      ...(to === 'confirmed'
        ? { title: 'Car request confirmed', message: `Your car request ${reference} is confirmed. View the details here.` }
        : { title: 'Car request cancelled', message: `Your car request ${reference} was cancelled. Contact us if you need anything else.` }),
      href: `/account/car-requests/detail?ref=${encodeURIComponent(reference)}`,
    });
    // Status-change email to the request contact snapshot (guests
    // included). Transition guard rejects repeats; idempotency key
    // adds a second layer against duplicate sends.
    await sendCustomerEmailSafe('car_request_update', row.contactEmail, {
      name: row.contactName,
      reference,
      status: to,
      detailUrl: `/account/car-requests/detail?ref=${encodeURIComponent(reference)}`,
    }, { relatedReference: reference, idempotencyKey: `car_request_update:${reference}:${to}` });
  }
  return toStaffView(row);
}

export async function assignStaffCarVehicle(
  reference: string,
  vehicleSlug: string,
): Promise<StaffCarRequest | null> {
  const slug = vehicleSlug.trim();
  // Assignment must resolve to a real, published fleet vehicle. Hidden or
  // unknown slugs are rejected; existing rows keep their stored slugs.
  if (!SLUG_PATTERN.test(slug)) throw new CarInputError('Select a vehicle from the fleet list.');
  const resolved = await findPublishedFleetVehicle(slug);
  if (!resolved) {
    const row = await db.car.findUnique({ where: { slug }, select: { isPublished: true } });
    if (row && !row.isPublished) {
      throw new CarInputError('This vehicle is hidden from the website. Publish it before assigning.');
    }
    throw new CarInputError('Select a vehicle from the fleet list.');
  }
  const existing = await db.carRequest.findUnique({
    where: { reference },
    select: { id: true, status: true },
  });
  if (!existing) return null;
  if (FROM_DB_STATUS[existing.status] === 'cancelled') {
    throw new CarInputError('Cancelled requests cannot be changed.');
  }
  const row = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM car_requests WHERE id = ${existing.id} FOR UPDATE`;
    const fresh = await tx.carRequest.findUnique({ where: { id: existing.id } });
    if (!fresh || fresh.status === 'CANCELLED') throw new CarInputError('Cancelled requests cannot be changed.');
    await tx.$queryRaw`SELECT slug FROM cars WHERE slug = ${slug} FOR UPDATE`;
    if (!await findPublishedFleetVehicle(slug, tx)) throw new CarInputError('Select a vehicle from the fleet list.');
    if (fresh.status === 'CONFIRMED') await assertConfirmableAssignment({ assignedVehicleSlug: slug, passengers: fresh.passengers }, tx);
    await tx.carRequest.update({
      where: { id: existing.id },
      data: {
        assignedVehicleSlug: slug,
        activities: {
          create: { actorRole: 'staff', action: 'Assigned vehicle updated', note: slug },
        },
      },
    });
    return tx.carRequest.findUnique({ where: { id: existing.id }, include: rowInclude });
  });
  if (!row) return null;
  return toStaffView(row);
}

export async function addStaffCarNote(reference: string, note: string): Promise<StaffCarRequest | null> {
  const trimmed = note.trim();
  if (trimmed === '' || trimmed.length > CAR_NOTE_MAX || hasControlChars(trimmed)) {
    throw new CarInputError('Enter an internal note (1,000 characters or fewer).');
  }
  const existing = await db.carRequest.findUnique({
    where: { reference },
    select: { id: true },
  });
  if (!existing) return null;
  const row = await db.$transaction(async (tx) => {
    await tx.carRequest.update({
      where: { id: existing.id },
      data: {
        activities: {
          create: { actorRole: 'staff', action: 'Internal note added', note: trimmed, isInternal: true },
        },
      },
    });
    return tx.carRequest.findUnique({ where: { id: existing.id }, include: rowInclude });
  });
  if (!row) return null;
  return toStaffView(row);
}
