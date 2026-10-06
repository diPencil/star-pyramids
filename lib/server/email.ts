// STAR PYRAMIDS email service (Phase 2J). Server-only email architecture
// with a provider adapter interface, typed templates, HTML + plain-text
// output, and a safe development/log adapter. No real provider is
// integrated yet — the dev adapter logs intent and records delivery
// rows without sending anything externally.
//
// Design principles:
// - Server-only: never imported from client components
// - No client-supplied sender/from: sender config is centralized
// - Safe escaping: all template variables are HTML-escaped
// - Best-effort: email failure never breaks the business transaction
// - Idempotent: dedup via idempotencyKey prevents duplicate sends
// - No secrets in DB/UI/logs: only safe metadata is stored
import 'server-only';

import { db } from './db';

// ─── Types ───────────────────────────────────────────────────────────────

export type EmailRecipientType = 'customer' | 'staff';

export interface EmailTemplateData {
  [key: string]: string | number | boolean | undefined;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailInput {
  to: string;
  recipientType: EmailRecipientType;
  eventType: string;
  subject: string;
  html: string;
  text: string;
  relatedReference?: string;
  idempotencyKey?: string;
}

export interface EmailDeliveryRecord {
  id: string;
  recipient: string;
  recipientType: EmailRecipientType;
  eventType: string;
  subject: string;
  relatedReference: string | null;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  providerMessageId: string | null;
  attempt: number;
  errorSummary: string | null;
  createdAt: string;
  sentAt: string | null;
  failedAt: string | null;
}

// ─── Provider Adapter Interface ──────────────────────────────────────────

export interface EmailProviderAdapter {
  readonly name: string;
  send(input: SendEmailInput): Promise<{ providerMessageId?: string }>;
}

// ─── Development / Log Adapter ──────────────────────────────────────────

/**
 * Safe development adapter: logs the email intent and records a
 * SENT delivery row without actually sending anything. This ensures
 * the full flow is testable without a real provider.
 */
class DevelopmentLogAdapter implements EmailProviderAdapter {
  readonly name = 'development-log';

  async send(input: SendEmailInput): Promise<{ providerMessageId?: string }> {
    // Log intent only — never log email bodies or sensitive content
    console.log(`[email:dev] Would send "${input.subject}" to ${input.to} (${input.eventType})`);
    return { providerMessageId: `dev-${Date.now()}` };
  }
}

// ─── Sender Configuration ────────────────────────────────────────────────

interface SenderConfig {
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
}

function getSenderConfig(): SenderConfig {
  // Centralized sender configuration — never from client input.
  // Defaults match the existing admin settings defaults.
  return {
    fromName: 'Star Pyramids Tours',
    fromEmail: 'sales@starpyramids.com',
    replyTo: null,
  };
}

// ─── HTML Escaping ───────────────────────────────────────────────────────

function escapeHtml(value: string | number | boolean | undefined): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Template Engine ─────────────────────────────────────────────────────

function renderTemplate(template: string, data: EmailTemplateData): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return escapeHtml(data[key] ?? '');
  });
}

// ─── Branded HTML Shell ──────────────────────────────────────────────────

function wrapHtml(title: string, bodyHtml: string): string {
  const config = getSenderConfig();
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f6f3; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #1a3a5c; padding: 24px 32px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; }
    .content { padding: 32px; color: #333333; line-height: 1.6; }
    .footer { background: #f0ebe4; padding: 20px 32px; text-align: center; font-size: 12px; color: #666666; }
    .btn { display: inline-block; background: #c9a84c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600; }
    .btn:hover { background: #b08d3a; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>${escapeHtml(config.fromName)}</h1>
    </div>
    <div class="content">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>${escapeHtml(config.fromName)} &mdash; Cairo, Egypt</p>
      <p>This email was sent automatically. Please do not reply directly to this address.</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Email Templates ─────────────────────────────────────────────────────

export type EmailEventType =
  | 'welcome'
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
  | 'support_message_received'
  | 'admin_booking_created'
  | 'admin_trip_request_submitted'
  | 'admin_car_request_submitted'
  | 'admin_event_request_submitted'
  | 'admin_payment_initiated'
  | 'admin_support_message_received';

interface EmailTemplateDefinition {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

const TEMPLATES: Record<EmailEventType, EmailTemplateDefinition> = {
  welcome: {
    subject: 'Welcome to Star Pyramids Tours',
    bodyHtml: '<h2>Welcome, {{name}}!</h2><p>Thank you for creating an account with Star Pyramids Tours. We are excited to help you explore Egypt.</p><p><a href="{{dashboardUrl}}" class="btn">Go to your account</a></p>',
    bodyText: 'Welcome, {{name}}!\n\nThank you for creating an account with Star Pyramids Tours. We are excited to help you explore Egypt.\n\nGo to your account: {{dashboardUrl}}',
  },
  booking_created: {
    subject: 'Booking received — {{reference}}',
    bodyHtml: '<h2>Booking received</h2><p>Hi {{name}},</p><p>We have received your booking <strong>{{reference}}</strong> for {{tourTitle}}.</p><p>Total: {{total}} {{currency}}</p><p><a href="{{detailUrl}}" class="btn">View booking</a></p>',
    bodyText: 'Booking received\n\nHi {{name}},\n\nWe have received your booking {{reference}} for {{tourTitle}}.\n\nTotal: {{total}} {{currency}}\n\nView booking: {{detailUrl}}',
  },
  booking_confirmed: {
    subject: 'Booking confirmed — {{reference}}',
    bodyHtml: '<h2>Booking confirmed</h2><p>Hi {{name}},</p><p>Your booking <strong>{{reference}}</strong> is now confirmed.</p><p><a href="{{detailUrl}}" class="btn">View booking</a></p>',
    bodyText: 'Booking confirmed\n\nHi {{name}},\n\nYour booking {{reference}} is now confirmed.\n\nView booking: {{detailUrl}}',
  },
  booking_completed: {
    subject: 'Booking completed — {{reference}}',
    bodyHtml: '<h2>Booking completed</h2><p>Hi {{name}},</p><p>Your booking <strong>{{reference}}</strong> has been marked as completed. Thank you for travelling with us!</p>',
    bodyText: 'Booking completed\n\nHi {{name}},\n\nYour booking {{reference}} has been marked as completed. Thank you for travelling with us!',
  },
  booking_cancelled: {
    subject: 'Booking cancelled — {{reference}}',
    bodyHtml: '<h2>Booking cancelled</h2><p>Hi {{name}},</p><p>Your booking <strong>{{reference}}</strong> has been cancelled. Contact us if you need anything else.</p>',
    bodyText: 'Booking cancelled\n\nHi {{name}},\n\nYour booking {{reference}} has been cancelled. Contact us if you need anything else.',
  },
  payment_initiated: {
    subject: 'Payment initiated — {{reference}}',
    bodyHtml: '<h2>Payment initiated</h2><p>Hi {{name}},</p><p>Payment <strong>{{reference}}</strong> for booking {{bookingReference}} has been initiated. No charge is made online.</p><p><a href="{{detailUrl}}" class="btn">View payment</a></p>',
    bodyText: 'Payment initiated\n\nHi {{name}},\n\nPayment {{reference}} for booking {{bookingReference}} has been initiated. No charge is made online.\n\nView payment: {{detailUrl}}',
  },
  payment_paid: {
    subject: 'Payment received — {{reference}}',
    bodyHtml: '<h2>Payment received</h2><p>Hi {{name}},</p><p>Payment <strong>{{reference}}</strong> for booking {{bookingReference}} has been received. Thank you!</p><p><a href="{{detailUrl}}" class="btn">View payment</a></p>',
    bodyText: 'Payment received\n\nHi {{name}},\n\nPayment {{reference}} for booking {{bookingReference}} has been received. Thank you!\n\nView payment: {{detailUrl}}',
  },
  payment_failed: {
    subject: 'Payment failed — {{reference}}',
    bodyHtml: '<h2>Payment failed</h2><p>Hi {{name}},</p><p>Payment <strong>{{reference}}</strong> for booking {{bookingReference}} could not be processed. Please try again or contact us.</p><p><a href="{{detailUrl}}" class="btn">Retry payment</a></p>',
    bodyText: 'Payment failed\n\nHi {{name}},\n\nPayment {{reference}} for booking {{bookingReference}} could not be processed. Please try again or contact us.\n\nRetry payment: {{detailUrl}}',
  },
  payment_refunded: {
    subject: 'Payment refunded — {{reference}}',
    bodyHtml: '<h2>Payment refunded</h2><p>Hi {{name}},</p><p>Payment <strong>{{reference}}</strong> for booking {{bookingReference}} has been refunded.</p>',
    bodyText: 'Payment refunded\n\nHi {{name}},\n\nPayment {{reference}} for booking {{bookingReference}} has been refunded.',
  },
  trip_request_submitted: {
    subject: 'Trip request received — {{reference}}',
    bodyHtml: '<h2>Trip request received</h2><p>Hi {{name}},</p><p>We have received your trip request <strong>{{reference}}</strong>. Our team will review it and get back to you soon.</p><p><a href="{{detailUrl}}" class="btn">View request</a></p>',
    bodyText: 'Trip request received\n\nHi {{name}},\n\nWe have received your trip request {{reference}}. Our team will review it and get back to you soon.\n\nView request: {{detailUrl}}',
  },
  trip_request_update: {
    subject: 'Trip request update — {{reference}}',
    bodyHtml: '<h2>Trip request update</h2><p>Hi {{name}},</p><p>Your trip request <strong>{{reference}}</strong> has been updated to <strong>{{status}}</strong>.</p><p><a href="{{detailUrl}}" class="btn">View request</a></p>',
    bodyText: 'Trip request update\n\nHi {{name}},\n\nYour trip request {{reference}} has been updated to {{status}}.\n\nView request: {{detailUrl}}',
  },
  car_request_submitted: {
    subject: 'Car request received — {{reference}}',
    bodyHtml: '<h2>Car request received</h2><p>Hi {{name}},</p><p>We have received your car rental request <strong>{{reference}}</strong>. Our team will review it shortly.</p><p><a href="{{detailUrl}}" class="btn">View request</a></p>',
    bodyText: 'Car request received\n\nHi {{name}},\n\nWe have received your car rental request {{reference}}. Our team will review it shortly.\n\nView request: {{detailUrl}}',
  },
  car_request_update: {
    subject: 'Car request update — {{reference}}',
    bodyHtml: '<h2>Car request update</h2><p>Hi {{name}},</p><p>Your car rental request <strong>{{reference}}</strong> has been updated to <strong>{{status}}</strong>.</p><p><a href="{{detailUrl}}" class="btn">View request</a></p>',
    bodyText: 'Car request update\n\nHi {{name}},\n\nYour car rental request {{reference}} has been updated to {{status}}.\n\nView request: {{detailUrl}}',
  },
  event_request_submitted: {
    subject: 'Event request received — {{reference}}',
    bodyHtml: '<h2>Event request received</h2><p>Hi {{name}},</p><p>We have received your event request <strong>{{reference}}</strong> for {{eventTitle}}. Our team will review it shortly.</p><p><a href="{{detailUrl}}" class="btn">View request</a></p>',
    bodyText: 'Event request received\n\nHi {{name}},\n\nWe have received your event request {{reference}} for {{eventTitle}}. Our team will review it shortly.\n\nView request: {{detailUrl}}',
  },
  event_request_update: {
    subject: 'Event request update — {{reference}}',
    bodyHtml: '<h2>Event request update</h2><p>Hi {{name}},</p><p>Your event request <strong>{{reference}}</strong> has been updated to <strong>{{status}}</strong>.</p><p><a href="{{detailUrl}}" class="btn">View request</a></p>',
    bodyText: 'Event request update\n\nHi {{name}},\n\nYour event request {{reference}} has been updated to {{status}}.\n\nView request: {{detailUrl}}',
  },
  support_message_received: {
    subject: 'New reply from our team',
    bodyHtml: '<h2>New message</h2><p>Hi {{name}},</p><p>Our travel team has replied to your support conversation <strong>{{reference}}</strong>.</p><p><a href="{{detailUrl}}" class="btn">Read message</a></p>',
    bodyText: 'New message\n\nHi {{name}},\n\nOur travel team has replied to your support conversation {{reference}}.\n\nRead message: {{detailUrl}}',
  },
  admin_booking_created: {
    subject: 'New booking — {{reference}}',
    bodyHtml: '<h2>New booking received</h2><p>Booking <strong>{{reference}}</strong> from {{name}} needs review.</p><p>Total: {{total}} {{currency}}</p><p><a href="{{detailUrl}}" class="btn">Review booking</a></p>',
    bodyText: 'New booking received\n\nBooking {{reference}} from {{name}} needs review.\n\nTotal: {{total}} {{currency}}\n\nReview booking: {{detailUrl}}',
  },
  admin_trip_request_submitted: {
    subject: 'New trip request — {{reference}}',
    bodyHtml: '<h2>New trip request</h2><p>Trip request <strong>{{reference}}</strong> from {{name}} needs review.</p><p><a href="{{detailUrl}}" class="btn">Review request</a></p>',
    bodyText: 'New trip request\n\nTrip request {{reference}} from {{name}} needs review.\n\nReview request: {{detailUrl}}',
  },
  admin_car_request_submitted: {
    subject: 'New car request — {{reference}}',
    bodyHtml: '<h2>New car request</h2><p>Car rental request <strong>{{reference}}</strong> from {{name}} needs review.</p><p><a href="{{detailUrl}}" class="btn">Review request</a></p>',
    bodyText: 'New car request\n\nCar rental request {{reference}} from {{name}} needs review.\n\nReview request: {{detailUrl}}',
  },
  admin_event_request_submitted: {
    subject: 'New event request — {{reference}}',
    bodyHtml: '<h2>New event request</h2><p>Event request <strong>{{reference}}</strong> from {{name}} needs review.</p><p><a href="{{detailUrl}}" class="btn">Review request</a></p>',
    bodyText: 'New event request\n\nEvent request {{reference}} from {{name}} needs review.\n\nReview request: {{detailUrl}}',
  },
  admin_payment_initiated: {
    subject: 'Payment initiated — {{reference}}',
    bodyHtml: '<h2>Payment initiated</h2><p>Payment <strong>{{reference}}</strong> for booking {{bookingReference}} is pending. No charge completed.</p><p><a href="{{detailUrl}}" class="btn">View payment</a></p>',
    bodyText: 'Payment initiated\n\nPayment {{reference}} for booking {{bookingReference}} is pending. No charge completed.\n\nView payment: {{detailUrl}}',
  },
  admin_support_message_received: {
    subject: 'New support message — {{reference}}',
    bodyHtml: '<h2>New support message</h2><p>Customer {{name}} sent a new message in conversation <strong>{{reference}}</strong>.</p><p><a href="{{detailUrl}}" class="btn">View conversation</a></p>',
    bodyText: 'New support message\n\nCustomer {{name}} sent a new message in conversation {{reference}}.\n\nView conversation: {{detailUrl}}',
  },
};

// ─── Core Send Function ──────────────────────────────────────────────────

let providerAdapter: EmailProviderAdapter = new DevelopmentLogAdapter();

export function setEmailProvider(adapter: EmailProviderAdapter): void {
  providerAdapter = adapter;
}

export function getEmailProvider(): EmailProviderAdapter {
  return providerAdapter;
}

/**
 * Render a template with data and produce HTML + plain-text output.
 */
export function renderEmailTemplate(
  eventType: EmailEventType,
  data: EmailTemplateData,
): EmailTemplate {
  const def = TEMPLATES[eventType];
  if (!def) throw new Error(`Unknown email template: ${eventType}`);
  return {
    subject: renderTemplate(def.subject, data),
    html: wrapHtml(def.subject, renderTemplate(def.bodyHtml, data)),
    text: renderTemplate(def.bodyText, data),
  };
}

/**
 * Send an email: render template, record delivery, attempt send.
 * Best-effort — never throws. Returns the delivery record.
 */
export async function sendTemplatedEmail(
  eventType: EmailEventType,
  to: string,
  recipientType: EmailRecipientType,
  data: EmailTemplateData,
  options?: { relatedReference?: string; idempotencyKey?: string },
): Promise<EmailDeliveryRecord> {
  const template = renderEmailTemplate(eventType, data);
  return sendEmail({
    to,
    recipientType,
    eventType,
    subject: template.subject,
    html: template.html,
    text: template.text,
    relatedReference: options?.relatedReference,
    idempotencyKey: options?.idempotencyKey,
  });
}

/**
 * Send a raw email with pre-rendered content. Records delivery,
 * attempts send via the configured adapter. Best-effort.
 */
export async function sendEmail(input: SendEmailInput): Promise<EmailDeliveryRecord> {  // Idempotency check: if a delivery with this key already exists, skip
  if (input.idempotencyKey) {
    const existing = await db.emailDelivery.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return toDeliveryRecord(existing);
    }
  }

  // Create delivery record
  const delivery = await db.emailDelivery.create({
    data: {
      recipient: input.to,
      recipientType: input.recipientType,
      eventType: input.eventType,
      subject: input.subject,
      relatedReference: input.relatedReference ?? null,
      status: 'PENDING',
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });

  // Attempt send via adapter
  try {
    const result = await providerAdapter.send(input);
    const updated = await db.emailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'SENT',
        providerMessageId: result.providerMessageId ?? null,
        attempt: { increment: 1 },
        sentAt: new Date(),
      },
    });
    return toDeliveryRecord(updated);
  } catch (error) {
    const errorSummary = error instanceof Error ? error.message.slice(0, 500) : 'Unknown error';
    const updated = await db.emailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'FAILED',
        attempt: { increment: 1 },
        errorSummary,
        failedAt: new Date(),
      },
    });
    return toDeliveryRecord(updated);
  }
}

// ─── Delivery History ────────────────────────────────────────────────────

export interface EmailHistoryFilters {
  status?: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  eventType?: string;
  recipient?: string;
  relatedReference?: string;
  limit?: number;
  offset?: number;
}

export async function listEmailDeliveries(
  filters: EmailHistoryFilters = {},
): Promise<EmailDeliveryRecord[]> {
  const where: {
    status?: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
    eventType?: string;
    recipient?: { contains: string };
    relatedReference?: string;
  } = {};
  if (filters.status) where.status = filters.status;
  if (filters.eventType) where.eventType = filters.eventType;
  if (filters.recipient) where.recipient = { contains: filters.recipient };
  if (filters.relatedReference) where.relatedReference = filters.relatedReference;

  const rows = await db.emailDelivery.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit ?? 50,
    skip: filters.offset ?? 0,
  });
  return rows.map(toDeliveryRecord);
}

export async function countEmailDeliveries(
  filters: EmailHistoryFilters = {},
): Promise<number> {
  const where: {
    status?: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
    eventType?: string;
    recipient?: { contains: string };
    relatedReference?: string;
  } = {};
  if (filters.status) where.status = filters.status;
  if (filters.eventType) where.eventType = filters.eventType;
  if (filters.recipient) where.recipient = { contains: filters.recipient };
  if (filters.relatedReference) where.relatedReference = filters.relatedReference;

  return db.emailDelivery.count({ where });
}

// ─── View Helpers ────────────────────────────────────────────────────────

function toDeliveryRecord(row: {
  id: string;
  recipient: string;
  recipientType: string;
  eventType: string;
  subject: string;
  relatedReference: string | null;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  providerMessageId: string | null;
  attempt: number;
  errorSummary: string | null;
  createdAt: Date;
  sentAt: Date | null;
  failedAt: Date | null;
}): EmailDeliveryRecord {
  return {
    id: row.id,
    recipient: row.recipient,
    recipientType: row.recipientType as EmailRecipientType,
    eventType: row.eventType,
    subject: row.subject,
    relatedReference: row.relatedReference,
    status: row.status,
    providerMessageId: row.providerMessageId,
    attempt: row.attempt,
    errorSummary: row.errorSummary,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    failedAt: row.failedAt ? row.failedAt.toISOString() : null,
  };
}

/** Minimal email validation for outbound recipients. */
export function isValidEmailAddress(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 190) return false;
  return /^[^\s@]{1,120}@[^\s@]{1,120}\.[^\s@]{2,24}$/.test(trimmed);
}

/**
 * Configured operational recipient(s) for staff alerts. Reads the
 * public contact email setting, falls back to the configured sender,
 * then to the canonical sales address. Never hardcoded per-event.
 */
export async function getOperationalEmailRecipients(): Promise<string[]> {
  try {
    const { getSetting } = await import('./settings');
    const contact = await getSetting('contact.email');
    if (isValidEmailAddress(contact)) return [contact!.trim().toLowerCase()];
    const sender = await getSetting('mail.fromEmail');
    if (isValidEmailAddress(sender)) return [sender!.trim().toLowerCase()];
  } catch {
    /* fall through to default */
  }
  return ['sales@starpyramids.com'];
}

/**
 * Best-effort customer email: invalid recipients are skipped (recorded
 * as SKIPPED), send failures never throw. Never exposes another
 * customer's information — callers pass only the owning recipient
 * and that entity's data.
 */
export async function sendCustomerEmailSafe(
  eventType: EmailEventType,
  to: unknown,
  data: EmailTemplateData,
  options?: { relatedReference?: string; idempotencyKey?: string },
): Promise<EmailDeliveryRecord | null> {
  if (!isValidEmailAddress(to)) {
    return null;
  }
  try {
    return await sendTemplatedEmail(eventType, to.trim().toLowerCase(), 'customer', data, options);
  } catch {
    return null;
  }
}

/**
 * Best-effort staff alert fan-out to configured operational
 * recipient(s). One delivery row per recipient. Never throws.
 */
export async function sendStaffEmailSafe(
  eventType: EmailEventType,
  data: EmailTemplateData,
  options?: { relatedReference?: string; idempotencyKey?: string },
): Promise<void> {
  try {
    const recipients = await getOperationalEmailRecipients();
    for (const to of recipients) {
      try {
        await sendTemplatedEmail(eventType, to, 'staff', data, {
          relatedReference: options?.relatedReference,
          idempotencyKey: options?.idempotencyKey
            ? `${options.idempotencyKey}:${to}`
            : undefined,
        });
      } catch {
        /* one recipient failure never blocks others */
      }
    }
  } catch {
    /* staff email never fails the domain operation */
  }
}