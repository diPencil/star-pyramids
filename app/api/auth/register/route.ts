import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import {
  isValidCountryCode,
  isValidEmail,
  isValidPersonName,
  isValidPhone,
  isValidUsername,
  normalizeEmail,
  validatePasswordStrength,
} from '@/lib/core/validation';
import { authorizedPostLoginPath } from '@/lib/server/auth-navigation';
import { isSameOriginRequest } from '@/lib/server/csrf';
import {
  checkRegistrationRateLimit,
  recordRegistrationAttempt,
} from '@/lib/server/rate-limit';
import { createSession } from '@/lib/server/session';
import { createCustomerUser, toClientUser } from '@/lib/server/users';

type RegistrationBody = {
  email?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  username?: unknown;
  countryCode?: unknown;
  phone?: unknown;
  acceptedTerms?: unknown;
  next?: unknown;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function requestIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 64) || 'unknown';
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let body: RegistrationBody;
  try {
    body = await request.json() as RegistrationBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email = normalizeEmail(text(body.email));
  const ipAddress = requestIp(request);
  const limit = await checkRegistrationRateLimit(email, ipAddress);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }
  await recordRegistrationAttempt(email, ipAddress);

  const password = text(body.password);
  const firstName = text(body.firstName);
  const lastName = text(body.lastName);
  const username = text(body.username);
  const countryCode = text(body.countryCode).toUpperCase();
  const phone = text(body.phone);

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }
  if (password !== text(body.confirmPassword)) {
    return NextResponse.json({ error: 'The passwords do not match.' }, { status: 400 });
  }
  if (!isValidPersonName(firstName) || !isValidPersonName(lastName)) {
    return NextResponse.json({ error: 'Enter a valid first and last name.' }, { status: 400 });
  }
  if (!isValidUsername(username)) {
    return NextResponse.json({ error: 'Username must be 3-24 letters, numbers, or underscores.' }, { status: 400 });
  }
  if (!isValidCountryCode(countryCode) || !isValidPhone(phone)) {
    return NextResponse.json({ error: 'Enter a valid country and mobile number.' }, { status: 400 });
  }
  if (body.acceptedTerms !== true) {
    return NextResponse.json({ error: 'You must accept the Terms and Privacy Policy.' }, { status: 400 });
  }

  try {
    const user = await createCustomerUser({
      email,
      password,
      firstName,
      lastName,
      username,
      countryCode,
      phone,
    });
    await createSession(user.id, {
      ipAddress: ipAddress !== 'unknown' ? ipAddress : undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(
      {
        user: toClientUser(user),
        redirectTo: authorizedPostLoginPath(user, text(body.next)),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'An account with these details already exists.' }, { status: 409 });
    }
    throw error;
  }
}
