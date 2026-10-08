// Customer service boundary (Phase 4B). All admin customer reads and
// status writes go through here — never raw Prisma calls from routes.
// Customers are CUSTOMER-role users; staff accounts are managed under
// Users & Roles, never here. No secrets are ever selected: no password
// hashes, no session tokens, no internal ids leave this module.
import 'server-only';

import { db } from './db';
import { UserManagementError, type ActorRef } from './users';

export interface CustomerListItem {
  publicId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  username: string | null;
  countryCode: string | null;
  phone: string | null;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  bookingsCount: number;
  totalSpent: number;
  confirmedSpent: number;
  lastBookingAt: Date | null;
}

export interface CustomerBookingItem {
  reference: string;
  status: string;
  paymentStatus: string;
  currency: string;
  total: number;
  createdAt: Date;
  items: Array<{
    tourSlug: string;
    tourTitle: string;
    travelDate: string;
    guests: number;
  }>;
}

export interface CustomerRequestItem {
  reference: string;
  status: string;
  title: string;
  createdAt: Date;
}

export interface CustomerCarRequestItem extends CustomerRequestItem {
  vehicleSlug: string;
  tripType: string;
}

export interface CustomerPaymentItem {
  reference: string;
  bookingReference: string;
  status: string;
  currency: string;
  amount: number;
  amountPaid: number;
  createdAt: Date;
}

export interface CustomerFavoriteItem {
  itemType: string;
  itemSlug: string;
  createdAt: Date;
}

export interface CustomerConversationItem {
  reference: string;
  subject: string | null;
  status: string;
  lastMessageAt: Date;
  messageCount: number;
}

export interface CustomerDetail extends CustomerListItem {
  bookings: CustomerBookingItem[];
  tripRequests: CustomerRequestItem[];
  carRequests: CustomerCarRequestItem[];
  eventRequests: CustomerRequestItem[];
  payments: CustomerPaymentItem[];
  favorites: CustomerFavoriteItem[];
  conversations: CustomerConversationItem[];
}

function displayNameOf(firstName: string | null, lastName: string | null, email: string): string {
  const name = [firstName, lastName].filter(Boolean).join(' ');
  return name || email.split('@')[0]!;
}

const money = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const customerSelect = {
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
} as const;

/** All users holding the CUSTOMER role (pure customers and dual-role alike). */
export async function listCustomers(): Promise<CustomerListItem[]> {
  const rows = await db.user.findMany({
    where: { roles: { some: { role: { key: 'CUSTOMER' } } } },
    select: {
      ...customerSelect,
      bookings: { select: { total: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => ({
    publicId: row.publicId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    displayName: displayNameOf(row.firstName, row.lastName, row.email),
    username: row.username,
    countryCode: row.countryCode,
    phone: row.phone,
    status: row.status,
    emailVerifiedAt: row.emailVerifiedAt,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    bookingsCount: row.bookings.length,
    totalSpent: row.bookings.reduce((sum, b) => sum + money(b.total), 0),
    confirmedSpent: row.bookings
      .filter((b) => b.status === 'CONFIRMED')
      .reduce((sum, b) => sum + money(b.total), 0),
    lastBookingAt: row.bookings[0]?.createdAt ?? null,
  }));
}

/** Full customer aggregate. Relations come only from existing FK links — never fabricated. */

/** Full customer aggregate. Relations come only from existing FK links — never fabricated. */
export async function getCustomerDetail(publicId: string): Promise<CustomerDetail> {
  const user = await db.user.findUnique({
    where: { publicId },
    select: {
      id: true,
      ...customerSelect,
      roles: { select: { role: { select: { key: true } } } },
    },
  });
  if (!user || !user.roles.some((r) => r.role.key === 'CUSTOMER')) {
    throw new UserManagementError(404, 'Customer not found.');
  }
  const userId = user.id;

  const [bookings, tripRequests, carRequests, eventRequests, favorites, conversations] =
    await Promise.all([
      db.booking.findMany({
        where: { userId },
        select: {
          reference: true,
          status: true,
          paymentStatus: true,
          currency: true,
          total: true,
          createdAt: true,
          items: {
            select: { tourSlug: true, tourTitle: true, travelDate: true, adults: true, children: true, infants: true },
          },
          payments: {
            select: {
              reference: true,
              status: true,
              currency: true,
              amount: true,
              amountPaid: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.tripRequest.findMany({
        where: { userId },
        select: { reference: true, status: true, customTitle: true, tourSlug: true, destinationSlug: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.carRequest.findMany({
        where: { userId },
        select: { reference: true, status: true, vehicleSlug: true, tripType: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.eventRequest.findMany({
        where: { userId },
        select: { reference: true, status: true, eventTitle: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.favoriteItem.findMany({
        where: { userId },
        select: { itemType: true, itemSlug: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.supportConversation.findMany({
        where: { customerId: userId },
        select: {
          reference: true,
          subject: true,
          status: true,
          lastMessageAt: true,
          _count: { select: { messages: true } },
        },
        orderBy: { lastMessageAt: 'desc' },
      }),
    ]);

  const payments: CustomerPaymentItem[] = [];
  for (const booking of bookings) {
    for (const payment of booking.payments) {
      payments.push({
        reference: payment.reference,
        bookingReference: booking.reference,
        status: payment.status,
        currency: payment.currency,
        amount: money(payment.amount),
        amountPaid: money(payment.amountPaid),
        createdAt: payment.createdAt,
      });
    }
  }
  payments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    publicId: user.publicId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: displayNameOf(user.firstName, user.lastName, user.email),
    username: user.username,
    countryCode: user.countryCode,
    phone: user.phone,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    bookingsCount: bookings.length,
    totalSpent: bookings.reduce((sum, b) => sum + money(b.total), 0),
    confirmedSpent: bookings
      .filter((b) => b.status === 'CONFIRMED')
      .reduce((sum, b) => sum + money(b.total), 0),
    lastBookingAt: bookings[0]?.createdAt ?? null,
    bookings: bookings.map((b) => ({
      reference: b.reference,
      status: b.status,
      paymentStatus: b.paymentStatus,
      currency: b.currency,
      total: money(b.total),
      createdAt: b.createdAt,
      items: b.items.map((item) => ({
        tourSlug: item.tourSlug,
        tourTitle: item.tourTitle,
        travelDate: item.travelDate,
        guests: item.adults + item.children + item.infants,
      })),
    })),
    tripRequests: tripRequests.map((r) => ({
      reference: r.reference,
      status: r.status,
      title: r.customTitle || r.tourSlug || r.destinationSlug || r.reference,
      createdAt: r.createdAt,
    })),
    carRequests: carRequests.map((r) => ({
      reference: r.reference,
      status: r.status,
      title: r.vehicleSlug,
      vehicleSlug: r.vehicleSlug,
      tripType: r.tripType,
      createdAt: r.createdAt,
    })),
    eventRequests: eventRequests.map((r) => ({
      reference: r.reference,
      status: r.status,
      title: r.eventTitle,
      createdAt: r.createdAt,
    })),
    payments,
    favorites: favorites.map((f) => ({
      itemType: f.itemType,
      itemSlug: f.itemSlug,
      createdAt: f.createdAt,
    })),
    conversations: conversations.map((c) => ({
      reference: c.reference,
      subject: c.subject,
      status: c.status,
      lastMessageAt: c.lastMessageAt,
      messageCount: c._count.messages,
    })),
  };
}

/**
 * Customer-only status transitions (ACTIVE <-> SUSPENDED; PENDING may be
 * activated). Accounts holding any staff role are managed under
 * Users & Roles instead, so a status change here can never silently
 * revoke dashboard access. Suspending destroys sessions immediately;
 * reactivation restores login through the standard status gate.
 */
export async function setCustomerStatus(
  targetPublicId: string,
  status: 'ACTIVE' | 'SUSPENDED',
  actor: ActorRef,
): Promise<CustomerListItem> {
  if (status !== 'ACTIVE' && status !== 'SUSPENDED') {
    throw new UserManagementError(400, 'Select a valid status.');
  }
  return db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { publicId: targetPublicId },
      select: {
        id: true,
        ...customerSelect,
        roles: { select: { role: { select: { key: true } } } },
      },
    });
    if (!target || !target.roles.some((r) => r.role.key === 'CUSTOMER')) {
      throw new UserManagementError(404, 'Customer not found.');
    }
    if (target.roles.some((r) => r.role.key !== 'CUSTOMER')) {
      throw new UserManagementError(
        404,
        'This account holds a staff role - manage it under Users & Roles.',
      );
    }
    const targetId = target.id;
    if (targetId === actor.id) {
      throw new UserManagementError(
        403,
        'You cannot change your own status. Ask another Super Admin.',
      );
    }
    const updated = await tx.user.update({
      where: { id: targetId },
      data: { status },
      select: {
        ...customerSelect,
        bookings: { select: { total: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (status === 'SUSPENDED') {
      await tx.session.deleteMany({ where: { userId: targetId } });
    }
    return {
      publicId: updated.publicId,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      displayName: displayNameOf(updated.firstName, updated.lastName, updated.email),
      username: updated.username,
      countryCode: updated.countryCode,
      phone: updated.phone,
      status: updated.status,
      emailVerifiedAt: updated.emailVerifiedAt,
      lastLoginAt: updated.lastLoginAt,
      createdAt: updated.createdAt,
      bookingsCount: updated.bookings.length,
      totalSpent: updated.bookings.reduce((sum, b) => sum + money(b.total), 0),
      confirmedSpent: updated.bookings
        .filter((b) => b.status === 'CONFIRMED')
        .reduce((sum, b) => sum + money(b.total), 0),
      lastBookingAt: updated.bookings[0]?.createdAt ?? null,
    };
  });
}
