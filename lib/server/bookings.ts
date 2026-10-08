// Booking domain service (Phase 2E). Server owns validation,
// reference issuance, ownership, pricing, status lifecycle, and
// response shaping. The browser supplies SELECTIONS ONLY (slugs,
// dates, headcounts, add-on titles, contact) — never prices, totals,
// statuses, references, user linkage, or payment state.
import 'server-only';

import { randomInt } from 'node:crypto';
import { Prisma, BookingStatus as DbStatus } from '@prisma/client';

import { db } from './db';
import { readJsonText, writeJsonText } from '../json-text';
import {
  isValidEmail,
  isValidPersonName,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
} from '../core/validation';
import { dayTourTerms, getBookingTotal } from '@/data/tours';
import { findTourBySlug } from './tours';
import {
  canTransitionBooking,
  isValidPreferredDate,
  labelForBookingTransition,
  type Booking,
  type BookingActivity,
  type BookingLine,
  type BookingPaymentStatus,
  type BookingStatus,
  type StaffBooking,
} from '@/lib/booking';
import {
  deriveBookingPaymentSummary,
  FROM_DB_PAYMENT_STATUS,
} from './payments';
import { notifyUser, notifyStaff } from './notifications';
import { sendCustomerEmailSafe, sendStaffEmailSafe } from './email';

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const REF_ATTEMPTS = 5;

function mintReferenceCandidate(): string {
  let suffix = '';
  for (let i = 0; i < 6; i += 1) suffix += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `SP-BK-${suffix}`;
}

const TO_DB_STATUS: Record<BookingStatus, DbStatus> = {
  pending: 'PENDING',
  confirmed: 'CONFIRMED',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

const FROM_DB_STATUS: Record<DbStatus, BookingStatus> = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEY_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const MAX_LINES = 20;
const MAX_ADDONS = 20;
const NOTE_MAX = 1000;
const NAME_MAX = 80;
const EMAIL_MAX = 120;
const PHONE_MAX = 32;

/** Integer-cents helpers: every persisted commercial amount is computed
 *  in cents and stored as DECIMAL — never float arithmetic. */
function toCents(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) return 0;
  return Math.round(usd * 100);
}

function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

function decimalToCents(value: Prisma.Decimal | number | string): number {
  return Math.round(Number(value.toString()) * 100);
}

function dollars(cents: number): number {
  return Math.round(cents) / 100;
}

function hasControlChars(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u001f\u007f]/.test(value);
}

export interface ValidatedBookingLine {
  tourSlug: string;
  tourTitle: string;
  tourImage: string;
  travelDate: string;
  adults: number;
  children: number;
  infants: number;
  addons: string[];
  adultUnitCents: number;
  childUnitCents: number;
  infantUnitCents: number;
  addonTotalCents: number;
  lineTotalCents: number;
}

export interface ValidatedBookingDraft {
  lines: ValidatedBookingLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  idempotencyKey: string;
}

const DRAFT_KEYS = new Set(['lines', 'contact', 'notes', 'currency', 'idempotencyKey']);
const LINE_KEYS = new Set(['tourSlug', 'date', 'adults', 'children', 'infants', 'addons']);
const CONTACT_KEYS = new Set(['name', 'email', 'phone']);

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function count(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return null;
  return value;
}

async function addonCatalog(slug: string): Promise<readonly { title: string; price?: number }[]> {
  const tour = await findTourBySlug(slug);
  if (!tour) return [];
  const catalog = tour.detail?.addOns ?? tour.dayDetail?.addOns;
  if (catalog) return catalog;
  return tour.category === 'one-day-tours' ? dayTourTerms.addOns : [];
}

async function resolveLine(raw: unknown): Promise<ValidatedBookingLine> {
  if (typeof raw !== 'object' || raw === null) throw new Error('Invalid booking items.');
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!LINE_KEYS.has(key)) throw new Error('Invalid booking items.');
  }
  const tourSlug = text(body.tourSlug)?.trim() ?? '';
  if (!SLUG_PATTERN.test(tourSlug) || tourSlug.length > 120) {
    throw new Error('Select a valid tour.');
  }
  // DB-authoritative catalogue: pricing always resolves from the tours table.
  const tour = await findTourBySlug(tourSlug);
  if (!tour) throw new Error('One of the selected tours is no longer available. Remove it and try again.');

  const date = text(body.date) ?? '';
  if (date !== '' && !isValidPreferredDate(date)) throw new Error('Select a valid travel date.');

  const adults = count(body.adults);
  const children = count(body.children) ?? 0;
  const infants = count(body.infants) ?? 0;
  if (adults === null || adults < 1 || adults > 50) throw new Error('Each item needs 1-50 adults.');
  if (children < 0 || children > 50 || infants < 0 || infants > 50) {
    throw new Error('Each item allows 0-50 children or infants.');
  }
  if (adults + children + infants > 60) throw new Error('Each item allows at most 60 travelers.');

  const rawAddons = body.addons ?? [];
  if (!Array.isArray(rawAddons) || rawAddons.length > MAX_ADDONS) throw new Error('Invalid add-ons.');
  const titles: string[] = [];
  for (const entry of rawAddons) {
    if (typeof entry !== 'string') throw new Error('Invalid add-ons.');
    const title = entry.trim().slice(0, 120);
    if (title) titles.push(title);
  }
  const catalog = await addonCatalog(tourSlug);
  let addonTotalCents = 0;
  for (const title of titles) {
    const match = catalog.find((addon) => addon.title === title);
    if (!match || typeof match.price !== 'number') {
      throw new Error(`“${title}” is no longer available. Remove it and try again.`);
    }
    addonTotalCents += toCents(match.price);
  }

  const pricing = getBookingTotal(tour, adults, children, infants);
  const adultUnitCents = toCents(pricing.adult);
  const childUnitCents = toCents(pricing.child);
  const infantUnitCents = toCents(pricing.infant);
  const travelerCents = adults * adultUnitCents + children * childUnitCents + infants * infantUnitCents;
  return {
    tourSlug,
    tourTitle: tour.title.slice(0, 200),
    tourImage: (tour.image ?? '').slice(0, 255),
    travelDate: date,
    adults,
    children,
    infants,
    addons: titles,
    adultUnitCents,
    childUnitCents,
    infantUnitCents,
    addonTotalCents,
    lineTotalCents: travelerCents + addonTotalCents,
  };
}

/**
 * Strict server validation of the checkout draft. Unknown keys are
 * rejected (no mass assignment); prices, totals, status, payment,
 * references, and ownership fields are never read from the body.
 */
export async function validateBookingDraft(input: unknown): Promise<ValidatedBookingDraft> {
  if (typeof input !== 'object' || input === null) throw new Error('Invalid request.');
  const body = input as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!DRAFT_KEYS.has(key)) throw new Error('Invalid request.');
  }

  const rawLines = body.lines;
  if (!Array.isArray(rawLines) || rawLines.length < 1 || rawLines.length > MAX_LINES) {
    throw new Error('Your cart is empty or too large.');
  }
  const lines: ValidatedBookingLine[] = [];
  for (const raw of rawLines) lines.push(await resolveLine(raw));

  const rawContact = body.contact;
  if (typeof rawContact !== 'object' || rawContact === null) throw new Error('Enter your contact details.');
  for (const key of Object.keys(rawContact as Record<string, unknown>)) {
    if (!CONTACT_KEYS.has(key)) throw new Error('Invalid request.');
  }
  const contact = rawContact as Record<string, unknown>;
  const contactName = text(contact.name)?.trim() ?? '';
  if (!isValidPersonName(contactName) || contactName.length > NAME_MAX) {
    throw new Error('Enter your full name.');
  }
  const contactEmail = normalizeEmail(text(contact.email) ?? '');
  if (contactEmail === '' || contactEmail.length > EMAIL_MAX || !isValidEmail(contactEmail)) {
    throw new Error('Enter a valid email address.');
  }
  const contactPhoneRaw = text(contact.phone)?.trim() ?? '';
  const phoneDigits = contactPhoneRaw.replace(/\D/g, '');
  if (!isValidPhone(contactPhoneRaw) || phoneDigits.length < 7 || contactPhoneRaw.length > PHONE_MAX) {
    throw new Error('Enter a valid phone number.');
  }

  const notes = text(body.notes) ?? '';
  if (notes.length > NOTE_MAX || hasControlChars(notes)) {
    throw new Error('Notes must be 1,000 characters or fewer.');
  }

  // Currency is presentation-only: the booking is always stored in USD base.
  if (body.currency !== undefined && body.currency !== 'USD') {
    throw new Error('Invalid request.');
  }

  const idempotencyKey = text(body.idempotencyKey)?.trim() ?? '';
  if (!KEY_PATTERN.test(idempotencyKey)) throw new Error('Invalid request.');

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  if (subtotalCents <= 0) throw new Error('Your cart has no chargeable items.');
  // No promo/discount engine exists: discount is always zero.
  const discountCents = 0;
  return {
    lines,
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
    contactName,
    contactEmail,
    contactPhone: normalizePhone(contactPhoneRaw),
    notes,
    idempotencyKey,
  };
}

type BookingRow = Prisma.BookingGetPayload<{
  include: {
    items: true;
    activities: true;
    payments: { select: { status: true; amountPaid: true; amountRefunded: true; reference: true; createdAt: true } };
    user: { select: { email: true; firstName: true; lastName: true } };
  };
}>;

function accountName(row: BookingRow): string {
  if (!row.user) return '';
  const full = `${row.user.firstName ?? ''} ${row.user.lastName ?? ''}`.trim();
  return full || row.user.email;
}

function toLineViews(row: Pick<BookingRow, 'items'>): BookingLine[] {
  return [...row.items]
    .sort((a, b) => a.tourSlug.localeCompare(b.tourSlug))
    .map((item, index) => {
      const storedAddons = readJsonText(item.addons);
      const addons = Array.isArray(storedAddons)
        ? storedAddons.filter((entry): entry is string => typeof entry === 'string')
        : [];
      return {
        key: `${item.tourSlug}|${item.travelDate || 'open'}|${item.adults}|${item.children}|${item.infants}|${index}`,
        tourSlug: item.tourSlug,
        title: item.tourTitle,
        image: item.tourImage ?? '',
        date: item.travelDate,
        adults: item.adults,
        children: item.children,
        infants: item.infants,
        addons,
        addonTotal: dollars(decimalToCents(item.addonTotal)),
        adultUnit: dollars(decimalToCents(item.adultUnit)),
        childUnit: dollars(decimalToCents(item.childUnit)),
        infantUnit: dollars(decimalToCents(item.infantUnit)),
        total: dollars(decimalToCents(item.lineTotal)),
      };
    });
}

function toActivityViews(
  activities: BookingRow['activities'],
  includeInternal: boolean,
): BookingActivity[] {
  return [...activities]
    .filter((a) => includeInternal || !a.isInternal)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((a) => ({
      at: a.createdAt.toISOString(),
      by: (a.actorRole === 'staff' || a.actorRole === 'system' ? a.actorRole : 'customer') as BookingActivity['by'],
      action: a.action,
      ...(a.note ? { note: a.note } : {}),
      ...(includeInternal && a.isInternal ? { internal: true as const } : {}),
    }));
}

/**
 * Customer-safe projection: no database IDs, no user linkage, no
 * internal activity. Internal activity rows are excluded entirely so
 * staff notes never reach customer responses. The payment state is
 * DERIVED from real Payment rows (never browser input): bookings
 * with no payment record stay honestly unpaid.
 */
export function toCustomerView(row: BookingRow): Booking {
  const storedPayment: BookingPaymentStatus =
    row.paymentStatus === 'PAID' ? 'paid' : row.paymentStatus === 'REFUNDED' ? 'refunded' : 'pending';
  const summary = deriveBookingPaymentSummary(
    row.payments.map((p) => ({
      status: FROM_DB_PAYMENT_STATUS[p.status],
      amountPaidCents: decimalToCents(p.amountPaid),
      amountRefundedCents: decimalToCents(p.amountRefunded),
      reference: p.reference,
      createdAt: p.createdAt,
    })),
    decimalToCents(row.total),
  );
  const paymentStatus: BookingPaymentStatus =
    summary.state === 'paid' ? 'paid' : summary.state === 'refunded' ? 'refunded' : storedPayment;
  return {
    reference: row.reference,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    status: FROM_DB_STATUS[row.status],
    paymentStatus,
    paymentSummary: summary,
    subtotal: dollars(decimalToCents(row.subtotal)),
    discount: dollars(decimalToCents(row.discount)),
    total: dollars(decimalToCents(row.total)),
    currency: 'USD',
    contact: {
      name: row.contactName,
      email: row.contactEmail,
      phone: row.contactPhone,
    },
    notes: row.notes ?? '',
    lines: toLineViews(row),
    activity: toActivityViews(row.activities, false),
  };
}

/** Staff projection: everything customer-safe plus the linked account. */
export function toStaffView(row: BookingRow): StaffBooking {
  const base = toCustomerView(row);
  return {
    ...base,
    activity: toActivityViews(row.activities, true),
    account: row.user ? { email: row.user.email, name: accountName(row) } : null,
  };
}

const paymentSelect: Prisma.BookingInclude['payments'] = {
  select: {
    status: true,
    amountPaid: true,
    amountRefunded: true,
    reference: true,
    createdAt: true,
  },
};

const rowInclude = {
  items: true,
  activities: true,
  payments: paymentSelect,
  user: { select: { email: true, firstName: true, lastName: true } },
} satisfies Prisma.BookingInclude;

/**
 * Create exactly one booking for a checkout submission. A repeated
 * submission with the same idempotency key returns the original booking
 * instead of creating a duplicate.
 */
export async function createBookingRecord(
  userId: string | null,
  draft: ValidatedBookingDraft,
): Promise<{ booking: Booking; created: boolean }> {
  const existingByKey = draft.idempotencyKey
    ? await db.booking.findUnique({ where: { idempotencyKey: draft.idempotencyKey }, include: rowInclude })
    : null;
  if (existingByKey) return { booking: toCustomerView(existingByKey), created: false };

  let lastError: unknown = null;
  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt += 1) {
    const reference = mintReferenceCandidate();
    try {
      const row = await db.booking.create({
        data: {
          reference,
          userId,
          contactName: draft.contactName,
          contactEmail: draft.contactEmail,
          contactPhone: draft.contactPhone,
          notes: draft.notes === '' ? null : draft.notes,
          currency: 'USD',
          subtotal: centsToDecimal(draft.subtotalCents),
          discount: centsToDecimal(draft.discountCents),
          total: centsToDecimal(draft.totalCents),
          status: 'PENDING',
          paymentStatus: 'PENDING',
          idempotencyKey: draft.idempotencyKey,
          items: {
            create: draft.lines.map((line) => ({
              tourSlug: line.tourSlug,
              tourTitle: line.tourTitle,
              tourImage: line.tourImage === '' ? null : line.tourImage,
              travelDate: line.travelDate,
              adults: line.adults,
              children: line.children,
              infants: line.infants,
              addons: writeJsonText(line.addons),
              adultUnit: centsToDecimal(line.adultUnitCents),
              childUnit: centsToDecimal(line.childUnitCents),
              infantUnit: centsToDecimal(line.infantUnitCents),
              addonTotal: centsToDecimal(line.addonTotalCents),
              lineTotal: centsToDecimal(line.lineTotalCents),
            })),
          },
          activities: {
            create: { actorRole: 'customer', action: 'Booking created' },
          },
        },
        include: rowInclude,
      });
      // Receipt for the new booking. Idempotent replays return early
      // above with created:false, so a retried key never notifies twice.
      // Guests (userId NULL) are skipped — no account to notify.
      await notifyUser(userId, {
        type: 'booking_created',
        title: 'Booking received',
        message: `We received your booking ${reference}. Track its status here.`,
        href: `/account/bookings/detail?ref=${encodeURIComponent(reference)}`,
      });
      // Operational copy for staff (guests included). Runs only on the
      // created path above, so idempotent replays never double-notify.
      await notifyStaff({
        type: 'admin_booking_created',
        title: 'New booking received',
        message: `Booking ${reference} needs review.`,
        href: `/admin/bookings/${encodeURIComponent(reference)}`,
      });
      // Email receipts (best-effort — never break booking creation).
      // Customer copy goes to the address given at checkout (guests
      // included); staff copy goes to the configured operational
      // recipient. Idempotency key matches the booking reference so a
      // retried submission never sends twice.
      await sendCustomerEmailSafe('booking_created', draft.contactEmail, {
        name: draft.contactName,
        reference,
        tourTitle: draft.lines.map((line) => line.tourTitle).join(', '),
        total: (draft.totalCents / 100).toFixed(2),
        currency: 'USD',
        detailUrl: `/account/bookings/detail?ref=${encodeURIComponent(reference)}`,
      }, { relatedReference: reference, idempotencyKey: `booking_created:${reference}` });
      await sendStaffEmailSafe('admin_booking_created', {
        name: draft.contactName,
        reference,
        total: (draft.totalCents / 100).toFixed(2),
        currency: 'USD',
        detailUrl: `/admin/bookings/${encodeURIComponent(reference)}`,
      }, { relatedReference: reference, idempotencyKey: `admin_booking_created:${reference}` });
      return { booking: toCustomerView(row), created: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Idempotency-key race: another request won — return the winner.
        const target = (error.meta?.target as string[] | undefined) ?? [];
        if (target.includes('idempotencyKey')) {
          const winner = await db.booking.findUnique({
            where: { idempotencyKey: draft.idempotencyKey },
            include: rowInclude,
          });
          if (winner) return { booking: toCustomerView(winner), created: false };
        }
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not create the booking. Please try again.');
}

export async function listCustomerBookings(userId: string): Promise<Booking[]> {
  const rows = await db.booking.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { items: true, activities: false, payments: paymentSelect, user: false },
  });
  return rows.map((row) =>
    toCustomerView({ ...row, activities: [], user: null }),
  );
}

export async function getCustomerBooking(
  userId: string,
  reference: string,
): Promise<Booking | null> {
  const row = await db.booking.findUnique({
    where: { reference },
    include: rowInclude,
  });
  // Guest bookings (userId NULL) never match an authenticated customer.
  if (!row || !row.userId || row.userId !== userId) return null;
  return toCustomerView(row);
}

export async function cancelCustomerBooking(
  userId: string,
  reference: string,
): Promise<Booking | null> {
  const existing = await db.booking.findUnique({
    where: { reference },
    select: { id: true, userId: true, status: true },
  });
  if (!existing || !existing.userId || existing.userId !== userId) return null;
  const current = FROM_DB_STATUS[existing.status];
  if (!canTransitionBooking(current, 'cancelled')) {
    throw new Error('This booking can no longer be cancelled.');
  }
  const row = await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELLED',
        activities: {
          create: { actorRole: 'customer', action: labelForBookingTransition(current, 'cancelled') },
        },
      },
    });
    return tx.booking.findUnique({ where: { id: existing.id }, include: rowInclude });
  });
  if (!row) return null;
  return toCustomerView(row);
}

export async function listStaffBookings(): Promise<StaffBooking[]> {
  const rows = await db.booking.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: true, activities: false, payments: paymentSelect, user: { select: { email: true, firstName: true, lastName: true } } },
  });
  return rows.map((row) =>
    toStaffView({ ...row, activities: [] }),
  );
}

export async function getStaffBooking(reference: string): Promise<StaffBooking | null> {
  const row = await db.booking.findUnique({
    where: { reference },
    include: rowInclude,
  });
  if (!row) return null;
  return toStaffView(row);
}

export async function transitionStaffBooking(
  reference: string,
  to: BookingStatus,
  note: string,
  internal: boolean,
): Promise<StaffBooking | null> {
  const existing = await db.booking.findUnique({
    where: { reference },
    select: { id: true, status: true, userId: true },
  });
  if (!existing) return null;
  const current = FROM_DB_STATUS[existing.status];
  if (!canTransitionBooking(current, to)) {
    throw new Error('This status change is not allowed.');
  }
  if (note.length > NOTE_MAX || hasControlChars(note)) {
    throw new Error('Notes must be 1,000 characters or fewer.');
  }
  const row = await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: existing.id },
      data: {
        status: TO_DB_STATUS[to],
        activities: {
          create: {
            actorRole: 'staff',
            action: labelForBookingTransition(current, to),
            note: note === '' ? null : note,
            isInternal: note === '' ? false : internal,
          },
        },
      },
    });
    return tx.booking.findUnique({ where: { id: existing.id }, include: rowInclude });
  });
  if (!row) return null;
  // Customer-visible status changes only. The transition guard above
  // rejects repeats, so each status notifies at most once. Internal
  // notes travel through addStaffBookingNote and never notify.
  if (to === 'confirmed' || to === 'completed' || to === 'cancelled') {
    const copy =
      to === 'confirmed'
        ? { title: 'Booking confirmed', message: `Your booking ${reference} is confirmed. View the details here.` }
        : to === 'completed'
          ? { title: 'Booking completed', message: `Your booking ${reference} is marked completed. Thank you for travelling with us.` }
          : { title: 'Booking cancelled', message: `Your booking ${reference} was cancelled. Contact us if you need anything else.` };
    await notifyUser(existing.userId, {
      type: to === 'confirmed' ? 'booking_confirmed' : to === 'completed' ? 'booking_completed' : 'booking_cancelled',
      ...copy,
      href: `/account/bookings/detail?ref=${encodeURIComponent(reference)}`,
    });
    // Status-change email to the booking contact snapshot (guests
    // included). Transition guard rejects repeats, and the
    // idempotency key adds a second layer against duplicate sends.
    await sendCustomerEmailSafe(
      to === 'confirmed' ? 'booking_confirmed' : to === 'completed' ? 'booking_completed' : 'booking_cancelled',
      row.contactEmail,
      {
        name: row.contactName,
        reference,
        detailUrl: `/account/bookings/detail?ref=${encodeURIComponent(reference)}`,
      },
      { relatedReference: reference, idempotencyKey: `booking_${to}:${reference}` },
    );
  }
  return toStaffView(row);
}

export async function addStaffBookingNote(reference: string, note: string): Promise<StaffBooking | null> {
  const trimmed = note.trim();
  if (trimmed === '' || trimmed.length > NOTE_MAX || hasControlChars(trimmed)) {
    throw new Error('Enter an internal note (1,000 characters or fewer).');
  }
  const existing = await db.booking.findUnique({
    where: { reference },
    select: { id: true },
  });
  if (!existing) return null;
  const row = await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: existing.id },
      data: {
        activities: {
          create: { actorRole: 'staff', action: 'Internal note added', note: trimmed, isInternal: true },
        },
      },
    });
    return tx.booking.findUnique({ where: { id: existing.id }, include: rowInclude });
  });
  if (!row) return null;
  return toStaffView(row);
}
