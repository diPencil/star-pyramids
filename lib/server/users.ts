// User + role service boundary. All user writes go through here —
// never raw Prisma calls from routes, never role claims from the client.
import 'server-only';

import { Prisma, type UserStatus } from '@prisma/client';

import { db } from './db';
import { hashPassword } from '../core/password';
import { normalizeEmail, normalizeUsername } from '../core/validation';
import type { AuthenticatedUser } from '../auth-types';

export const SYSTEM_ROLE_KEYS = [
  'SUPER_ADMIN',
  'ADMIN',
  'STAFF',
  'CUSTOMER',
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export interface PublicUser {
  id: string;
  publicId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  countryCode: string | null;
  phone: string | null;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
}

const publicSelect = {
  id: true,
  publicId: true,
  email: true,
  firstName: true,
  lastName: true,
  username: true,
  countryCode: true,
  phone: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: { select: { key: true } } } },
} satisfies Prisma.UserSelect;

type UserWithRoles = Prisma.UserGetPayload<{ select: typeof publicSelect }>;

export function toPublicUser(row: UserWithRoles): PublicUser {
  return {
    id: row.id,
    publicId: row.publicId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    username: row.username,
    countryCode: row.countryCode,
    phone: row.phone,
    status: row.status,
    emailVerifiedAt: row.emailVerifiedAt,
    lastLoginAt: row.lastLoginAt,
    roles: row.roles.map((r) => r.role.key),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toClientUser(user: PublicUser): AuthenticatedUser {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...safe } = user;
  return safe;
}

export async function findUserByEmail(
  email: string,
): Promise<UserWithRoles | null> {
  return db.user.findUnique({
    where: { emailNormalized: normalizeEmail(email) },
    select: publicSelect,
  });
}

export async function createUser(input: {
  email: string;
  password: string;
  status?: UserStatus;
  roleKeys?: SystemRoleKey[];
  assignedBy?: string;
}): Promise<PublicUser> {
  const email = input.email.trim();
  const emailNormalized = normalizeEmail(email);
  const passwordHash = await hashPassword(input.password);
  const roleKeys = input.roleKeys ?? [];
  const row = await db.user.create({
    data: {
      email,
      emailNormalized,
      passwordHash,
      status: input.status ?? 'PENDING',
      roles: {
        create: roleKeys.map((key) => ({
          assignedBy: input.assignedBy,
          role: { connect: { key } },
        })),
      },
    },
    select: publicSelect,
  });
  return toPublicUser(row);
}

export type CustomerRegistrationInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username: string;
  countryCode: string;
  phone: string;
};

export async function createCustomerUser(
  input: CustomerRegistrationInput,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<PublicUser> {
  const email = input.email.trim();
  const passwordHash = await hashPassword(input.password);
  const row = await client.user.create({
    data: {
      email,
      emailNormalized: normalizeEmail(email),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      username: normalizeUsername(input.username),
      countryCode: input.countryCode.trim().toUpperCase(),
      phone: input.phone.trim(),
      passwordHash,
      status: 'ACTIVE',
      roles: {
        create: {
          assignedBy: 'public-registration',
          role: { connect: { key: 'CUSTOMER' } },
        },
      },
    },
    select: publicSelect,
  });
  return toPublicUser(row);
}

export async function updateCustomerIdentity(
  userId: string,
  input: Pick<CustomerRegistrationInput, 'firstName' | 'lastName' | 'username' | 'countryCode' | 'phone'>,
): Promise<PublicUser> {
  const row = await db.user.update({
    where: { id: userId },
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      username: normalizeUsername(input.username),
      countryCode: input.countryCode.trim().toUpperCase(),
      phone: input.phone.trim(),
    },
    select: publicSelect,
  });
  return toPublicUser(row);
}

export async function assignRole(
  userId: string,
  roleKey: SystemRoleKey,
  assignedBy?: string,
): Promise<void> {
  const role = await db.role.findUnique({
    where: { key: roleKey },
    select: { id: true },
  });
  if (!role) throw new Error(`Unknown role: ${roleKey}`);
  await db.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: {},
    create: { userId, roleId: role.id, assignedBy },
  });
}

export async function setUserStatus(
  userId: string,
  status: UserStatus,
): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { status } });
}

export async function markLoggedIn(userId: string): Promise<void> {
  await db.user
    .update({ where: { id: userId }, data: { lastLoginAt: new Date() } })
    .catch(() => undefined);
}
