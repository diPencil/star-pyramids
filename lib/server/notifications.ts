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
 *  success is never fabricated.
 *
 *  The `admin_*` types reuse the SAME notifications table for staff
 *  recipients: each staff user owns their own rows (userId = staff
 *  user), created server-side when a real customer event commits. No
 *  schema change is needed — the model is already recipient-generic. */
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
  'admin_booking_created',
  'admin_trip_request_submitted',
  'admin_car_request_submitted',
  'admin_event_request_submitted',
  'admin_payment_initiated',
  'support_message_received',
  'admin_support_message_received',
  'admin_enquiry_received',
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
  | 'event_request_update'
  | 'admin_booking_created'
  | 'admin_trip_request_submitted'
  | 'admin_car_request_submitted'
  | 'admin_event_request_submitted'
  | 'admin_payment_initiated'
  | 'support_message_received'
  | 'admin_support_message_received'
  | 'admin_enquiry_received';

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

/** Exact href builders for support-chat notifications. The conversation
 *  reference is embedded so read-sync can scope to one thread with an
 *  exact href match — never substring matching. */
export function customerSupportHref(reference: string): string {
  return `/account/messages?conversation=${encodeURIComponent(reference)}`;
}

export function adminSupportHref(reference: string): string {
  return `/admin/inbox?conversation=${encodeURIComponent(reference)}`;
}

/** Legacy customer support href (pre-conversation-scoping). Included in
 *  read-sync sets so older "go read your messages" pointers resolve
 *  when the customer opens their thread. */
export const LEGACY_CUSTOMER_SUPPORT_HREF = '/account/messages';

/**
 * Mark unread notifications read for one recipient, one type, and an
 * exact set of hrefs. Used ONLY by read-sync when a conversation is
 * opened: recipient + type + href scoping guarantees unrelated
 * notifications (other types, other threads, other users) are never
 * touched. Returns rows changed.
 */
export async function markNotificationsReadByHref(
  userId: string,
  type: string,
  hrefs: string[],
): Promise<number> {
  if (!NOTIFICATION_TYPES.has(type)) return 0;
  // Fail closed: blank/whitespace/malformed hrefs must never widen the
  // match — an empty `IN ()` set would otherwise risk broad updates.
  const exact = [...new Set(hrefs)].filter((href) => typeof href === 'string' && href.trim() !== '' && href.length <= HREF_MAX && isValidHref(href));
  if (exact.length === 0) return 0;
  const result = await db.notification.updateMany({
    where: { userId, type, href: { in: exact }, readAt: null },
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

/**
 * Staff roles eligible for admin operational notifications. Every
 * ACTIVE user holding one of these roles receives one recipient-owned
 * row per real customer event — no shared rows, no cross-recipient
 * reads (the list/mark APIs stay userId-scoped).
 */
const STAFF_ROLE_KEYS = ['SUPER_ADMIN', 'ADMIN', 'STAFF'] as const;

/** ACTIVE staff user ids eligible for admin notifications. */
export async function listActiveStaffUserIds(): Promise<string[]> {
  const rows = await db.user.findMany({
    where: {
      status: 'ACTIVE',
      roles: { some: { role: { key: { in: [...STAFF_ROLE_KEYS] } } } },
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

/**
 * Best-effort fan-out to all eligible staff users: one recipient-owned
 * notification per staff user for a real customer event. Called ONLY
 * from trusted domain services after the event commits — never from
 * client input, never for reads/edits/notes/retries. Guest activity is
 * included (staff must see it); idempotent replays must call this only
 * on the `created:true` path so a retried key never notifies twice.
 * Failures never roll back the domain transaction.
 */
export async function notifyStaff(input: NotificationInput): Promise<void> {
  try {
    const staffIds = await listActiveStaffUserIds();
    if (staffIds.length === 0) return;
    if (!NOTIFICATION_TYPES.has(input.type)) return;
    const title = input.title.trim();
    const message = input.message.trim();
    if (title === '' || title.length > TITLE_MAX) return;
    if (message === '' || message.length > MESSAGE_MAX) return;
    const href = input.href ?? null;
    if (href !== null && (href.length > HREF_MAX || !isValidHref(href))) return;
    await db.notification.createMany({
      data: staffIds.map((userId) => ({
        userId,
        type: input.type,
        title,
        message,
        href,
      })),
    });
  } catch {
    /* staff notifications never fail the domain operation */
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
