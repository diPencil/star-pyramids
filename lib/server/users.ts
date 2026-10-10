// User + role service boundary. All user writes go through here —
// never raw Prisma calls from routes, never role claims from the client.
import 'server-only';

import { Prisma, type UserStatus } from '@prisma/client';

import { db } from './db';
import { hashPassword } from '../core/password';
import {
  isValidEmail,
  isValidPersonName,
  normalizeEmail,
  validatePasswordStrength,
  normalizePhone,
  normalizeUsername,
} from '../core/validation';
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
  avatar?: string | null;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  roles: string[];
  /** Effective permission keys. Resolved by auth flows; [] elsewhere. */
  permissions: string[];
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
  avatar: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: { select: { key: true } } } },
} satisfies Prisma.UserSelect;

type UserWithRoles = Prisma.UserGetPayload<{ select: typeof publicSelect }>;

export function toPublicUser(
  row: UserWithRoles,
  permissions: string[] = [],
): PublicUser {
  return {
    id: row.id,
    publicId: row.publicId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    username: row.username,
    countryCode: row.countryCode,
    phone: row.phone,
    // Must be projected here or the stored avatar (an https URL, a stored
    // /media path, or a legacy data URL) never reaches the client on a
    // fresh read, so it appears to vanish on refresh / re-login.
    avatar: row.avatar,
    status: row.status,
    emailVerifiedAt: row.emailVerifiedAt,
    lastLoginAt: row.lastLoginAt,
    roles: row.roles.map((r) => r.role.key),
    permissions: [...permissions],
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
      phone: normalizePhone(input.phone),
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
  input: Pick<CustomerRegistrationInput, 'firstName' | 'lastName' | 'username' | 'countryCode' | 'phone'> & { avatar?: string },
): Promise<PublicUser> {
  const row = await db.user.update({
    where: { id: userId },
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      username: normalizeUsername(input.username),
      countryCode: input.countryCode.trim().toUpperCase(),
      phone: normalizePhone(input.phone),
      avatar: input.avatar?.trim() || null,
    },
    select: publicSelect,
  });
  return toPublicUser(row);
}

export type AdminProfileInput = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  countryCode: string;
  phone: string;
  avatar?: string;
  /** Optional new password in cleartext; hashed here, never returned. */
  password?: string;
};

/**
 * Self-service update for the currently authenticated staff/admin user.
 * Identity-only: role, status and id are never accepted from the caller —
 * the route passes only the session user id. Password is optional.
 */
export async function updateAdminProfile(
  userId: string,
  input: AdminProfileInput,
): Promise<PublicUser> {
  const email = input.email.trim();
  const row = await db.user.update({
    where: { id: userId },
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      username: normalizeUsername(input.username),
      email,
      emailNormalized: normalizeEmail(email),
      countryCode: input.countryCode.trim().toUpperCase(),
      phone: normalizePhone(input.phone),
      avatar: input.avatar?.trim() || null,
      ...(input.password
        ? { passwordHash: await hashPassword(input.password) }
        : {}),
    },
    select: publicSelect,
  });
  return toPublicUser(row);
}

export async function updateUserAvatar(
  userId: string,
  avatar: string | null,
): Promise<PublicUser> {
  const row = await db.user.update({
    where: { id: userId },
    data: { avatar },
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

// ---------------------------------------------------------------------------
// Staff / user-management boundary (Phase 4A).
// Every admin user-management write goes through these functions. Role and
// status authority lives here — never in client payloads, which only carry
// the requested values for server-side authorization and validation.
// ---------------------------------------------------------------------------

/** Roles that count as dashboard staff (listed in Users & Roles). */
export const STAFF_ROLE_KEYS = ['SUPER_ADMIN', 'ADMIN', 'STAFF'] as const;

export type StaffRoleKey = (typeof STAFF_ROLE_KEYS)[number];

/** Presence window: a session seen inside it counts the member as online. */
export const STAFF_ONLINE_WINDOW_MS = 15 * 60 * 1000;

export function isStaffRoleKey(value: unknown): value is StaffRoleKey {
  return (
    typeof value === 'string' &&
    (STAFF_ROLE_KEYS as readonly string[]).includes(value)
  );
}

export class UserManagementError extends Error {
  status: 400 | 403 | 404 | 409 | 500;

  constructor(status: 400 | 403 | 404 | 409 | 500, message: string) {
    super(message);
    this.name = 'UserManagementError';
    this.status = status;
  }
}

/** Directory scope: anyone holding at least one non-customer role. */
export function isDirectoryRoleKey(key: string): boolean {
  return key !== 'CUSTOMER';
}

export interface StaffListItem extends PublicUser {
  /** True when a session was seen inside STAFF_ONLINE_WINDOW_MS. */
  online: boolean;
}

type UserRowWithSessions = UserWithRoles & {
  sessions: Array<{ lastSeenAt: Date }>;
};

function toStaffListItem(row: UserRowWithSessions): StaffListItem {
  const lastSeen = row.sessions[0]?.lastSeenAt ?? null;
  const { sessions: _sessions, ...rest } = row;
  return {
    ...toPublicUser(rest),
    online:
      lastSeen !== null &&
      Date.now() - lastSeen.getTime() <= STAFF_ONLINE_WINDOW_MS,
  };
}

/** All users holding at least one non-customer role. No secrets ever selected. */
export async function listStaffUsers(): Promise<StaffListItem[]> {
  const rows = await db.user.findMany({
    where: { roles: { some: { role: { key: { not: 'CUSTOMER' } } } } },
    select: {
      ...publicSelect,
      sessions: {
        select: { lastSeenAt: true },
        orderBy: { lastSeenAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toStaffListItem);
}

function cleanName(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !isValidPersonName(value)) {
    throw new UserManagementError(400, `Enter a valid ${field} (1-80 characters).`);
  }
  return value.trim().slice(0, 80);
}

/**
 * Throws when removing/deactivating `excludingUserId` as an active
 * Super Admin would leave zero active Super Admins. Must run inside the
 * same transaction as the write so the check and the change are atomic.
 */
async function ensureSuperAdminQuorum(
  tx: Prisma.TransactionClient,
  excludingUserId: string,
): Promise<void> {
  const remaining = await tx.user.count({
    where: {
      id: { not: excludingUserId },
      status: 'ACTIVE',
      roles: { some: { role: { key: 'SUPER_ADMIN' } } },
    },
  });
  if (remaining < 1) {
    throw new UserManagementError(
      409,
      'Cannot remove the last active Super Admin. Assign another Super Admin first.',
    );
  }
}

export interface InviteStaffInput {
  email: string;
  /** Admin-set initial password (same 6-8 policy as everywhere else). */
  password: string;
  firstName?: string;
  lastName?: string;
  /** Any grantable non-customer role key (system or custom). */
  roleKey: string;
}

export interface ActorRef {
  id: string;
  publicId: string;
  roles: readonly string[];
  permissions: readonly string[];
}

/**
 * Capabilities reserved to SUPER_ADMIN by code (see requireSuperAdmin).
 * Legacy grant rows for these keys may still exist on ADMIN/STAFF/custom
 * roles, but they confer no mutation power. They must be displayed as
 * locked — never granted — until separate owner approval rewrites them.
 */
export const SUPER_ADMIN_ONLY_PERMISSIONS: readonly string[] = [
  'users.manage',
  'roles.manage',
];

/**
 * Effective (enforceable) permission keys for a role's raw grant list.
 * SUPER_ADMIN is unaffected (full access by definition); every other
 * role loses the SUPER_ADMIN-only capabilities, matching API checks.
 */
export function effectiveRolePermissions(roleKey: string, granted: readonly string[]): string[] {
  if (roleKey === 'SUPER_ADMIN') return [...granted];
  return granted.filter((key) => !(SUPER_ADMIN_ONLY_PERMISSIONS as readonly string[]).includes(key));
}

/**
 * Owner-approved access policy: ONLY SUPER_ADMIN may mutate user
 * identities, roles or permission grants (invite/edit/suspend staff,
 * create/edit roles, edit the permission matrix). Legacy `users.manage` /
 * `roles.manage` permission records are intentionally NOT consulted here —
 * ADMIN and STAFF must not manage identities even if those rows still
 * grant the keys. Read-only directory access stays permission-based
 * (`users.view` / `roles.view`) at the API routes.
 */
function requireSuperAdmin(actor: ActorRef, action: string): void {
  if (!actor.roles.includes('SUPER_ADMIN')) {
    throw new UserManagementError(403, action);
  }
}

function requireManager(actor: ActorRef): void {
  requireSuperAdmin(actor, 'Only Super Admins can manage team members.');
}

function requireRolesManager(actor: ActorRef): void {
  requireSuperAdmin(actor, 'Only Super Admins can manage roles and permissions.');
}

function requireGrantable(
  actor: ActorRef,
  roleKey: string,
  allRoles: Array<{ key: string; permissions: string[] }>,
): void {
  if (!grantableRoleKeys(actor, allRoles).includes(roleKey)) {
    throw new UserManagementError(
      403,
      'Your role cannot grant this role.',
    );
  }
}

export async function inviteStaffUser(
  input: InviteStaffInput,
  actor: ActorRef,
): Promise<StaffListItem> {
  requireManager(actor);
  const allRoles = await listRolesDetailed();
  const roleRow = allRoles.find((r) => r.key === input.roleKey);
  if (!roleRow || roleRow.key === 'CUSTOMER') {
    throw new UserManagementError(400, 'Select a valid staff role.');
  }
  requireGrantable(actor, roleRow.key, allRoles);
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  if (!isValidEmail(email)) {
    throw new UserManagementError(400, 'Enter a valid email address.');
  }
  const weakness = validatePasswordStrength(input.password);
  if (weakness) {
    throw new UserManagementError(400, weakness);
  }
  const firstName = cleanName(input.firstName, 'first name');
  const lastName = cleanName(input.lastName, 'last name');

  const emailNormalized = normalizeEmail(email);
  const existing = await db.user.findUnique({
    where: { emailNormalized },
    select: { id: true },
  });
  if (existing) {
    throw new UserManagementError(409, 'This email is already registered.');
  }

  try {
    const row = await db.user.create({
      data: {
        email,
        emailNormalized,
        firstName,
        lastName,
        passwordHash: await hashPassword(input.password),
        status: 'ACTIVE',
        roles: {
          create: {
            assignedBy: actor.publicId,
            role: { connect: { key: input.roleKey } },
          },
        },
      },
      select: {
        ...publicSelect,
        sessions: {
          select: { lastSeenAt: true },
          orderBy: { lastSeenAt: 'desc' },
          take: 1,
        },
      },
    });
    return toStaffListItem(row);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new UserManagementError(409, 'This email is already registered.');
    }
    throw error;
  }
}

export interface UpdateStaffInput {
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  /** Replacement non-customer role key (validated + grant-checked). */
  roleKey?: string;
  status?: 'ACTIVE' | 'SUSPENDED';
}

export async function updateStaffUser(
  targetPublicId: string,
  input: UpdateStaffInput,
  actor: ActorRef,
): Promise<StaffListItem> {
  requireManager(actor);
  if (
    input.firstName === undefined &&
    input.lastName === undefined &&
    input.email === undefined &&
    input.roleKey === undefined &&
    input.status === undefined
  ) {
    throw new UserManagementError(400, 'Nothing to update.');
  }

  return db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { publicId: targetPublicId },
      select: {
        ...publicSelect,
        sessions: {
          select: { lastSeenAt: true },
          orderBy: { lastSeenAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!target) {
      throw new UserManagementError(404, 'Team member not found.');
    }
    const targetRoles = target.roles.map((r) => r.role.key);
    const isStaffMember = targetRoles.some((key) => key !== 'CUSTOMER');
    if (!isStaffMember) {
      throw new UserManagementError(404, 'Team member not found.');
    }
    // Lattice enforcement: user management is SUPER_ADMIN-exclusive, and
    // only a Super Admin may touch an Admin/Super Admin account. Self
    // role/status changes are rejected below; the last-active-Super-Admin
    // quorum is enforced transactionally on demote/suspend.
    const targetOutranks =
      targetRoles.includes('SUPER_ADMIN') || targetRoles.includes('ADMIN');
    if (targetOutranks && !actor.roles.includes('SUPER_ADMIN')) {
      throw new UserManagementError(
        403,
        'Only a Super Admin can modify an Admin or Super Admin.',
      );
    }
    const isSelf = target.id === actor.id;

    let email: string | undefined;
    let emailNormalized: string | undefined;
    if (input.email !== undefined) {
      email = typeof input.email === 'string' ? input.email.trim() : '';
      if (!isValidEmail(email)) {
        throw new UserManagementError(400, 'Enter a valid email address.');
      }
      emailNormalized = normalizeEmail(email);
      const clash = await tx.user.findUnique({
        where: { emailNormalized },
        select: { id: true },
      });
      if (clash && clash.id !== target.id) {
        throw new UserManagementError(409, 'This email is already registered.');
      }
    }

    let roleKey: string | undefined;
    if (input.roleKey !== undefined) {
      if (typeof input.roleKey !== 'string' || !input.roleKey) {
        throw new UserManagementError(400, 'Select a valid staff role.');
      }
      if (isSelf) {
        throw new UserManagementError(
          403,
          'You cannot change your own role. Ask another Super Admin.',
        );
      }
      const allRoles = await tx.role.findMany({
        select: {
          key: true,
          grants: { select: { permission: { select: { key: true } } } },
        },
      });
      const roleRow = allRoles.find((r) => r.key === input.roleKey);
      if (!roleRow || roleRow.key === 'CUSTOMER') {
        throw new UserManagementError(400, 'Select a valid staff role.');
      }
      requireGrantable(
        actor,
        roleRow.key,
        allRoles.map((r) => ({
          key: r.key,
          permissions: r.grants.map((g) => g.permission.key),
        })),
      );
      roleKey = roleRow.key;
      const removesSuperAdmin =
        targetRoles.includes('SUPER_ADMIN') && roleKey !== 'SUPER_ADMIN';
      const deactivating =
        input.status !== undefined && input.status !== 'ACTIVE';
      if (removesSuperAdmin && target.status === 'ACTIVE' && !deactivating) {
        await ensureSuperAdminQuorum(tx, target.id);
      }
    }

    let status: 'ACTIVE' | 'SUSPENDED' | undefined;
    if (input.status !== undefined) {
      if (input.status !== 'ACTIVE' && input.status !== 'SUSPENDED') {
        throw new UserManagementError(400, 'Select a valid status.');
      }
      if (isSelf) {
        throw new UserManagementError(
          403,
          'You cannot change your own status. Ask another Super Admin.',
        );
      }
      status = input.status;
      if (
        status === 'SUSPENDED' &&
        targetRoles.includes('SUPER_ADMIN') &&
        target.status === 'ACTIVE'
      ) {
        await ensureSuperAdminQuorum(tx, target.id);
      }
    }

    // Apply role replacement (all non-customer assignments — CUSTOMER on
    // the same person, if any, is left untouched).
    if (roleKey !== undefined) {
      await tx.userRole.deleteMany({
        where: {
          userId: target.id,
          role: { key: { not: 'CUSTOMER' } },
        },
      });
      const roleRow = await tx.role.findUnique({
        where: { key: roleKey },
        select: { id: true },
      });
      if (!roleRow) {
        throw new UserManagementError(400, 'Select a valid staff role.');
      }
      await tx.userRole.create({
        data: { userId: target.id, roleId: roleRow.id, assignedBy: actor.publicId },
      });
    }

    const updated = await tx.user.update({
      where: { id: target.id },
      data: {
        ...(input.firstName !== undefined
          ? { firstName: cleanName(input.firstName, 'first name') }
          : {}),
        ...(input.lastName !== undefined
          ? { lastName: cleanName(input.lastName, 'last name') }
          : {}),
        ...(email !== undefined && emailNormalized !== undefined
          ? { email, emailNormalized }
          : {}),
        ...(status !== undefined ? { status } : {}),
      },
      select: {
        ...publicSelect,
        sessions: {
          select: { lastSeenAt: true },
          orderBy: { lastSeenAt: 'desc' },
          take: 1,
        },
      },
    });

    // Suspending revokes access immediately: drop sessions now (the
    // status gate in getCurrentUser would reject them on next read anyway).
    if (status === 'SUSPENDED') {
      await tx.session.deleteMany({ where: { userId: target.id } });
    }

    return toStaffListItem(updated);
  });
}

// ---------------------------------------------------------------------------
// Configurable roles & permissions (Phase 4A RBAC).
// The Permission catalog is seeded by migration; grants live on
// RolePermission. SUPER_ADMIN bypasses checks in code AND holds every
// grant, so matrix edits can only ever restrict lesser roles.
// ---------------------------------------------------------------------------

export interface RoleDetail {
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  memberCount: number;
}

export interface PermissionEntry {
  key: string;
  module: string;
  action: string;
  label: string | null;
}

export async function listPermissionCatalog(): Promise<PermissionEntry[]> {
  const rows = await db.permission.findMany({
    select: { key: true, module: true, action: true, label: true },
    orderBy: [{ module: 'asc' }, { action: 'asc' }],
  });
  return rows;
}

export async function listRolesDetailed(): Promise<RoleDetail[]> {
  const rows = await db.role.findMany({
    select: {
      key: true,
      name: true,
      description: true,
      isSystem: true,
      grants: { select: { permission: { select: { key: true } } } },
      _count: { select: { assignments: true } },
    },
    orderBy: { key: 'asc' },
  });
  return rows.map((row) => ({
    key: row.key,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    permissions: row.grants.map((g) => g.permission.key),
    memberCount: row._count.assignments,
  }));
}

/** Effective permission keys for a user id (explicit grants only). */
export async function resolvePermissionKeys(userId: string): Promise<string[]> {
  const rows = await db.rolePermission.findMany({
    where: { role: { assignments: { some: { userId } } } },
    select: { permission: { select: { key: true } } },
  });
  return [...new Set(rows.map((r) => r.permission.key))];
}

/**
 * Role keys the actor may assign. SUPER_ADMIN may grant any non-customer
 * role. Anyone else may grant nothing: user identity management is
 * SUPER_ADMIN-exclusive, so legacy permission rows never confer the power
 * to assign roles. Privilege escalation is impossible by construction.
 */
export function grantableRoleKeys(
  actor: ActorRef,
  allRoles: Array<{ key: string; isSystem?: boolean; permissions: string[] }>,
): string[] {
  if (actor.roles.includes('SUPER_ADMIN')) {
    return allRoles.filter((r) => r.key !== 'CUSTOMER').map((r) => r.key);
  }
  return [];
}

const ROLE_KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/;

export function deriveRoleKey(name: string): string | null {
  const key = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return ROLE_KEY_PATTERN.test(key) ? key : null;
}

export async function createRole(
  input: { name: string; description?: string },
  actor: ActorRef,
): Promise<RoleDetail> {
  requireRolesManager(actor);
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 100) : '';
  if (!name) {
    throw new UserManagementError(400, 'Enter a role name.');
  }
  const description =
    typeof input.description === 'string' && input.description.trim()
      ? input.description.trim().slice(0, 255)
      : null;
  const key = deriveRoleKey(name);
  if (!key) {
    throw new UserManagementError(
      400,
      'Role names must contain Latin letters or digits so a stable role key can be derived.',
    );
  }
  const existing = await db.role.findUnique({ where: { key }, select: { key: true } });
  if (existing) {
    throw new UserManagementError(409, 'A role with this name already exists.');
  }
  await db.role.create({
    data: { key, name, description, isSystem: false },
  });
  const detail = (await listRolesDetailed()).find((r) => r.key === key);
  if (!detail) throw new UserManagementError(500, 'Could not complete the request.');
  return detail;
}

export async function updateRole(
  roleKey: string,
  input: { name?: string; description?: string | null },
  actor: ActorRef,
): Promise<RoleDetail> {
  requireRolesManager(actor);
  const target = await db.role.findUnique({
    where: { key: roleKey },
    select: { key: true, isSystem: true },
  });
  if (!target) {
    throw new UserManagementError(404, 'Role not found.');
  }
  if (target.isSystem) {
    throw new UserManagementError(400, 'System roles cannot be edited.');
  }
  const data: { name?: string; description?: string | null } = {};
  if (input.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim().slice(0, 100) : '';
    if (!name) throw new UserManagementError(400, 'Enter a role name.');
    data.name = name;
  }
  if (input.description !== undefined) {
    data.description =
      typeof input.description === 'string' && input.description.trim()
        ? input.description.trim().slice(0, 255)
        : null;
  }
  if (Object.keys(data).length === 0) {
    throw new UserManagementError(400, 'Nothing to update.');
  }
  await db.role.update({ where: { key: roleKey }, data });
  const detail = (await listRolesDetailed()).find((r) => r.key === roleKey);
  if (!detail) throw new UserManagementError(500, 'Could not complete the request.');
  return detail;
}

export async function setRolePermissions(
  roleKey: string,
  permissionKeys: string[],
  actor: ActorRef,
): Promise<RoleDetail> {
  requireRolesManager(actor);
  const target = await db.role.findUnique({
    where: { key: roleKey },
    select: { id: true, key: true, isSystem: true },
  });
  if (!target) {
    throw new UserManagementError(404, 'Role not found.');
  }
  if (target.key === 'SUPER_ADMIN') {
    throw new UserManagementError(400, 'Super Admin always has full access.');
  }
  if (target.key === 'CUSTOMER') {
    throw new UserManagementError(400, 'Customer permissions are fixed.');
  }
  if (!Array.isArray(permissionKeys)) {
    throw new UserManagementError(400, 'Select a valid permission set.');
  }
  const catalog = await db.permission.findMany({ select: { key: true } });
  const known = new Set(catalog.map((p) => p.key));
  const unique = [...new Set(permissionKeys)];
  for (const key of unique) {
    if (typeof key !== 'string' || !known.has(key)) {
      throw new UserManagementError(400, 'Select a valid permission set.');
    }
  }
  // Delegation guard (defense-in-depth): unreachable while role
  // management is SUPER_ADMIN-exclusive, but kept so a future policy
  // relaxation can never silently grant above the actor's authority.
  if (!actor.roles.includes('SUPER_ADMIN')) {
    const overreach = unique.filter((key) => !actor.permissions.includes(key));
    if (overreach.length > 0) {
      throw new UserManagementError(
        403,
        'You cannot grant permissions above your own authority.',
      );
    }
  }
  await db.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: target.id } });
    if (unique.length > 0) {
      const permRows = await tx.permission.findMany({
        where: { key: { in: unique } },
        select: { id: true },
      });
      await tx.rolePermission.createMany({
        data: permRows.map((p) => ({
          roleId: target.id,
          permissionId: p.id,
          grantedBy: actor.publicId,
        })),
        skipDuplicates: true,
      });
    }
  });
  const detail = (await listRolesDetailed()).find((r) => r.key === roleKey);
  if (!detail) throw new UserManagementError(500, 'Could not complete the request.');
  return detail;
}
