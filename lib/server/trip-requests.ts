// Trip-request domain service (Phase 2B). Server owns validation,
// reference issuance, ownership, status lifecycle, and response shaping.
// The browser never supplies userId, status, references, or internal notes.
import 'server-only';

import { randomInt } from 'node:crypto';
import { Prisma, TripRequestStatus as DbStatus, TripRequestTimeMode as DbTimeMode } from '@prisma/client';

import { db } from './db';
import {
  isValidCountryCode,
  isValidEmail,
  isValidPhone,
  isValidYmd,
  normalizeEmail,
  normalizePhone,
} from '../core/validation';
import {
  canTransitionTripRequest,
  labelForTransition,
  TRIP_BUDGET_CAP,
  TRIP_EMAIL_MAX,
  TRIP_NAME_MAX,
  TRIP_NOTE_MAX,
  TRIP_PHONE_MAX,
  TRIP_TRAVELER_MAX,
  type StaffTripRequest,
  type TripRequest,
  type TripRequestStatus,
  type TripTimeMode,
} from '@/lib/trip-request';
import { destinations } from '@/data/content';
import { findTour } from '@/data/tours';

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const REF_ATTEMPTS = 5;

function mintReferenceCandidate(): string {
  let suffix = '';
  for (let i = 0; i < 6; i += 1) suffix += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `SP-TR-${suffix}`;
}

const TO_DB_STATUS: Record<TripRequestStatus, DbStatus> = {
  new: 'NEW',
  reviewing: 'REVIEWING',
  proposal_ready: 'PROPOSAL_READY',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  cancelled: 'CANCELLED',
};

const FROM_DB_STATUS: Record<DbStatus, TripRequestStatus> = {
  NEW: 'new',
  REVIEWING: 'reviewing',
  PROPOSAL_READY: 'proposal_ready',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

const TO_DB_TIME_MODE: Record<TripTimeMode, DbTimeMode> = {
  exact: 'EXACT',
  approx: 'APPROX',
  unsure: 'UNSURE',
};

const FROM_DB_TIME_MODE: Record<DbTimeMode, TripTimeMode> = {
  EXACT: 'exact',
  APPROX: 'approx',
  UNSURE: 'unsure',
};

function hasControlChars(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/** Shore-excursion requests anchor to a single ship-call date. */
export function isShoreTour(tourSlug: string): boolean {
  if (!tourSlug) return false;
  return findTour(tourSlug)?.category === 'shore-excursions';
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

export interface ValidatedTripDraft {  destinationSlug: string;
  tourSlug: string;
  customTitle: string;
  requestedAddOns: string[];
  timeMode: TripTimeMode;
  preferredFrom: string;
  preferredTo: string;
  adults: number;
  children: number;
  infants: number;
  budgetMin: number;
  budgetMax: number;
  currency: 'USD' | 'EUR' | 'EGP';
  flightOffer: boolean;
  nationality: string;
  dialCode: string;
  notes: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

const DRAFT_KEYS = new Set([
  'destinationSlug',
  'tourSlug',
  'customTitle',
  'requestedAddOns',
  'timeMode',
  'preferredFrom',
  'preferredTo',
  'adults',
  'children',
  'infants',
  'budgetMin',
  'budgetMax',
  'currency',
  'flightOffer',
  'nationality',
  'dialCode',
  'notes',
  'contact',
]);

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function count(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return null;
  return value;
}

/**
 * Strict server validation mirroring the product contract. Unknown keys are
 * rejected (no mass assignment); ownership/status/reference fields are never
 * read from the body — the signature takes no such input.
 */
export function validateTripDraft(input: unknown, opts?: { isShore?: boolean }): ValidatedTripDraft {
  if (typeof input !== 'object' || input === null) throw new Error('Invalid request.');
  const body = input as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!DRAFT_KEYS.has(key)) throw new Error('Invalid request.');
  }
  const fail = (message: string): never => {
    throw new Error(message);
  };

  const destinationSlug = text(body.destinationSlug)?.trim() ?? '';
  if (destinationSlug !== '' && !destinations.some((d) => d.slug === destinationSlug)) {
    fail('Choose a valid destination.');
  }
  const tourSlug = text(body.tourSlug)?.trim() ?? '';
  const tour = tourSlug === '' ? null : findTour(tourSlug);
  if (tourSlug !== '' && !tour) fail('Choose a valid tour.');
  const customTitle = text(body.customTitle)?.trim() ?? '';
  if (customTitle !== '' && (customTitle.length > 120 || hasControlChars(customTitle))) {
    fail('Trip name is too long.');
  }
  if (destinationSlug === '' && tourSlug === '' && customTitle === '') {
    fail('Choose a destination, tour, or trip name.');
  }

  const addOnsRaw = body.requestedAddOns;
  if (!Array.isArray(addOnsRaw)) fail('Invalid request.');
  const requestedAddOns = (addOnsRaw as unknown[]).map((entry) => {
    if (typeof entry !== 'string') fail('Invalid request.');
    const title = (entry as string).trim();
    if (title === '' || title.length > 160 || hasControlChars(title)) fail('Invalid request.');
    return title;
  });
  if (requestedAddOns.length > 20) fail('Too many add-ons.');

  const timeMode = text(body.timeMode);
  if (timeMode !== 'exact' && timeMode !== 'approx' && timeMode !== 'unsure') fail('Invalid request.');

  const validYmd = (value: string): boolean => {
    if (!isValidYmd(value)) return false;
    const year = Number(value.slice(0, 4));
    return year >= 2000 && year <= 2100;
  };
  const preferredFrom = text(body.preferredFrom)?.trim() ?? '';
  let preferredTo = text(body.preferredTo)?.trim() ?? '';
  // Shore-excursion requests anchor to a single ship-call date.
  if (opts?.isShore) preferredTo = preferredFrom;
  if (preferredFrom !== '' && !validYmd(preferredFrom)) fail('Enter a valid preferred start date.');
  if (preferredTo !== '' && !validYmd(preferredTo)) fail('Enter a valid preferred end date.');
  const today = utcToday();
  if (timeMode === 'exact') {
    if (preferredFrom === '') fail('Enter your preferred start date.');
    if (preferredFrom < today) fail('Preferred dates must be today or later.');
    if (!opts?.isShore) {
      if (preferredTo === '') fail('Enter your preferred end date.');
      if (preferredTo < today) fail('Preferred dates must be today or later.');
    }
  } else {
    if (preferredFrom !== '' && preferredFrom < today) fail('Preferred dates must be today or later.');
    if (preferredTo !== '' && preferredTo < today) fail('Preferred dates must be today or later.');
  }
  if (preferredFrom !== '' && preferredTo !== '' && preferredTo < preferredFrom) {
    fail('The end date must be on or after the start date.');
  }

  const adults = count(body.adults);
  const children = count(body.children);
  const infants = count(body.infants);
  if (
    adults === null || children === null || infants === null ||
    adults < 1 || adults > TRIP_TRAVELER_MAX ||
    children < 0 || children > TRIP_TRAVELER_MAX ||
    infants < 0 || infants > TRIP_TRAVELER_MAX
  ) {
    fail('Travelers must include at least 1 adult (max 50 per group).');
  }

  const budgetMin = typeof body.budgetMin === 'number' && Number.isFinite(body.budgetMin)
    ? Math.round(body.budgetMin)
    : null;
  const budgetMax = typeof body.budgetMax === 'number' && Number.isFinite(body.budgetMax)
    ? Math.round(body.budgetMax)
    : null;
  if (
    budgetMin === null || budgetMax === null ||
    budgetMin < 0 || budgetMax < 0 ||
    budgetMin > TRIP_BUDGET_CAP || budgetMax > TRIP_BUDGET_CAP ||
    budgetMin > budgetMax
  ) {
    fail('Preferred budget must be between 0 and 10,000 with min below max.');
  }

  const currency = text(body.currency);
  if (currency !== 'USD' && currency !== 'EUR' && currency !== 'EGP') fail('Invalid request.');
  if (typeof body.flightOffer !== 'boolean') fail('Invalid request.');

  const nationality = (text(body.nationality)?.trim() ?? '').toUpperCase();
  if (!isValidCountryCode(nationality)) fail('Choose your nationality.');
  const dialCode = text(body.dialCode)?.trim() ?? '';
  if (!/^\+?\d{1,7}$/.test(dialCode)) fail('Enter a valid phone number.');

  const notes = text(body.notes) ?? '';
  if (notes.length > TRIP_NOTE_MAX || hasControlChars(notes)) fail('Notes must be 1,000 characters or fewer.');

  const contact = body.contact;
  if (typeof contact !== 'object' || contact === null) fail('Invalid request.');
  const contactRecord = contact as Record<string, unknown>;
  for (const key of Object.keys(contactRecord)) {
    if (key !== 'name' && key !== 'email' && key !== 'phone') fail('Invalid request.');
  }
  const contactName = text(contactRecord.name)?.trim() ?? '';
  if (
    contactName === '' || contactName.length > TRIP_NAME_MAX ||
    contactName.length < 2 ||
    /^\d+$/.test(contactName.replace(/[\s.'-]+/g, '')) ||
    hasControlChars(contactName)
  ) {
    fail('Enter a name with at least 2 letters.');
  }
  const contactEmail = normalizeEmail(text(contactRecord.email) ?? '');
  if (contactEmail === '' || contactEmail.length > TRIP_EMAIL_MAX || !isValidEmail(contactEmail)) {
    fail('Enter a valid email address.');
  }
  const contactPhoneRaw = text(contactRecord.phone)?.trim() ?? '';
  if (!isValidPhone(contactPhoneRaw)) fail('Enter a valid phone number.');

  return {
    destinationSlug,
    tourSlug,
    customTitle,
    requestedAddOns,
    timeMode: timeMode as TripTimeMode,
    preferredFrom,
    preferredTo,
    adults: adults as number,
    children: children as number,
    infants: infants as number,
    budgetMin: budgetMin as number,
    budgetMax: budgetMax as number,
    currency: currency as 'USD' | 'EUR' | 'EGP',
    flightOffer: body.flightOffer as boolean,
    nationality,
    dialCode,
    notes,
    contactName,
    contactEmail,
    contactPhone: normalizePhone(contactPhoneRaw),
  };
}

type RequestRow = Prisma.TripRequestGetPayload<{
  include: { activities: true; user: { select: { email: true; firstName: true; lastName: true } } };
}>;

function accountName(row: RequestRow): string {
  if (!row.user) return '';
  const full = `${row.user.firstName ?? ''} ${row.user.lastName ?? ''}`.trim();
  return full || row.user.email;
}

function parseAddOns(stored: string): string[] {
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string').slice(0, 20);
  } catch {
    return [];
  }
}

/**
 * Customer-safe projection: no database IDs, no user linkage, no internal
 * activity. Internal activity rows are excluded entirely so staff notes
 * never reach customer responses.
 */
export function toCustomerView(row: RequestRow): TripRequest {
  return {
    reference: row.reference,
    destinationSlug: row.destinationSlug ?? '',
    tourSlug: row.tourSlug ?? '',
    customTitle: row.customTitle ?? '',
    requestedAddOns: parseAddOns(row.requestedAddOns),
    timeMode: FROM_DB_TIME_MODE[row.timeMode],
    preferredFrom: toYmd(row.preferredFrom),
    preferredTo: toYmd(row.preferredTo),
    adults: row.adults,
    children: row.children,
    infants: row.infants,
    budgetMin: row.budgetMin,
    budgetMax: row.budgetMax,
    currency: row.budgetCurrency as 'USD' | 'EUR' | 'EGP',
    flightOffer: row.flightOffer,
    contact: {
      name: row.contactName,
      email: row.contactEmail,
      phone: row.contactPhone,
      dialCode: row.contactDialCode,
      nationality: row.nationality,
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
export function toStaffView(row: RequestRow): StaffTripRequest {
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
} satisfies Prisma.TripRequestInclude;

export async function createTripRequestRecord(
  userId: string | null,
  draft: ValidatedTripDraft,
): Promise<TripRequest> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt += 1) {
    const reference = mintReferenceCandidate();
    try {
      const row = await db.tripRequest.create({
        data: {
          reference,
          userId,
          contactName: draft.contactName,
          contactEmail: draft.contactEmail,
          contactPhone: draft.contactPhone,
          contactDialCode: draft.dialCode,
          nationality: draft.nationality,
          destinationSlug: draft.destinationSlug || null,
          tourSlug: draft.tourSlug || null,
          customTitle: draft.customTitle || null,
          requestedAddOns: JSON.stringify(draft.requestedAddOns),
          timeMode: TO_DB_TIME_MODE[draft.timeMode],
          preferredFrom: draft.preferredFrom === '' ? null : toDbDate(draft.preferredFrom),
          preferredTo: draft.preferredTo === '' ? null : toDbDate(draft.preferredTo),
          adults: draft.adults,
          children: draft.children,
          infants: draft.infants,
          budgetMin: draft.budgetMin,
          budgetMax: draft.budgetMax,
          budgetCurrency: draft.currency,
          flightOffer: draft.flightOffer,
          notes: draft.notes === '' ? null : draft.notes,
          status: 'NEW',
          activities: {
            create: { actorRole: 'customer', action: 'Request created' },
          },
        },
        include: rowInclude,
      });
      return toCustomerView(row);
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

export async function listCustomerTripRequests(userId: string): Promise<TripRequest[]> {
  const rows = await db.tripRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { activities: false, user: false },
  });
  return rows.map((row) =>
    toCustomerView({ ...row, activities: [], user: null }),
  );
}

export async function getCustomerTripRequest(
  userId: string,
  reference: string,
): Promise<TripRequest | null> {
  const row = await db.tripRequest.findUnique({
    where: { reference },
    include: rowInclude,
  });
  if (!row || row.userId !== userId) return null;
  return toCustomerView(row);
}

export async function updateCustomerTripRequest(
  userId: string,
  reference: string,
  draft: ValidatedTripDraft,
): Promise<TripRequest | null> {
  const existing = await db.tripRequest.findUnique({
    where: { reference },
    select: { id: true, userId: true, status: true },
  });
  if (!existing || existing.userId !== userId) return null;
  const current = FROM_DB_STATUS[existing.status];
  if (current !== 'new' && current !== 'reviewing') {
    throw new Error('This request can no longer be edited.');
  }
  const row = await db.$transaction(async (tx) => {
    await tx.tripRequest.update({
      where: { id: existing.id },
      data: {
        contactName: draft.contactName,
        contactEmail: draft.contactEmail,
        contactPhone: draft.contactPhone,
        contactDialCode: draft.dialCode,
        nationality: draft.nationality,
        destinationSlug: draft.destinationSlug || null,
        tourSlug: draft.tourSlug || null,
        customTitle: draft.customTitle || null,
        requestedAddOns: JSON.stringify(draft.requestedAddOns),
        timeMode: TO_DB_TIME_MODE[draft.timeMode],
        preferredFrom: draft.preferredFrom === '' ? null : toDbDate(draft.preferredFrom),
        preferredTo: draft.preferredTo === '' ? null : toDbDate(draft.preferredTo),
        adults: draft.adults,
        children: draft.children,
        infants: draft.infants,
        budgetMin: draft.budgetMin,
        budgetMax: draft.budgetMax,
        budgetCurrency: draft.currency,
        flightOffer: draft.flightOffer,
        notes: draft.notes === '' ? null : draft.notes,
        activities: {
          create: { actorRole: 'customer', action: 'Request updated' },
        },
      },
    });
    return tx.tripRequest.findUnique({ where: { id: existing.id }, include: rowInclude });
  });
  if (!row) return null;
  return toCustomerView(row);
}

export async function cancelCustomerTripRequest(
  userId: string,
  reference: string,
): Promise<TripRequest | null> {
  const existing = await db.tripRequest.findUnique({
    where: { reference },
    select: { id: true, userId: true, status: true },
  });
  if (!existing || existing.userId !== userId) return null;
  const current = FROM_DB_STATUS[existing.status];
  if (!canTransitionTripRequest(current, 'cancelled')) {
    throw new Error('This request can no longer be cancelled.');
  }
  const row = await db.$transaction(async (tx) => {
    await tx.tripRequest.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELLED',
        activities: {
          create: { actorRole: 'customer', action: labelForTransition(current, 'cancelled') },
        },
      },
    });
    return tx.tripRequest.findUnique({ where: { id: existing.id }, include: rowInclude });
  });
  if (!row) return null;
  return toCustomerView(row);
}

export async function listStaffTripRequests(): Promise<StaffTripRequest[]> {
  const rows = await db.tripRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: { activities: false, user: { select: { email: true, firstName: true, lastName: true } } },
  });
  return rows.map((row) =>
    toStaffView({ ...row, activities: [] }),
  );
}

export async function getStaffTripRequest(reference: string): Promise<StaffTripRequest | null> {
  const row = await db.tripRequest.findUnique({
    where: { reference },
    include: rowInclude,
  });
  if (!row) return null;
  return toStaffView(row);
}

export async function transitionStaffTripRequest(
  reference: string,
  to: TripRequestStatus,
  note: string,
  internal: boolean,
): Promise<StaffTripRequest | null> {
  const existing = await db.tripRequest.findUnique({
    where: { reference },
    select: { id: true, status: true },
  });
  if (!existing) return null;
  const current = FROM_DB_STATUS[existing.status];
  if (!canTransitionTripRequest(current, to)) {
    throw new Error('This status change is not allowed.');
  }
  if (note.length > TRIP_NOTE_MAX || hasControlChars(note)) {
    throw new Error('Notes must be 1,000 characters or fewer.');
  }
  const row = await db.$transaction(async (tx) => {
    await tx.tripRequest.update({
      where: { id: existing.id },
      data: {
        status: TO_DB_STATUS[to],
        activities: {
          create: {
            actorRole: 'staff',
            action: labelForTransition(current, to),
            note: note === '' ? null : note,
            isInternal: note === '' ? false : internal,
          },
        },
      },
    });
    return tx.tripRequest.findUnique({ where: { id: existing.id }, include: rowInclude });
  });
  if (!row) return null;
  return toStaffView(row);
}

export async function addStaffTripNote(reference: string, note: string): Promise<StaffTripRequest | null> {
  const trimmed = note.trim();
  if (trimmed === '' || trimmed.length > TRIP_NOTE_MAX || hasControlChars(trimmed)) {
    throw new Error('Enter an internal note (1,000 characters or fewer).');
  }
  const existing = await db.tripRequest.findUnique({
    where: { reference },
    select: { id: true },
  });
  if (!existing) return null;
  const row = await db.$transaction(async (tx) => {
    await tx.tripRequest.update({
      where: { id: existing.id },
      data: {
        activities: {
          create: { actorRole: 'staff', action: 'Internal note added', note: trimmed, isInternal: true },
        },
      },
    });
    return tx.tripRequest.findUnique({ where: { id: existing.id }, include: rowInclude });
  });
  if (!row) return null;
  return toStaffView(row);
}
