import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  ProofRateLimitError,
  submitCustomerPaymentProof,
  validateProofInput,
} from '@/lib/server/payment-proofs';

async function requireCustomer() {
  const current = await getCurrentUser();
  if (!current) return null;
  if (!current.roles.includes('CUSTOMER')) return null;
  return current;
}

/**
 * Owner-only payment-proof submission (reference-only, offline review).
 *
 * The customer submits a bank/cash reference for staff review. The
 * submission is stored on the booking activity timeline — it NEVER
 * creates or settles a Payment row, and no file upload is accepted
 * (the media architecture serves public files only, so proofs must
 * never carry files or public URLs).
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ ref: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await requireCustomer();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const reference = decodeURIComponent((await ctx.params).ref);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  try {
    const proof = validateProofInput(body);
    const submitted = await submitCustomerPaymentProof(current.id, reference, proof);
    // Unknown reference and foreign bookings share one honest 404 so a
    // probe cannot tell them apart (no ownership oracle).
    if (!submitted) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    return NextResponse.json(
      { proof: submitted },
      { status: submitted.created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof ProofRateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } },
      );
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
