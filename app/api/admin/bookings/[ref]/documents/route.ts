import { NextResponse } from 'next/server';

import { getCurrentUser, hasPermission } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { db } from '@/lib/server/db';
import {
  ISSUABLE_DOCUMENT_TYPES,
  issueBookingDocument,
  listBookingDocuments,
  listBookingRefundEvents,
  listVerifiedBookingPayments,
  toDocumentListItem,
  type IssueBookingDocumentFailure,
  type IssuableDocumentType,
} from '@/lib/server/documents';

type IssueBody = {
  type?: unknown;
  paymentReference?: unknown;
  refundEventId?: unknown;
  idempotencyKey?: unknown;
};

const FAILURE_STATUS: Record<IssueBookingDocumentFailure, number> = {
  'invalid-input': 400,
  'not-issuable-yet': 400,
  'unknown-booking': 404,
  'unknown-payment': 400,
  'payment-not-on-booking': 400,
  'status-mismatch': 409,
  'no-verified-money': 400,
  'non-usd-payment': 400,
  'unknown-refund-event': 400,
  'refund-not-on-booking': 400,
  'refund-not-tracked': 400,
  'duplicate-refund-note': 409,
  'duplicate-invoice': 409,
  'duplicate-voucher': 409,
  'voucher-not-eligible': 409,
  'invoice-not-eligible': 409,
};

const FAILURE_MESSAGE: Record<IssueBookingDocumentFailure, string> = {
  'invalid-input': 'Invalid request.',
  'not-issuable-yet': 'This document type is not available.',
  'unknown-booking': 'Booking not found.',
  'unknown-payment': 'Payment not found.',
  'payment-not-on-booking': 'That payment belongs to a different booking.',
  'status-mismatch': 'Booking confirmations require a confirmed booking.',
  'no-verified-money': 'That payment has no verified money yet.',
  'non-usd-payment': 'Only USD bookings and payments can be documented.',
  'unknown-refund-event': 'Refund event not found.',
  'refund-not-on-booking': 'That refund belongs to a different booking.',
  'refund-not-tracked': 'That refund was recorded before per-refund tracking and cannot be noted.',
  'duplicate-refund-note': 'A note was already issued for this refund.',
  'duplicate-invoice': 'An invoice was already issued for this booking.',
  'duplicate-voucher': 'A voucher was already issued for this booking.',
  'voucher-not-eligible': 'Vouchers need a confirmed booking.',
  'invoice-not-eligible': 'Invoices cannot be issued for cancelled bookings.',
};

/**
 * Staff document list for one booking (Phase C, extended in Phase D).
 *
 * Same audiences as the Phase B staff PDF download: `bookings.view` or
 * `payments.view`. Read-only — listing never issues anything. The admin
 * booking page also uses `verifiedPayments` (exact verified payment for
 * receipts) and `refundEvents` (completed refunds eligible for notes);
 * the issuance service revalidates every chosen reference regardless.
 * Documents are projected to the public list shape: the voucher
 * verification token never leaves the server except in the PDF itself.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ ref: string }> },
) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'bookings.view') && !hasPermission(current, 'payments.view')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const reference = decodeURIComponent((await ctx.params).ref);
  const booking = await db.booking.findUnique({
    where: { reference },
    select: { id: true },
  });
  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  const [documents, verifiedPayments, refundEvents] = await Promise.all([
    listBookingDocuments(booking.id),
    listVerifiedBookingPayments(booking.id),
    listBookingRefundEvents(booking.id),
  ]);
  return NextResponse.json({
    documents: documents.map(toDocumentListItem),
    verifiedPayments,
    refundEvents,
    issuableTypes: [...ISSUABLE_DOCUMENT_TYPES],
  });
}

/**
 * Explicit staff document issuance (Phase C).
 *
 * Gated by `bookings.edit` — viewing documents is not enough to create
 * them. Every success is audited; retries with the same idempotency key
 * return the original document (200, created:false) instead of minting
 * a duplicate. Nothing here runs automatically: no page load, checkout,
 * payment recording or PDF download calls this endpoint.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ ref: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!hasPermission(current, 'bookings.edit')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const reference = decodeURIComponent((await ctx.params).ref);

  let body: IssueBody;
  try {
    body = (await request.json()) as IssueBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const type = typeof body.type === 'string' ? body.type : '';
  if (!(ISSUABLE_DOCUMENT_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json(
      { error: FAILURE_MESSAGE['not-issuable-yet'], code: 'not-issuable-yet' satisfies IssueBookingDocumentFailure },
      { status: 400 },
    );
  }
  const paymentReference =
    typeof body.paymentReference === 'string' && body.paymentReference.trim()
      ? body.paymentReference.trim()
      : undefined;
  const refundEventId =
    typeof body.refundEventId === 'string' && body.refundEventId.trim()
      ? body.refundEventId.trim()
      : undefined;
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';

  const result = await issueBookingDocument({
    type: type as IssuableDocumentType,
    bookingReference: reference,
    ...(paymentReference ? { paymentReference } : {}),
    ...(refundEventId ? { refundEventId } : {}),
    idempotencyKey,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: FAILURE_MESSAGE[result.error], code: result.error },
      { status: FAILURE_STATUS[result.error] },
    );
  }

  if (result.created) {
    await db.staffActionAudit
      .create({
        data: {
          actorId: current.id,
          action: 'booking.document_issued',
          entityType: 'booking',
          entityId: reference,
          metadata: JSON.stringify({
            type: result.document.type,
            number: result.document.number,
            paymentReference: result.document.paymentReference,
            refundEventId: result.document.refund?.eventId ?? null,
          }),
        },
      })
      .catch(() => undefined);
  }
  return NextResponse.json(
    { created: result.created, document: result.document },
    { status: result.created ? 201 : 200 },
  );
}
