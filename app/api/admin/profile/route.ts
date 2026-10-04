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
import { getCurrentUser, isStaff } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { toClientUser, updateAdminProfile } from '@/lib/server/users';

type AdminProfileBody = {
  firstName?: unknown;
  lastName?: unknown;
  username?: unknown;
  email?: unknown;
  countryCode?: unknown;
  phone?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Self-service profile for the currently authenticated staff/admin user.
 * Updates identity fields of the session user ONLY — no user id is accepted
 * from the browser, and role/status can never be changed here.
 */
export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!isStaff(current)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  let body: AdminProfileBody;
  try {
    body = await request.json() as AdminProfileBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const firstName = text(body.firstName);
  const lastName = text(body.lastName);
  const username = text(body.username);
  const email = normalizeEmail(text(body.email));
  const countryCode = text(body.countryCode).toUpperCase();
  const phone = text(body.phone);
  const password = text(body.password);

  if (!isValidPersonName(firstName) || !isValidPersonName(lastName)) {
    return NextResponse.json({ error: 'Enter a valid first and last name.' }, { status: 400 });
  }
  if (!isValidUsername(username)) {
    return NextResponse.json({ error: 'Username must be 3-24 letters, numbers, or underscores.' }, { status: 400 });
  }
  if (!isValidEmail(email) || email.length > 190) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (!isValidCountryCode(countryCode)) {
    return NextResponse.json({ error: 'Select a valid country.' }, { status: 400 });
  }
  // The shared phone control submits international form (`+20 …`); the
  // canonical validator accepts it and storage normalizes to compact form.
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: 'Enter a valid mobile number.' }, { status: 400 });
  }
  if (password) {
    const weakness = validatePasswordStrength(password);
    if (weakness) return NextResponse.json({ error: weakness }, { status: 400 });
    if (password !== text(body.confirmPassword)) {
      return NextResponse.json({ error: 'The passwords do not match.' }, { status: 400 });
    }
  }

  try {
    const user = await updateAdminProfile(current.id, {
      firstName,
      lastName,
      username,
      email,
      countryCode,
      phone,
      ...(password ? { password } : {}),
    });
    return NextResponse.json({ user: toClientUser(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = String((error.meta as { target?: unknown } | null)?.target ?? '');
      if (target.includes('username')) {
        return NextResponse.json({ error: 'This username is already in use.' }, { status: 409 });
      }
      if (target.includes('email')) {
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'These details are already in use.' }, { status: 409 });
    }
    throw error;
  }
}
