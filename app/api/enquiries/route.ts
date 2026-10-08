import { NextResponse } from 'next/server';
import { db } from '@/lib/server/db';
import { checkEnquiryRateLimit, recordEnquiryAttempt } from '@/lib/server/rate-limit';
import { Prisma } from '@prisma/client';

const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 190;
const MAX_PHONE_LENGTH = 32;
const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_SOURCE_PAGE_LENGTH = 120;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? 'unknown';
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  let body: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
    sourcePage?: string;
    requestId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const { name, email, phone, subject, message, sourcePage, requestId } = body;
  if (requestId !== undefined && (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))) {
    return NextResponse.json({ error: 'Invalid enquiry request ID.' }, { status: 400 });
  }

  // Validate required fields
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';
  const trimmedSubject = typeof subject === 'string' ? subject.trim() : '';
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  const trimmedSourcePage = typeof sourcePage === 'string' ? sourcePage.trim().slice(0, MAX_SOURCE_PAGE_LENGTH) : '';

  if (!trimmedName || trimmedName.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: 'Name is required and must be 120 characters or fewer.' }, { status: 400 });
  }
  if (!trimmedEmail || trimmedEmail.length > MAX_EMAIL_LENGTH || !/^[^\s@]{1,120}@[^\s@]{1,120}\.[^\s@]{2,24}$/.test(trimmedEmail)) {
    return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
  }
  if (trimmedPhone && trimmedPhone.length > MAX_PHONE_LENGTH) {
    return NextResponse.json({ error: 'Phone must be 32 characters or fewer.' }, { status: 400 });
  }
  if (!trimmedSubject || trimmedSubject.length > MAX_SUBJECT_LENGTH) {
    return NextResponse.json({ error: 'Subject is required and must be 200 characters or fewer.' }, { status: 400 });
  }
  if (!trimmedMessage || trimmedMessage.length < 10 || trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: 'Message must be between 10 and 5000 characters.' }, { status: 400 });
  }

  const replay = async () => {
    const existing = requestId ? await db.websiteEnquiry.findUnique({ where: { publicId: requestId } }) : null;
    if (!existing) return null;
    if (existing.name !== trimmedName || existing.email !== trimmedEmail || existing.phone !== (trimmedPhone || null) || existing.subject !== trimmedSubject || existing.message !== trimmedMessage || existing.sourcePage !== (trimmedSourcePage || null)) {
      return NextResponse.json({ error: 'Request ID already used for a different enquiry.' }, { status: 409 });
    }
    return NextResponse.json({ enquiry: { publicId: existing.publicId, createdAt: existing.createdAt } });
  };
  try {
    const previous = await replay();
    if (previous) return previous;
    // Rate limiting: per email OR ip inside time window
    const rateLimit = await checkEnquiryRateLimit(trimmedEmail, ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many enquiry attempts. Please try again later.', retryAfterSeconds: rateLimit.retryAfterSeconds },
        { status: 429 }
      );
    }

    // Record attempt (abuse protection)
    await recordEnquiryAttempt(trimmedEmail, ip);

    // Create enquiry
    const enquiry = await db.websiteEnquiry.create({
      data: {
        ...(requestId ? { publicId: requestId } : {}),
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone || null,
        subject: trimmedSubject,
        message: trimmedMessage,
        sourcePage: trimmedSourcePage || null,
        status: 'NEW',
      },
      select: {
        publicId: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { enquiry: { publicId: enquiry.publicId, createdAt: enquiry.createdAt } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && requestId) {
      try {
        const previous = await replay();
        if (previous) return previous;
      } catch { /* Safe failure below if persistence cannot be confirmed. */ }
    }
    console.error('[enquiries] Persistence failed', { code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : 'UNEXPECTED' });
    return NextResponse.json({ error: 'Could not confirm your enquiry. Please retry without changing your details.' }, { status: 503 });
  }
}
