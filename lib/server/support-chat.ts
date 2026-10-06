// Support-chat domain service (Phase 2I). Server owns conversation
// lifecycle, ownership, message validation, sender identity, and read
// state. The browser supplies message BODIES ONLY (and an optional
// subject on creation) — never sender IDs, roles, references,
// ownership, status, assignment, or read markers.
//
// Thread model: one thread per customer need. The customer UX centers
// on their latest thread (closed threads stay read-only history; the
// next customer message opens a fresh thread). Staff work from a
// cross-customer inbox keyed by conversation reference. Message
// creation notifies the OTHER side best-effort (never the sender) and
// notification failure never breaks message creation.
import 'server-only';

import { randomInt } from 'node:crypto';
import { Prisma, SupportConversationStatus as DbStatus } from '@prisma/client';

import { db } from './db';
import {
  adminSupportHref,
  customerSupportHref,
  notifyStaff,
  notifyUser,
} from './notifications';
import { sendCustomerEmailSafe, sendStaffEmailSafe } from './email';

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const REF_ATTEMPTS = 5;
const REF_PATTERN = /^SP-CV-[A-Z0-9]{6}$/;

function mintReferenceCandidate(): string {
  let suffix = '';
  for (let i = 0; i < 6; i += 1) suffix += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `SP-CV-${suffix}`;
}

export type SupportRole = 'customer' | 'staff';
export type SupportConversationStatus = 'open' | 'closed';

const BODY_MAX = 2000;
const SUBJECT_MAX = 160;

function hasControlChars(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Lone surrogates are valid UTF-16 but not valid Unicode scalar values:
 * MySQL (utf8mb4) rejects them with a 500-class error. Reject them with
 * a truthful 400 instead of letting the insert fail opaquely.
 */
function hasLoneSurrogates(value: string): boolean {
  return /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/.test(value);
}

/** Strict server validation of message bodies: plain text, 1–2000 chars. */
export function validateMessageBody(input: unknown): string {
  if (typeof input !== 'string') throw new Error('Write a message first.');
  const body = input.trim();
  if (body === '') throw new Error('Write a message first.');
  if (body.length > BODY_MAX) {
    throw new Error(`Messages must be ${BODY_MAX.toLocaleString('en-US')} characters or fewer.`);
  }
  if (hasControlChars(body)) throw new Error('Messages contain unsupported characters.');
  if (hasLoneSurrogates(body)) throw new Error('Messages contain unsupported characters.');
  return body;
}

function validateSubject(input: unknown): string | null {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'string') throw new Error('Invalid request.');
  const subject = input.trim();
  if (subject === '') return null;
  if (subject.length > SUBJECT_MAX || hasControlChars(subject)) {
    throw new Error('Invalid request.');
  }
  return subject;
}

export interface SupportMessageView {
  id: string;
  senderRole: SupportRole;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface SupportConversationView {
  reference: string;
  subject: string;
  status: SupportConversationStatus;
  assignedStaffEmail: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  unreadCount: number;
}

export interface StaffConversationView extends SupportConversationView {
  customer: { email: string; name: string };
  lastMessage: { senderRole: SupportRole; body: string; createdAt: string } | null;
}

type ConversationRow = Prisma.SupportConversationGetPayload<{
  include: {
    customer: { select: { email: true; firstName: true; lastName: true } };
    assignee: { select: { email: true } };
    messages: true;
  };
}>;

function accountName(row: { firstName: string | null; lastName: string | null; email: string }): string {
  const full = `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim();
  return full || row.email;
}

function toMessageView(row: { id: string; senderRole: string; body: string; readAt: Date | null; createdAt: Date }): SupportMessageView {
  return {
    id: row.id,
    senderRole: row.senderRole === 'staff' ? 'staff' : 'customer',
    body: row.body,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toConversationView(row: ConversationRow, viewerRole: SupportRole): SupportConversationView {
  return {
    reference: row.reference,
    subject: row.subject ?? '',
    status: row.status === 'CLOSED' ? 'closed' : 'open',
    assignedStaffEmail: row.assignee?.email ?? null,
    lastMessageAt: row.lastMessageAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    unreadCount: row.messages.filter((m) => m.readAt === null && m.senderRole !== viewerRole).length,
  };
}

function toStaffView(row: ConversationRow): StaffConversationView {
  const ordered = [...row.messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const last = ordered[ordered.length - 1] ?? null;
  return {
    ...toConversationView(row, 'staff'),
    customer: { email: row.customer.email, name: accountName(row.customer) },
    lastMessage: last
      ? {
          senderRole: last.senderRole === 'staff' ? 'staff' : 'customer',
          body: last.body,
          createdAt: last.createdAt.toISOString(),
        }
      : null,
  };
}

const threadInclude = {
  customer: { select: { email: true, firstName: true, lastName: true } },
  assignee: { select: { email: true } },
  messages: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.SupportConversationInclude;

/** Latest thread of the customer (open or closed) with its messages. */
export async function getCustomerThread(customerId: string): Promise<{
  conversation: SupportConversationView | null;
  messages: SupportMessageView[];
  unreadCount: number;
}> {
  const row = await db.supportConversation.findFirst({
    where: { customerId },
    orderBy: { updatedAt: 'desc' },
    include: threadInclude,
  });
  if (!row) return { conversation: null, messages: [], unreadCount: 0 };
  const view = toConversationView(row, 'customer');
  return {
    conversation: view,
    messages: [...row.messages]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(toMessageView),
    unreadCount: view.unreadCount,
  };
}

/** Unread staff messages across all of the customer's threads. */
export async function countCustomerUnread(customerId: string): Promise<number> {
  return db.supportMessage.count({
    where: {
      senderRole: 'staff',
      readAt: null,
      conversation: { customerId },
    },
  });
}

/**
 * Customer send: appends to the latest OPEN thread, or opens a fresh
 * thread when none is open (closed threads stay read-only history).
 * Notifies ACTIVE staff best-effort — never the sender, never twice
 * for one message, never breaking message creation.
 */
export async function sendCustomerMessage(
  customerId: string,
  rawBody: unknown,
  rawSubject?: unknown,
): Promise<{ conversation: SupportConversationView; message: SupportMessageView }> {
  const body = validateMessageBody(rawBody);
  const subject = validateSubject(rawSubject);
  let open = await db.supportConversation.findFirst({
    where: { customerId, status: 'OPEN' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, reference: true },
  });
  if (!open) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < REF_ATTEMPTS; attempt += 1) {
      try {
        open = await db.supportConversation.create({
          data: {
            reference: mintReferenceCandidate(),
            customerId,
            subject,
            status: 'OPEN',
          },
          select: { id: true, reference: true },
        });
        lastError = null;
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    if (!open) throw lastError instanceof Error ? lastError : new Error('Could not start the conversation. Please try again.');
  }
  const message = await db.supportMessage.create({
    data: {
      conversationId: open.id,
      senderId: customerId,
      senderRole: 'customer',
      body,
    },
  });
  await db.supportConversation.update({
    where: { id: open.id },
    data: { lastMessageAt: message.createdAt },
  });
  const reference = open.reference;
  // Staff inbox notification (best-effort, one per message).
  await notifyStaff({
    type: 'admin_support_message_received',
    title: 'New support message',
    message: `New customer message in conversation ${reference}.`,
    href: adminSupportHref(reference),
  });
  // Staff email alert (best-effort — never breaks message creation).
  // Idempotency key uses the message id so each message alerts once.
  try {
    const sender = await db.user.findUnique({
      where: { id: customerId },
      select: { email: true, firstName: true, lastName: true },
    });
    const senderName = sender
      ? `${sender.firstName ?? ''} ${sender.lastName ?? ''}`.trim() || sender.email
      : 'Customer';
    await sendStaffEmailSafe('admin_support_message_received', {
      name: senderName,
      reference,
      detailUrl: adminSupportHref(reference),
    }, { relatedReference: reference, idempotencyKey: `admin_support_message:${message.id}` });
  } catch {
    /* email never breaks message creation */
  }
  const thread = await db.supportConversation.findUnique({
    where: { id: open.id },
    include: threadInclude,
  });
  if (!thread) throw new Error('Could not start the conversation. Please try again.');
  return {
    conversation: toConversationView(thread, 'customer'),
    message: toMessageView(message),
  };
}

/** Mark the customer's incoming staff messages read. Returns rows changed. */
export async function markCustomerThreadRead(customerId: string): Promise<number> {
  const result = await db.supportMessage.updateMany({
    where: {
      senderRole: 'staff',
      readAt: null,
      conversation: { customerId },
    },
    data: { readAt: new Date() },
  });
  return result.count;
}

/** All conversation references owned by the customer (for exact read-sync scoping). */
export async function listCustomerThreadReferences(customerId: string): Promise<string[]> {
  const rows = await db.supportConversation.findMany({
    where: { customerId },
    select: { reference: true },
  });
  return rows.map((row) => row.reference);
}

export interface StaffConversationFilters {
  status?: SupportConversationStatus;
  query?: string;
}

/** Cross-customer staff inbox, newest activity first. */
export async function listStaffConversations(
  filters: StaffConversationFilters = {},
): Promise<StaffConversationView[]> {
  const where: Prisma.SupportConversationWhereInput = {};
  if (filters.status === 'open') where.status = 'OPEN';
  else if (filters.status === 'closed') where.status = 'CLOSED';
  const q = filters.query?.trim();
  if (q) {
    where.OR = [
      { reference: { contains: q } },
      { subject: { contains: q } },
      { customer: { email: { contains: q } } },
      { customer: { firstName: { contains: q } } },
      { customer: { lastName: { contains: q } } },
    ];
  }
  const rows = await db.supportConversation.findMany({
    where,
    orderBy: { lastMessageAt: 'desc' },
    include: threadInclude,
  });
  return rows.map(toStaffView);
}

/** Total unread customer messages across every thread (staff badge). */
export async function countStaffUnread(): Promise<number> {
  return db.supportMessage.count({
    where: { senderRole: 'customer', readAt: null },
  });
}

function assertValidReference(reference: string): void {
  if (!REF_PATTERN.test(reference)) throw new Error('Conversation not found.');
}

/**
 * Server-side diagnostic log for support-chat failures. Logs the action,
 * conversation reference, and error class/message only — never message
 * bodies or user content. Logging itself never breaks the request.
 */
export function logSupportError(action: string, reference: string, error: unknown): void {
  try {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : typeof error;
    console.error(`[support-chat] ${action} failed ref=${reference} :: ${detail}`);
  } catch {
    /* logging never breaks the request */
  }
}

/** One staff-visible thread with chronological history. */
export async function getStaffConversation(
  reference: string,
): Promise<{ conversation: StaffConversationView; messages: SupportMessageView[] } | null> {
  if (!REF_PATTERN.test(reference)) return null;
  const row = await db.supportConversation.findUnique({
    where: { reference },
    include: threadInclude,
  });
  if (!row) return null;
  return {
    conversation: toStaffView(row),
    messages: [...row.messages]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(toMessageView),
  };
}

/** Mark a thread's incoming customer messages read. Returns rows changed. */
export async function markStaffThreadRead(reference: string): Promise<number> {
  assertValidReference(reference);
  const result = await db.supportMessage.updateMany({
    where: {
      senderRole: 'customer',
      readAt: null,
      conversation: { reference },
    },
    data: { readAt: new Date() },
  });
  return result.count;
}

/**
 * Staff reply: OPEN threads only (replying to a closed thread is
 * rejected — reopen it first). Notifies the owning customer
 * best-effort — never the sender, never breaking the reply.
 */
export async function sendStaffMessage(
  reference: string,
  staffId: string,
  rawBody: unknown,
): Promise<{ conversation: StaffConversationView; message: SupportMessageView }> {
  const body = validateMessageBody(rawBody);
  assertValidReference(reference);
  const existing = await db.supportConversation.findUnique({
    where: { reference },
    select: { id: true, status: true, customerId: true },
  });
  if (!existing) throw new Error('Conversation not found.');
  if (existing.status !== 'OPEN') {
    throw new Error('This conversation is closed. Reopen it before replying.');
  }
  const message = await db.supportMessage.create({
    data: {
      conversationId: existing.id,
      senderId: staffId,
      senderRole: 'staff',
      body,
    },
  });
  await db.supportConversation.update({
    where: { id: existing.id },
    data: { lastMessageAt: message.createdAt },
  });
  // Customer receipt (best-effort, one per reply). The href embeds
  // the conversation reference so read-sync can scope exactly.
  await notifyUser(existing.customerId, {
    type: 'support_message_received',
    title: 'New reply from our team',
    message: 'Our travel team replied to your message. Read it here.',
    href: customerSupportHref(reference),
  });
  // Customer email receipt (best-effort — never breaks the reply).
  // Goes to the owning customer's account email only. Idempotency
  // key uses the message id so each reply emails once.
  try {
    const owner = await db.user.findUnique({
      where: { id: existing.customerId },
      select: { email: true, firstName: true, lastName: true },
    });
    if (owner) {
      const ownerName = `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim() || owner.email;
      await sendCustomerEmailSafe('support_message_received', owner.email, {
        name: ownerName,
        reference,
        detailUrl: customerSupportHref(reference),
      }, { relatedReference: reference, idempotencyKey: `support_message:${message.id}` });
    }
  } catch {
    /* email never breaks the reply */
  }
  const thread = await db.supportConversation.findUnique({
    where: { id: existing.id },
    include: threadInclude,
  });
  if (!thread) throw new Error('Conversation not found.');
  return {
    conversation: toStaffView(thread),
    message: toMessageView(message),
  };
}

/** Close or reopen a thread (staff only). Idempotent per state. */
export async function setConversationStatus(
  reference: string,
  to: SupportConversationStatus,
): Promise<StaffConversationView | null> {
  assertValidReference(reference);
  const existing = await db.supportConversation.findUnique({
    where: { reference },
    select: { id: true, status: true },
  });
  if (!existing) return null;
  const target: DbStatus = to === 'closed' ? 'CLOSED' : 'OPEN';
  if (existing.status === target) {
    const row = await db.supportConversation.findUnique({
      where: { id: existing.id },
      include: threadInclude,
    });
    return row ? toStaffView(row) : null;
  }
  const now = new Date();
  const row = await db.supportConversation.update({
    where: { id: existing.id },
    data: {
      status: target,
      closedAt: to === 'closed' ? now : null,
    },
    include: threadInclude,
  });
  return toStaffView(row);
}

/** Assign a thread to the acting staff member (server-derived identity). */
export async function assignConversationToSelf(
  reference: string,
  staffId: string,
): Promise<StaffConversationView | null> {
  assertValidReference(reference);
  const existing = await db.supportConversation.findUnique({
    where: { reference },
    select: { id: true },
  });
  if (!existing) return null;
  const row = await db.supportConversation.update({
    where: { id: existing.id },
    data: { assignedStaffId: staffId },
    include: threadInclude,
  });
  return toStaffView(row);
}
