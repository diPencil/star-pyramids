// Car-request domain service (Phase 2C). Server owns validation,
// reference issuance, ownership, status lifecycle, and response shaping.
// The browser never supplies userId, status, references, or internal notes.
//
// NOTE: vehicle slugs are validated by shape only (pattern + length).
// Admin fleet customizations live in browser-local overrides, so the server
// cannot resolve fleet membership; the UI resolves titles with a slug
// fallback instead.
import 'server-only';

import { randomInt } from 'node:crypto';
import { Prisma, CarRequestStatus as DbStatus, CarTripType as DbTripType } from '@prisma/client';

import { db } from './db';
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
  if (typeof input !== 'object' || input === null) throw new Error('Invalid request.');
  const body = input as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!DRAFT_KEYS.has(key)) throw new Error('Invalid request.');
  }
  const fail = (message: string): never => {
    throw new Error(message);
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

export async function createCarRequestRecord(
  userId: string | null,
  draft: ValidatedCarDraft,
): Promise<CarRequest> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt += 1) {
    const reference = mintReferenceCandidate();
    try {
      const row = await db.carRequest.create({
        data: {
          reference,
          userId,
          vehicleSlug: draft.vehicleSlug,
          tripType: TO_DB_TRIP_TYPE[draft.tripType],
          pickup: draft.pickup,
          dropoff: draft.dropoff,
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
      return created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not create the request. Please try again.');
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
    throw new Error('This request can no longer be edited.');
  }
  // No-op saves must not pollute the timeline: when every persisted field
  // already matches the draft, return the current view without writing.
  // (DB NULL and draft '' both mean "not set" for optional fields.)
  const unchanged =
    existing.vehicleSlug === draft.vehicleSlug &&
    FROM_DB_TRIP_TYPE[existing.tripType] === draft.tripType &&
    existing.pickup === draft.pickup &&
    existing.dropoff === draft.dropoff &&
    toYmd(existing.pickupDate) === draft.preferredPickupDate &&
    toYmd(existing.returnDate) === draft.preferredReturnDate &&
    existing.passengers === draft.passengers &&
    existing.contactName === draft.contactName &&
    existing.contactEmail === draft.contactEmail &&
    existing.contactPhone === draft.contactPhone &&
    (existing.notes ?? '') === draft.notes;
  if (unchanged) return toCustomerView(existing);
  const row = await db.$transaction(async (tx) => {
    await tx.carRequest.update({
      where: { id: existing.id },
      data: {
        vehicleSlug: draft.vehicleSlug,
        tripType: TO_DB_TRIP_TYPE[draft.tripType],
        pickup: draft.pickup,
        dropoff: draft.dropoff,
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
    throw new Error('This request can no longer be cancelled.');
  }
  const row = await db.$transaction(async (tx) => {
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
    throw new Error('This status change is not allowed.');
  }
  if (note.length > CAR_NOTE_MAX || hasControlChars(note)) {
    throw new Error('Notes must be 1,000 characters or fewer.');
  }
  const row = await db.$transaction(async (tx) => {
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
  }
  return toStaffView(row);
}

export async function assignStaffCarVehicle(
  reference: string,
  vehicleSlug: string,
): Promise<StaffCarRequest | null> {
  const slug = vehicleSlug.trim();
  if (!SLUG_PATTERN.test(slug)) throw new Error('Select a vehicle from the fleet list.');
  const existing = await db.carRequest.findUnique({
    where: { reference },
    select: { id: true, status: true },
  });
  if (!existing) return null;
  if (FROM_DB_STATUS[existing.status] === 'cancelled') {
    throw new Error('Cancelled requests cannot be changed.');
  }
  const row = await db.$transaction(async (tx) => {
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
    throw new Error('Enter an internal note (1,000 characters or fewer).');
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
