// Customer in-app notification service (Phase 2H). Server owns the
// notification set: domain services create rows for real customer-facing
// events, and the customer reads/marks them through the account API.
// The browser NEVER creates notifications — there is no client create
// endpoint. Only display data is stored (type + title + message +
// optional relative target path); no sensitive payloads, no payment
// secrets, no internal staff notes. `readAt` NULL means unread.
import 'server-only';

import { db } from './db';

/** Closed set of customer-facing notification types. Payment
 *  success/failure/refund types exist for forward compatibility with
 *  the future provider phase — no emitter marks them today, so payment
 *  success is never fabricated. */
const NOTIFICATION_TYPES = new Set([
  'booking_created',
  'booking_confirmed',
  'booking_completed',
  'booking_cancelled',
  'payment_initiated',
  'payment_paid',
  'payment_failed',
  'payment_refunded',
  'trip_request_submitted',
  'trip_request_update',
  'car_request_submitted',
  'car_request_update',
  'event_request_submitted',
  'event_request_update',
]);

export type NotificationType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_completed'
  | 'booking_cancelled'
  | 'payment_initiated'
  | 'payment_paid'
  | 'payment_failed'
  | 'payment_refunded'
  | 'trip_request_submitted'
  | 'trip_request_update'
  | 'car_request_submitted'
  | 'car_request_update'
  | 'event_request_submitted'
  | 'event_request_update';

const TITLE_MAX = 160;
const MESSAGE_MAX = 500;
const HREF_MAX = 255;
const LIST_LIMIT = 50;

/** Targets must stay inside the app: relative paths only. */
function isValidHref(href: string): boolean {
  if (!href.startsWith('/')) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(href)) return false;
  return true;
}

export interface NotificationInput {
  type: string;
  title: string;
  message: string;
  href?: string | null;
}

export interface CustomerNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Server-side creation for one user. Called ONLY from trusted domain
 * services after a real event commits — never from client input.
 */
export async function createNotification(
  userId: string,
  input: NotificationInput,
): Promise<CustomerNotification> {
  if (!NOTIFICATION_TYPES.has(input.type)) throw new Error('Unsupported notification.');
  const title = input.title.trim();
  const message = input.message.trim();
  if (title === '' || title.length > TITLE_MAX) throw new Error('Invalid notification title.');
  if (message === '' || message.length > MESSAGE_MAX) throw new Error('Invalid notification message.');
  const href = input.href ?? null;
  if (href !== null && (href.length > HREF_MAX || !isValidHref(href))) {
    throw new Error('Invalid notification target.');
  }
  const row = await db.notification.create({
    data: { userId, type: input.type, title, message, href },
    select: { id: true, type: true, title: true, message: true, href: true, readAt: true, createdAt: true },
  });
  return toCustomerNotificationView(row);
}

/** Newest-first notifications for the customer. Empty when none. */
export async function listNotifications(userId: string): Promise<CustomerNotification[]> {
  const rows = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: LIST_LIMIT,
    select: { id: true, type: true, title: true, message: true, href: true, readAt: true, createdAt: true },
  });
  return rows.map(toCustomerNotificationView);
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

/**
 * Mark one notification read. Owner-scoped and idempotent: re-marking
 * an already-read row succeeds without writing.
 */
export async function markNotificationRead(userId: string, id: string): Promise<boolean> {
  if (typeof id !== 'string' || id === '') return false;
  const result = await db.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count > 0) return true;
  const owned = await db.notification.findFirst({ where: { id, userId }, select: { id: true } });
  return owned !== null;
}

/** Mark all of the customer's notifications read. Returns rows changed. */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

/**
 * Best-effort delivery from domain services: notifications must never
 * fail the underlying booking/payment/request operation. Failures are
 * swallowed so the real workflow always commits.
 */
export async function notifyUser(
  userId: string | null | undefined,
  input: NotificationInput,
): Promise<void> {
  if (!userId) return;
  try {
    await createNotification(userId, input);
  } catch {
    /* notifications never fail the domain operation */
  }
}

export function toCustomerNotificationView(row: {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}): CustomerNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    href: row.href,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
