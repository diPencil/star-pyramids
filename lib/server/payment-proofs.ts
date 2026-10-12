// Customer payment-proof submissions (Phase 3: offline payments only).
//
// Guests and account holders pay offline (bank transfer / cash) and submit
// a payment REFERENCE for staff review. Submissions are stored as plain
// BookingActivity rows on the existing timeline — no new table, no
// migration, no file upload:
//
// - The media architecture serves PUBLIC files only (`GET /media/...`
//   needs no credential), so it cannot hold private payment evidence.
//   Proof submission is therefore REFERENCE-ONLY by design: no file,
//   no public URL, nothing to leak.
// - A submission NEVER creates or transitions a Payment row. Verified
//   money is recorded separately by authorized staff through the
//   audited `recordOfflinePayment` workflow. Staff review here only
//   acknowledges receipt (`Payment proof reviewed`), never settlement.
// - Duplicates (same normalized reference) resolve to the original
//   submission with `created:false`: no stacked rows, no double
//   notification, idempotent email.
// - Abuse budget reuses the activity timeline itself (max submissions
//   per booking per hour), so no new attempt table is needed.
import 'server-only';

import { Prisma } from '@prisma/client';

import { db } from './db';
import {
  BOOKING_REF_PATTERN,
  OFFLINE_PAYMENT_METHODS,
  type OfflinePaymentMethod,
} from './payments';
import { notifyStaff, notifyUser } from './notifications';
import { sendCustomerEmailSafe, sendStaffEmailSafe } from './email';
import {
  GuestBookingAccessError,
  resolveGuestBookingToken,
} from './booking-access';
import {
  PAYMENT_PROOF_REVIEWED_ACTION,
  PAYMENT_PROOF_SUBMITTED_ACTION,
  derivePaymentProofs,
  formatPaymentProofNote,
  type PaymentProofView,
} from '@/lib/booking';

const REFERENCE_MIN = 3;
const REFERENCE_MAX = 128;
const MAX_SUBMISSIONS_PER_HOUR = 10;
const SUBMISSION_WINDOW_MS = 60 * 60 * 1000;

/** Thrown when a booking exceeds its hourly proof-submission budget. */
export class ProofRateLimitError extends Error {
  readonly code = 'PROOF_RATE_LIMITED';
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super('Too many proof submissions. Try again later.');
    this.name = 'ProofRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function hasControlChars(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u001f\u007f]/.test(value);
}

export interface ValidatedProofInput {
  reference: string;
  method: OfflinePaymentMethod | null;
}

/**
 * Strict server validation of the proof body. Only a payment reference
 * and an optional offline method are accepted — amounts, statuses,
 * files, URLs, and ownership are never read from the body.
 */
export function validateProofInput(input: unknown): ValidatedProofInput {
  if (typeof input !== 'object' || input === null) throw new Error('Invalid request.');
  const body = input as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (key !== 'reference' && key !== 'method') throw new Error('Invalid request.');
  }
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  if (
    reference.length < REFERENCE_MIN ||
    reference.length > REFERENCE_MAX ||
    hasControlChars(reference)
  ) {
    throw new Error('Enter the payment reference from your bank or receipt (3-128 characters).');
  }
  const rawMethod = body.method;
  if (rawMethod === undefined || rawMethod === null || rawMethod === '') {
    return { reference, method: null };
  }
  if (
    rawMethod !== OFFLINE_PAYMENT_METHODS[0] &&
    rawMethod !== OFFLINE_PAYMENT_METHODS[1]
  ) {
    throw new Error('Select a valid payment method.');
  }
  return { reference, method: rawMethod as OfflinePaymentMethod };
}

export interface SubmittedProof extends PaymentProofView {
  created: boolean;
  duplicate: boolean;
}

type BookingRef = {
  id: string;
  userId: string | null;
  status: string;
  contactName: string;
  contactEmail: string;
};

function sanitizeIdempotency(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

async function loadBooking(reference: string): Promise<BookingRef | null> {
  const row = await db.booking.findUnique({
    where: { reference },
    select: { id: true, userId: true, status: true, contactName: true, contactEmail: true },
  });
  return row;
}

/** Database handle: the root client or one interactive transaction. */
type ProofStore = Prisma.TransactionClient | typeof db;

async function enforceSubmissionBudget(store: ProofStore, bookingId: string): Promise<void> {
  const windowStart = new Date(Date.now() - SUBMISSION_WINDOW_MS);
  const recent = await store.bookingActivity.count({
    where: {
      bookingId,
      action: PAYMENT_PROOF_SUBMITTED_ACTION,
      createdAt: { gte: windowStart },
    },
  });
  if (recent < MAX_SUBMISSIONS_PER_HOUR) return;
  const oldest = await store.bookingActivity.findFirst({
    where: {
      bookingId,
      action: PAYMENT_PROOF_SUBMITTED_ACTION,
      createdAt: { gte: windowStart },
    },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  throw new ProofRateLimitError(
    oldest
      ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + SUBMISSION_WINDOW_MS - Date.now()) / 1000))
      : Math.floor(SUBMISSION_WINDOW_MS / 1000),
  );
}

async function findDuplicate(
  store: ProofStore,
  bookingId: string,
  reference: string,
): Promise<PaymentProofView | null> {
  // All actions (not just submissions): a resubmitted reference must
  // resolve to the original WITH its current reviewed flag.
  const rows = await store.bookingActivity.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'asc' },
    select: { action: true, note: true, createdAt: true },
  });
  const proofs = derivePaymentProofs(
    rows.map((row) => ({
      action: row.action,
      note: row.note ?? '',
      at: row.createdAt.toISOString(),
    })),
  );
  const key = reference.trim().toLowerCase();
  return proofs.find((proof) => proof.reference.toLowerCase() === key) ?? null;
}

/**
 * Core submission writer shared by the account and guest flows. The
 * caller owns authorization (owner check / token resolution) and passes
 * the resolved booking plus where to link the customer back:
 * - `userId`: account owner id, or null for guests (no in-app notify).
 * - `detailUrl`: account detail path, or the guest's own private link
 *   (never mints/rotates tokens — the link they arrived on stays valid).
 */
async function writeProofSubmission(input: {
  booking: BookingRef;
  bookingReference: string;
  userId: string | null;
  detailUrl: string;
  proof: ValidatedProofInput;
}): Promise<SubmittedProof> {
  const { booking, bookingReference, userId, detailUrl, proof } = input;
  if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
    throw new Error('This booking can no longer take a payment proof.');
  }

  // Database-enforced idempotency for concurrent identical
  // submissions (Phase 3.1). The booking row is locked first
  // (`FOR UPDATE`), so simultaneous submits for one booking serialize
  // instead of racing: the loser blocks until the winner commits, then
  // re-reads INSIDE the same transaction and resolves to the winner's
  // row as a duplicate — one activity row, one notification fan-out.
  // Lock order (booking row, then its activity writes) matches the
  // cancellation path, so the two can never deadlock. Deliberately no
  // schema migration: a unique index would need a client regen plus a
  // dev-server restart, while the lock + re-check closes the race with
  // zero changes to existing rows.
  const submitted = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${booking.id} FOR UPDATE`;
    await enforceSubmissionBudget(tx, booking.id);
    const duplicate = await findDuplicate(tx, booking.id, proof.reference);
    if (duplicate) {
      return { ...duplicate, created: false, duplicate: true };
    }
    const created = await tx.bookingActivity.create({
      data: {
        bookingId: booking.id,
        actorRole: 'customer',
        action: PAYMENT_PROOF_SUBMITTED_ACTION,
        note: formatPaymentProofNote(proof.reference, proof.method),
      },
      select: { createdAt: true },
    });
    return {
      reference: proof.reference,
      method: proof.method,
      submittedAt: created.createdAt.toISOString(),
      reviewed: false,
      created: true,
      duplicate: false,
    } satisfies SubmittedProof;
  });

  // Duplicates (including the serialized-race loser) return here with
  // no new row and no notification — the single fan-out belongs to the
  // original submission only.
  if (!submitted.created) return submitted;

  // Receipt confirmation only — never a payment verification. Runs only
  // on the created path, so retried/duplicate submissions never notify
  // twice. Emails carry their own idempotency keys as a second layer.
  const proofKey = sanitizeIdempotency(proof.reference) || 'proof';
  const emailKey = `payment_proof:${sanitizeIdempotency(bookingReference)}:${proofKey}`;
  // Guests (userId null) are skipped — no account to notify; the email
  // below still confirms receipt to their checkout address.
  await notifyUser(userId, {
    type: 'payment_proof_submitted',
    title: 'Payment proof received',
    message: `We received your payment reference for booking ${bookingReference}. Our team will review it — this does not confirm payment yet.`,
    href: detailUrl,
  });
  await notifyStaff({
    type: 'admin_payment_proof_submitted',
    title: 'Payment proof submitted',
    message: `Booking ${bookingReference} has a new payment reference awaiting review.`,
    href: `/admin/bookings/${encodeURIComponent(bookingReference)}`,
  });
  await sendCustomerEmailSafe('payment_proof_received', booking.contactEmail, {
    name: booking.contactName,
    bookingReference,
    proofReference: proof.reference,
    detailUrl,
  }, { relatedReference: bookingReference, idempotencyKey: `${emailKey}:customer` });
  await sendStaffEmailSafe('admin_payment_proof_submitted', {
    bookingReference,
    proofReference: proof.reference,
    detailUrl: `/admin/bookings/${encodeURIComponent(bookingReference)}`,
  }, { relatedReference: bookingReference, idempotencyKey: `${emailKey}:staff` });
  return submitted;
}

/**
 * Owner-only submission (authenticated CUSTOMER). Returns null when the
 * booking does not belong to the caller — the route maps that to 404
 * without revealing ownership.
 */
export async function submitCustomerPaymentProof(
  userId: string,
  bookingReference: string,
  proof: ValidatedProofInput,
): Promise<SubmittedProof | null> {
  const reference = bookingReference.trim();
  if (!BOOKING_REF_PATTERN.test(reference)) throw new Error('Select a valid booking.');
  const booking = await loadBooking(reference);
  // Guest bookings (userId NULL) never match an authenticated customer.
  if (!booking || !booking.userId || booking.userId !== userId) return null;
  const detailUrl = `/account/bookings/detail?ref=${encodeURIComponent(reference)}`;
  return writeProofSubmission({ booking, bookingReference: reference, userId, detailUrl, proof });
}

/**
 * Guest submission, authorized ONLY by a valid access token. Read-like
 * bearer trust: appends one harmless activity row, never money, never
 * status. Unknown/expired/revoked tokens raise the uniform access
 * error (route maps to 404).
 */
export async function submitGuestPaymentProof(
  rawToken: string,
  proof: ValidatedProofInput,
): Promise<SubmittedProof> {
  const { reference } = await resolveGuestBookingToken(rawToken);
  const booking = await loadBooking(reference);
  // A token pointing at a booking that has since gained an account is
  // served through the account flow instead, so ownership never forks.
  if (!booking || booking.userId) {
    throw new GuestBookingAccessError('not-found');
  }
  return writeProofSubmission({
    booking,
    bookingReference: reference,
    userId: null,
    detailUrl: `/booking/${encodeURIComponent(rawToken.trim())}`,
    proof,
  });
}

/**
 * Staff acknowledgement of one pending proof submission. Appends a
 * customer-visible `Payment proof reviewed` activity row carrying the
 * customer's own reference — never money, never a status change, never
 * an internal note leak. Actual receipts stay on the separate audited
 * `recordOfflinePayment` path. Returns null for an unknown booking;
 * throws for an unknown reference; an already-reviewed proof returns
 * as-is with no new row (idempotent repeat).
 */
export async function acknowledgePaymentProof(
  bookingReference: string,
  proofReference: string,
): Promise<PaymentProofView | null> {
  const reference = bookingReference.trim();
  if (!BOOKING_REF_PATTERN.test(reference)) throw new Error('Select a valid booking.');
  const wanted = proofReference.trim();
  if (!wanted) throw new Error('Select a valid payment proof.');
  const booking = await loadBooking(reference);
  if (!booking) return null;
  // Same transaction/locking strategy as submissions: the booking row
  // is locked first so simultaneous acknowledgements serialize, and
  // the re-read inside the transaction decides. A repeat
  // acknowledgement of an already-reviewed proof returns it as-is with
  // no new row — idempotent, history-preserving, still never money.
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${booking.id} FOR UPDATE`;
    const rows = await tx.bookingActivity.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: 'asc' },
      select: { action: true, note: true, createdAt: true },
    });
    const proofs = derivePaymentProofs(
      rows.map((row) => ({
        action: row.action,
        note: row.note ?? '',
        at: row.createdAt.toISOString(),
      })),
    );
    const target = proofs.find(
      (proof) => proof.reference.toLowerCase() === wanted.toLowerCase(),
    );
    if (!target) {
      throw new Error('No pending payment proof with that reference.');
    }
    if (target.reviewed) return target;
    // Customer-visible on purpose: the note is the customer's own
    // reference, so the timeline honestly shows receipt + review without
    // exposing anything internal.
    await tx.bookingActivity.create({
      data: {
        bookingId: booking.id,
        actorRole: 'staff',
        action: PAYMENT_PROOF_REVIEWED_ACTION,
        note: target.reference,
      },
    });
    return { ...target, reviewed: true };
  });
}

export { GuestBookingAccessError };
