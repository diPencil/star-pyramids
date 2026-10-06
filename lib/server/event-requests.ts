// Event-request domain service (Phase 2D). Server owns validation,
// reference issuance, ownership, status lifecycle, and response shaping.
// The browser never supplies userId, status, references, or internal notes.
import 'server-only';

import { randomInt } from 'node:crypto';
import { Prisma, EventRequestStatus as DbStatus } from '@prisma/client';

import { db } from './db';
import {
  isValidCountryCode,
  isValidEmail,
  isValidPersonName,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
} from '../core/validation';
import {
  canTransitionEventRequest,
  labelForEventTransition,
  EVENT_ATTENDEES_MAX,
  EVENT_DATE_MAX,
  EVENT_EMAIL_MAX,
  EVENT_LOCATION_MAX,
  EVENT_NAME_MAX,
  EVENT_NOTE_MAX,
  EVENT_PHONE_MAX,
  EVENT_TITLE_MAX,
  type EventRequest,
  type EventRequestStatus,
  type StaffEventRequest,
} from '@/lib/event-request';
import { notifyUser } from './notifications';

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const REF_ATTEMPTS = 5;

function mintReferenceCandidate(): string {
  let suffix = '';
  for (let i = 0; i < 6; i += 1) suffix += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `SP-ER-${suffix}`;
}

const TO_DB_STATUS: Record<EventRequestStatus, DbStatus> = {
  new: 'NEW',
  reviewing: 'REVIEWING',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  cancelled: 'CANCELLED',
};

const FROM_DB_STATUS: Record<DbStatus, EventRequestStatus> = {
  NEW: 'new',
  REVIEWING: 'reviewing',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/;
const DIAL_CODE_PATTERN = /^\+?\d{1,8}$/;

function hasControlChars(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

export interface ValidatedEventDraft {
  eventSlug: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  attendees: number;
  note: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  dialCode: string;
  nationality: string;
}

const DRAFT_KEYS = new Set([
  'eventSlug',
  'eventTitle',
  'eventDate',
  'eventLocation',
  'attendees',
  'note',
  'name',
  'nationality',
  'dialCode',
  'phone',
  'email',
]);

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Strict server validation mirroring the product contract. Unknown keys are
 * rejected (no mass assignment); ownership/status/reference fields are never
 * read from the body — the signature takes no such input.
 */
export function validateEventDraft(input: unknown): ValidatedEventDraft {
  if (typeof input !== 'object' || input === null) throw new Error('Invalid request.');
  const body = input as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!DRAFT_KEYS.has(key)) throw new Error('Invalid request.');
  }
  const fail = (message: string): never => {
    throw new Error(message);
  };

  const eventSlug = text(body.eventSlug)?.trim() ?? '';
  if (!SLUG_PATTERN.test(eventSlug)) fail('Select a valid event.');

  const eventTitle = text(body.eventTitle)?.trim() ?? '';
  if (eventTitle === '' || eventTitle.length > EVENT_TITLE_MAX || hasControlChars(eventTitle)) {
    fail('Invalid request.');
  }
  const eventDate = text(body.eventDate)?.trim() ?? '';
  if (eventDate === '' || eventDate.length > EVENT_DATE_MAX || hasControlChars(eventDate)) {
    fail('Invalid request.');
  }
  const eventLocation = text(body.eventLocation)?.trim() ?? '';
  if (eventLocation === '' || eventLocation.length > EVENT_LOCATION_MAX || hasControlChars(eventLocation)) {
    fail('Invalid request.');
  }

  const attendees = body.attendees;
  if (typeof attendees !== 'number' || !Number.isSafeInteger(attendees) || attendees < 1 || attendees > EVENT_ATTENDEES_MAX) {
    fail('Attendees must be a whole number from 1 to 50.');
  }

  const note = text(body.note) ?? '';
  if (note.length > EVENT_NOTE_MAX || hasControlChars(note)) fail('Notes must be 1,000 characters or fewer.');

  const contactName = text(body.name)?.trim() ?? '';
  if (!isValidPersonName(contactName) || contactName.length > EVENT_NAME_MAX) {
    fail('Enter your full name.');
  }
  const contactEmail = normalizeEmail(text(body.email) ?? '');
  if (contactEmail === '' || contactEmail.length > EVENT_EMAIL_MAX || !isValidEmail(contactEmail)) {
    fail('Enter a valid email address.');
  }
  const contactPhoneRaw = text(body.phone)?.trim() ?? '';
  const phoneDigits = contactPhoneRaw.replace(/\D/g, '');
  if (!isValidPhone(contactPhoneRaw) || phoneDigits.length < 7 || contactPhoneRaw.length > EVENT_PHONE_MAX) {
    fail('Enter a valid phone number.');
  }
  const dialCode = text(body.dialCode)?.trim() ?? '';
  if (!DIAL_CODE_PATTERN.test(dialCode)) fail('Invalid request.');
  const nationality = text(body.nationality)?.trim().toUpperCase() ?? '';
  if (!isValidCountryCode(nationality)) fail('Select your nationality.');

  return {
    eventSlug,
    eventTitle,
    eventDate,
    eventLocation,
    attendees: attendees as number,
    note,
    contactName,
    contactEmail,
    contactPhone: normalizePhone(contactPhoneRaw),
    dialCode,
    nationality,
  };
}

type RequestRow = Prisma.EventRequestGetPayload<{
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
export function toCustomerView(row: RequestRow): EventRequest {
  return {
    reference: row.reference,
    eventSlug: row.eventSlug,
    eventTitle: row.eventTitle,
    eventDate: row.eventDate,
    eventLocation: row.eventLocation,
    attendees: row.attendees,
    contact: {
      name: row.contactName,
      email: row.contactEmail,
      phone: row.contactPhone,
    },
    nationality: row.nationality,
    dialCode: row.contactDialCode,
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
export function toStaffView(row: RequestRow): StaffEventRequest {
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
} satisfies Prisma.EventRequestInclude;

export async function createEventRequestRecord(
  userId: string | null,
  draft: ValidatedEventDraft,
): Promise<EventRequest> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt += 1) {
    const reference = mintReferenceCandidate();
    try {
      const row = await db.eventRequest.create({
        data: {
          reference,
          userId,
          eventSlug: draft.eventSlug,
          eventTitle: draft.eventTitle,
          eventDate: draft.eventDate,
          eventLocation: draft.eventLocation,
          attendees: draft.attendees,
          contactName: draft.contactName,
          contactEmail: draft.contactEmail,
          contactPhone: draft.contactPhone,
          contactDialCode: draft.dialCode,
          nationality: draft.nationality,
          notes: draft.note === '' ? null : draft.note,
          status: 'NEW',
          activities: {
            create: { actorRole: 'customer', action: 'Request created' },
          },
        },
        include: rowInclude,
      });
      const created = toCustomerView(row);
      // Submission receipt for signed-in customers. Guests (userId
      // NULL) are skipped — no account to notify.
      await notifyUser(userId, {
        type: 'event_request_submitted',
        title: 'Event request received',
        message: `We received your event request ${reference}. Our team will review it shortly.`,
        href: `/account/event-requests/detail?ref=${encodeURIComponent(reference)}`,
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

export async function listCustomerEventRequests(userId: string): Promise<EventRequest[]> {
  const rows = await db.eventRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { activities: false, user: false },
  });
  return rows.map((row) =>
    toCustomerView({ ...row, activities: [], user: null }),
  );
}

export async function getCustomerEventRequest(
  userId: string,
  reference: string,
): Promise<EventRequest | null> {
  const row = await db.eventRequest.findUnique({
    where: { reference },
    include: rowInclude,
  });
  if (!row || row.userId !== userId) return null;
  return toCustomerView(row);
}

export async function cancelCustomerEventRequest(
  userId: string,
  reference: string,
): Promise<EventRequest | null> {
  const existing = await db.eventRequest.findUnique({
    where: { reference },
    select: { id: true, userId: true, status: true },
  });
  if (!existing || existing.userId !== userId) return null;
  const current = FROM_DB_STATUS[existing.status];
  if (!canTransitionEventRequest(current, 'cancelled')) {
    throw new Error('This request can no longer be cancelled.');
  }
  const row = await db.$transaction(async (tx) => {
    await tx.eventRequest.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELLED',
        activities: {
          create: { actorRole: 'customer', action: labelForEventTransition(current, 'cancelled') },
        },
      },
    });
    return tx.eventRequest.findUnique({ where: { id: existing.id }, include: rowInclude });
  });
  if (!row) return null;
  return toCustomerView(row);
}

export async function listStaffEventRequests(): Promise<StaffEventRequest[]> {
  const rows = await db.eventRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: { activities: false, user: { select: { email: true, firstName: true, lastName: true } } },
  });
  return rows.map((row) =>
    toStaffView({ ...row, activities: [] }),
  );
}

export async function getStaffEventRequest(reference: string): Promise<StaffEventRequest | null> {
  const row = await db.eventRequest.findUnique({
    where: { reference },
    include: rowInclude,
  });
  if (!row) return null;
  return toStaffView(row);
}

export async function transitionStaffEventRequest(
  reference: string,
  to: EventRequestStatus,
  note: string,
  internal: boolean,
): Promise<StaffEventRequest | null> {
  const existing = await db.eventRequest.findUnique({
    where: { reference },
    select: { id: true, status: true, userId: true },
  });
  if (!existing) return null;
  const current = FROM_DB_STATUS[existing.status];
  if (!canTransitionEventRequest(current, to)) {
    throw new Error('This status change is not allowed.');
  }
  if (note.length > EVENT_NOTE_MAX || hasControlChars(note)) {
    throw new Error('Notes must be 1,000 characters or fewer.');
  }
  const row = await db.$transaction(async (tx) => {
    await tx.eventRequest.update({
      where: { id: existing.id },
      data: {
        status: TO_DB_STATUS[to],
        activities: {
          create: {
            actorRole: 'staff',
            action: labelForEventTransition(current, to),
            note: note === '' ? null : note,
            isInternal: note === '' ? false : internal,
          },
        },
      },
    });
    return tx.eventRequest.findUnique({ where: { id: existing.id }, include: rowInclude });
  });
  if (!row) return null;
  // Customer-visible outcomes only. The transition guard rejects
  // repeats, so each status notifies at most once. Internal notes
  // never notify.
  if (to === 'approved' || to === 'rejected' || to === 'cancelled') {
    const copy =
      to === 'approved'
        ? { title: 'Event request approved', message: `Your event request ${reference} was approved. View the details here.` }
        : to === 'rejected'
          ? { title: 'Event request update', message: `Your event request ${reference} was not approved. Contact us for alternatives.` }
          : { title: 'Event request cancelled', message: `Your event request ${reference} was cancelled. Contact us if you need anything else.` };
    await notifyUser(existing.userId, {
      type: 'event_request_update',
      ...copy,
      href: `/account/event-requests/detail?ref=${encodeURIComponent(reference)}`,
    });
  }
  return toStaffView(row);
}

export async function addStaffEventNote(reference: string, note: string): Promise<StaffEventRequest | null> {
  const trimmed = note.trim();
  if (trimmed === '' || trimmed.length > EVENT_NOTE_MAX || hasControlChars(trimmed)) {
    throw new Error('Enter an internal note (1,000 characters or fewer).');
  }
  const existing = await db.eventRequest.findUnique({
    where: { reference },
    select: { id: true },
  });
  if (!existing) return null;
  const row = await db.$transaction(async (tx) => {
    await tx.eventRequest.update({
      where: { id: existing.id },
      data: {
        activities: {
          create: { actorRole: 'staff', action: 'Internal note added', note: trimmed, isInternal: true },
        },
      },
    });
    return tx.eventRequest.findUnique({ where: { id: existing.id }, include: rowInclude });
  });
  if (!row) return null;
  return toStaffView(row);
}
