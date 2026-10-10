import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import {
  isValidCountryCode,
  isValidPersonName,
  isValidPhone,
  isValidUsername,
} from '@/lib/core/validation';
import { getCurrentUser } from '@/lib/server/auth';
import { isSameOriginRequest } from '@/lib/server/csrf';
import { toClientUser, updateCustomerIdentity } from '@/lib/server/users';

type ProfileBody = {
  firstName?: unknown;
  lastName?: unknown;
  username?: unknown;
  countryCode?: unknown;
  phone?: unknown;
  avatar?: unknown;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!current.roles.includes('CUSTOMER')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let body: ProfileBody;
  try {
    body = await request.json() as ProfileBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const firstName = text(body.firstName);
  const lastName = text(body.lastName);
  const username = text(body.username);
  const countryCode = text(body.countryCode).toUpperCase();
  const phone = text(body.phone);
  const avatar = text(body.avatar);
  if (!isValidPersonName(firstName) || !isValidPersonName(lastName)) {
    return NextResponse.json({ error: 'Enter a valid first and last name.' }, { status: 400 });
  }
  if (!isValidUsername(username)) {
    return NextResponse.json({ error: 'Username must be 3-32 letters, numbers, underscores, dots, or hyphens.' }, { status: 400 });
  }
  if (!isValidCountryCode(countryCode) || !isValidPhone(phone)) {
    return NextResponse.json({ error: 'Enter a valid country and mobile number.' }, { status: 400 });
  }

  try {
    const user = await updateCustomerIdentity(current.id, { firstName, lastName, username, countryCode, phone, avatar });
    return NextResponse.json({ user: toClientUser(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'This username is already in use.' }, { status: 409 });
    }
    throw error;
  }
}
