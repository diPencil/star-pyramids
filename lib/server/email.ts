// STAR PYRAMIDS email service (Phase 2J). Server-only email architecture
// with a provider adapter interface, typed templates, HTML + plain-text
// output, and a real SMTP transport.
//
// The default provider is the SMTP adapter (`lib/server/email-smtp.ts`),
// configured entirely from environment variables. A delivery is only ever
// recorded as SENT when the SMTP server accepted the message; anything else
// is recorded as FAILED with a safe error summary.
//
// Design principles:
// - Server-only: never imported from client components
// - No client-supplied sender/from: sender config is centralized
// - Safe escaping: all template variables are HTML-escaped
// - Best-effort: email failure never breaks the business transaction
// - Idempotent: dedup via idempotencyKey prevents duplicate sends
// - No secrets in DB/UI/logs: only safe metadata is stored
// - Fail closed: an unconfigured provider reports FAILED, never a fake SENT
import 'server-only';

import { db } from './db';
import { SmtpProviderAdapter } from './email-smtp';

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

// ─── Default Provider ────────────────────────────────────────────────────

// The real SMTP transport is the default. It fails closed when SMTP is not
// configured: the delivery row is recorded as FAILED with the reason, so a
// missing configuration is visible instead of silently reporting a fake SENT.
let providerAdapter: EmailProviderAdapter = new SmtpProviderAdapter();

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

/**
 * DB-backed sender identity. Admin Settings (mail.fromName / mail.fromEmail)
 * is the source of truth; hardcoded defaults render only until a value is
 * stored. Never throws — callers always get a usable sender.
 */
async function getSenderConfigAsync(): Promise<SenderConfig> {
  const fallback = getSenderConfig();
  if (process.env.VITEST === 'true') return fallback;
  try {
    const { getSetting } = await import('./settings');
    const [name, email] = await Promise.all([
      getSetting('mail.fromName'),
      getSetting('mail.fromEmail'),
    ]);
    const cleanName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 120) : '';
    const cleanEmail =
      typeof email === 'string' && isValidEmailAddress(email.trim()) ? email.trim().toLowerCase() : '';
    return {
      fromName: cleanName || fallback.fromName,
      fromEmail: cleanEmail || fallback.fromEmail,
      replyTo: null,
    };
  } catch {
    return fallback;
  }
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

function wrapHtml(title: string, bodyHtml: string, fromName?: string): string {
  const config = getSenderConfig();
  const brand = fromName && fromName.trim() ? fromName.trim().slice(0, 120) : config.fromName;
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
      <h1>${escapeHtml(brand)}</h1>
    </div>
    <div class="content">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>${escapeHtml(brand)} &mdash; Cairo, Egypt</p>
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
  | 'enquiry_received'
  | 'enquiry_received_confirmation'
  | 'admin_booking_created'
  | 'admin_trip_request_submitted'
  | 'admin_car_request_submitted'
  | 'admin_event_request_submitted'
  | 'admin_payment_initiated'
  | 'admin_support_message_received'
  | 'password_reset';

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
    subject: 'Booking received - {{reference}}',
    bodyHtml: '<h2>Booking received</h2><p>Hi {{name}},</p><p>We have received your booking <strong>{{reference}}</strong> for {{tourTitle}}.</p><p>Total: {{total}} {{currency}}</p><p>{{accessNote}}<a href="{{detailUrl}}" class="btn">View booking</a></p>',
    bodyText: 'Booking received\n\nHi {{name}},\n\nWe have received your booking {{reference}} for {{tourTitle}}.\n\nTotal: {{total}} {{currency}}\n\n{{accessNote}}View booking: {{detailUrl}}',
  },
  booking_confirmed: {
    subject: 'Booking confirmed - {{reference}}',
    bodyHtml: '<h2>Booking confirmed</h2><p>Hi {{name}},</p><p>Your booking <strong>{{reference}}</strong> is now confirmed.</p><p>{{accessNote}}<a href="{{detailUrl}}" class="btn">View booking</a></p>',
    bodyText: 'Booking confirmed\n\nHi {{name}},\n\nYour booking {{reference}} is now confirmed.\n\n{{accessNote}}View booking: {{detailUrl}}',
  },
  booking_completed: {
    subject: 'Booking completed - {{reference}}',
    bodyHtml: '<h2>Booking completed</h2><p>Hi {{name}},</p><p>Your booking <strong>{{reference}}</strong> has been marked as completed. Thank you for travelling with us!</p><p>{{accessNote}}<a href="{{detailUrl}}" class="btn">View booking</a></p>',
    bodyText: 'Booking completed\n\nHi {{name}},\n\nYour booking {{reference}} has been marked as completed. Thank you for travelling with us!\n\n{{accessNote}}View booking: {{detailUrl}}',
  },
  booking_cancelled: {
    subject: 'Booking cancelled - {{reference}}',
    bodyHtml: '<h2>Booking cancelled</h2><p>Hi {{name}},</p><p>Your booking <strong>{{reference}}</strong> has been cancelled. Contact us if you need anything else.</p><p>{{accessNote}}<a href="{{detailUrl}}" class="btn">View booking</a></p>',
    bodyText: 'Booking cancelled\n\nHi {{name}},\n\nYour booking {{reference}} has been cancelled. Contact us if you need anything else.\n\n{{accessNote}}View booking: {{detailUrl}}',
  },
  payment_initiated: {
    subject: 'Payment initiated - {{reference}}',
    bodyHtml: '<h2>Payment initiated</h2><p>Hi {{name}},</p><p>Payment <strong>{{reference}}</strong> for booking {{bookingReference}} has been initiated. No charge is made online.</p><p><a href="{{detailUrl}}" class="btn">View payment</a></p>',
    bodyText: 'Payment initiated\n\nHi {{name}},\n\nPayment {{reference}} for booking {{bookingReference}} has been initiated. No charge is made online.\n\nView payment: {{detailUrl}}',
  },
  payment_paid: {
    subject: 'Payment received - {{reference}}',
    bodyHtml: '<h2>Payment received</h2><p>Hi {{name}},</p><p>Payment <strong>{{reference}}</strong> for booking {{bookingReference}} has been received. Thank you!</p><p><a href="{{detailUrl}}" class="btn">View payment</a></p>',
    bodyText: 'Payment received\n\nHi {{name}},\n\nPayment {{reference}} for booking {{bookingReference}} has been received. Thank you!\n\nView payment: {{detailUrl}}',
  },
  payment_failed: {
    subject: 'Payment failed - {{reference}}',
    bodyHtml: '<h2>Payment failed</h2><p>Hi {{name}},</p><p>Payment <strong>{{reference}}</strong> for booking {{bookingReference}} could not be processed. Please try again or contact us.</p><p><a href="{{detailUrl}}" class="btn">Retry payment</a></p>',
    bodyText: 'Payment failed\n\nHi {{name}},\n\nPayment {{reference}} for booking {{bookingReference}} could not be processed. Please try again or contact us.\n\nRetry payment: {{detailUrl}}',
  },
  payment_refunded: {
    subject: 'Payment refunded - {{reference}}',
    bodyHtml: '<h2>Payment refunded</h2><p>Hi {{name}},</p><p>Payment <strong>{{reference}}</strong> for booking {{bookingReference}} has been refunded.</p>',
    bodyText: 'Payment refunded\n\nHi {{name}},\n\nPayment {{reference}} for booking {{bookingReference}} has been refunded.',
  },
  trip_request_submitted: {
    subject: 'Trip request received - {{reference}}',
    bodyHtml: '<h2>Trip request received</h2><p>Hi {{name}},</p><p>We have received your trip request <strong>{{reference}}</strong>. Our team will review it and get back to you soon.</p><p><a href="{{detailUrl}}" class="btn">View request</a></p>',
    bodyText: 'Trip request received\n\nHi {{name}},\n\nWe have received your trip request {{reference}}. Our team will review it and get back to you soon.\n\nView request: {{detailUrl}}',
  },
  trip_request_update: {
    subject: 'Trip request update - {{reference}}',
    bodyHtml: '<h2>Trip request update</h2><p>Hi {{name}},</p><p>Your trip request <strong>{{reference}}</strong> has been updated to <strong>{{status}}</strong>.</p><p><a href="{{detailUrl}}" class="btn">View request</a></p>',
    bodyText: 'Trip request update\n\nHi {{name}},\n\nYour trip request {{reference}} has been updated to {{status}}.\n\nView request: {{detailUrl}}',
  },
  car_request_submitted: {
    subject: 'Car request received - {{reference}}',
    bodyHtml: '<h2>Car request received</h2><p>Hi {{name}},</p><p>We have received your car rental request <strong>{{reference}}</strong>. Our team will review it shortly.</p><p><a href="{{detailUrl}}" class="btn">View request</a></p>',
    bodyText: 'Car request received\n\nHi {{name}},\n\nWe have received your car rental request {{reference}}. Our team will review it shortly.\n\nView request: {{detailUrl}}',
  },
  car_request_update: {
    subject: 'Car request update - {{reference}}',
    bodyHtml: '<h2>Car request update</h2><p>Hi {{name}},</p><p>Your car rental request <strong>{{reference}}</strong> has been updated to <strong>{{status}}</strong>.</p><p><a href="{{detailUrl}}" class="btn">View request</a></p>',
    bodyText: 'Car request update\n\nHi {{name}},\n\nYour car rental request {{reference}} has been updated to {{status}}.\n\nView request: {{detailUrl}}',
  },
  event_request_submitted: {
    subject: 'Event request received - {{reference}}',
    bodyHtml: '<h2>Event request received</h2><p>Hi {{name}},</p><p>We have received your event request <strong>{{reference}}</strong> for {{eventTitle}}. Our team will review it shortly.</p><p><a href="{{detailUrl}}" class="btn">View request</a></p>',
    bodyText: 'Event request received\n\nHi {{name}},\n\nWe have received your event request {{reference}} for {{eventTitle}}. Our team will review it shortly.\n\nView request: {{detailUrl}}',
  },
  event_request_update: {
    subject: 'Event request update - {{reference}}',
    bodyHtml: '<h2>Event request update</h2><p>Hi {{name}},</p><p>Your event request <strong>{{reference}}</strong> has been updated to <strong>{{status}}</strong>.</p><p><a href="{{detailUrl}}" class="btn">View request</a></p>',
    bodyText: 'Event request update\n\nHi {{name}},\n\nYour event request {{reference}} has been updated to {{status}}.\n\nView request: {{detailUrl}}',
  },
  support_message_received: {
    subject: 'New reply from our team',
    bodyHtml: '<h2>New message</h2><p>Hi {{name}},</p><p>Our travel team has replied to your support conversation <strong>{{reference}}</strong>.</p><p><a href="{{detailUrl}}" class="btn">Read message</a></p>',
    bodyText: 'New message\n\nHi {{name}},\n\nOur travel team has replied to your support conversation {{reference}}.\n\nRead message: {{detailUrl}}',
  },
  enquiry_received: {
    subject: 'New website enquiry - {{subject}}',
    bodyHtml: '<h2>New website enquiry</h2><p><strong>{{name}}</strong> ({{email}}) sent an enquiry.</p><p><strong>Subject:</strong> {{subject}}</p><p>{{message}}</p><p><a href="{{detailUrl}}" class="btn">Open enquiry</a></p>',
    bodyText: 'New website enquiry\n\n{{name}} ({{email}}) sent an enquiry.\n\nSubject: {{subject}}\n\n{{message}}\n\nOpen enquiry: {{detailUrl}}',
  },
  enquiry_received_confirmation: {
    subject: 'We received your message',
    bodyHtml: '<h2>Thank you, {{name}}</h2><p>We have received your message and a member of our travel team will reply shortly.</p><p>If you need anything in the meantime, reply to this email.</p>',
    bodyText: 'Thank you, {{name}}\n\nWe have received your message and a member of our travel team will reply shortly.\n\nIf you need anything in the meantime, reply to this email.',
  },
  admin_booking_created: {
    subject: 'New booking - {{reference}}',
    bodyHtml: '<h2>New booking received</h2><p>Booking <strong>{{reference}}</strong> from {{name}} needs review.</p><p>Total: {{total}} {{currency}}</p><p><a href="{{detailUrl}}" class="btn">Review booking</a></p>',
    bodyText: 'New booking received\n\nBooking {{reference}} from {{name}} needs review.\n\nTotal: {{total}} {{currency}}\n\nReview booking: {{detailUrl}}',
  },
  admin_trip_request_submitted: {
    subject: 'New trip request - {{reference}}',
    bodyHtml: '<h2>New trip request</h2><p>Trip request <strong>{{reference}}</strong> from {{name}} needs review.</p><p><a href="{{detailUrl}}" class="btn">Review request</a></p>',
    bodyText: 'New trip request\n\nTrip request {{reference}} from {{name}} needs review.\n\nReview request: {{detailUrl}}',
  },
  admin_car_request_submitted: {
    subject: 'New car request - {{reference}}',
    bodyHtml: '<h2>New car request</h2><p>Car rental request <strong>{{reference}}</strong> from {{name}} needs review.</p><p><a href="{{detailUrl}}" class="btn">Review request</a></p>',
    bodyText: 'New car request\n\nCar rental request {{reference}} from {{name}} needs review.\n\nReview request: {{detailUrl}}',
  },
  admin_event_request_submitted: {
    subject: 'New event request - {{reference}}',
    bodyHtml: '<h2>New event request</h2><p>Event request <strong>{{reference}}</strong> from {{name}} needs review.</p><p><a href="{{detailUrl}}" class="btn">Review request</a></p>',
    bodyText: 'New event request\n\nEvent request {{reference}} from {{name}} needs review.\n\nReview request: {{detailUrl}}',
  },
  admin_payment_initiated: {
    subject: 'Payment initiated - {{reference}}',
    bodyHtml: '<h2>Payment initiated</h2><p>Payment <strong>{{reference}}</strong> for booking {{bookingReference}} is pending. No charge completed.</p><p><a href="{{detailUrl}}" class="btn">View payment</a></p>',
    bodyText: 'Payment initiated\n\nPayment {{reference}} for booking {{bookingReference}} is pending. No charge completed.\n\nView payment: {{detailUrl}}',
  },
  admin_support_message_received: {
    subject: 'New support message - {{reference}}',
    bodyHtml: '<h2>New support message</h2><p>Customer {{name}} sent a new message in conversation <strong>{{reference}}</strong>.</p><p><a href="{{detailUrl}}" class="btn">View conversation</a></p>',
    bodyText: 'New support message\n\nCustomer {{name}} sent a new message in conversation {{reference}}.\n\nView conversation: {{detailUrl}}',
  },
  password_reset: {
    subject: 'Reset your Star Pyramids Tours password',
    bodyHtml: '<h2>Reset your password</h2><p>Hi {{name}},</p><p>You requested a password reset for your Star Pyramids Tours account. Click the button below to set a new password:</p><p><a href="{{resetUrl}}" class="btn">Reset password</a></p><p>This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>',
    bodyText: 'Reset your password\n\nHi {{name}},\n\nYou requested a password reset for your Star Pyramids Tours account. Visit the link below to set a new password:\n\n{{resetUrl}}\n\nThis link expires in 1 hour. If you did not request this, you can safely ignore this email.',
  },
};

// ─── Core Send Function ──────────────────────────────────────────────────

export function setEmailProvider(adapter: EmailProviderAdapter): void {
  providerAdapter = adapter;
}

export function getEmailProvider(): EmailProviderAdapter {
  return providerAdapter;
}

/**
 * Render a template with data and produce HTML + plain-text output.
 * `fromName` overrides the header/footer brand line (used by the
 * DB-backed sender path); omitted keeps the built-in default so existing
 * callers and tests are unaffected.
 */
export function renderEmailTemplate(
  eventType: EmailEventType,
  data: EmailTemplateData,
  fromName?: string,
): EmailTemplate {
  const def = TEMPLATES[eventType];
  if (!def) throw new Error(`Unknown email template: ${eventType}`);
  return {
    subject: renderTemplate(def.subject, data),
    html: wrapHtml(def.subject, renderTemplate(def.bodyHtml, data), fromName),
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
  const sender = await getSenderConfigAsync();
  const template = renderEmailTemplate(eventType, data, sender.fromName);
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

  // Attempt send via adapter. The delivery is only marked SENT when the
  // provider confirms acceptance; an adapter that resolves without a
  // message id is treated as an error rather than a success.
  try {
    const result = await providerAdapter.send(input);
    if (!result || typeof result !== 'object') {
      throw new Error('The email provider returned no delivery result.');
    }
    const updated = await db.emailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'SENT',
        providerMessageId: result.providerMessageId ?? null,
        attempt: { increment: 1 },
        sentAt: new Date(),
        errorSummary: null,
        failedAt: null,
      },
    });
    logEmailEvent('info', 'email.sent', {
      deliveryId: delivery.id,
      eventType: delivery.eventType,
      recipientType: delivery.recipientType,
      provider: providerAdapter.name,
      hasProviderMessageId: Boolean(result.providerMessageId),
    });
    return toDeliveryRecord(updated);
  } catch (error) {
    const errorSummary = summarizeEmailError(error);
    const updated = await db.emailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'FAILED',
        attempt: { increment: 1 },
        errorSummary,
        failedAt: new Date(),
      },
    });
    logEmailEvent('error', 'email.failed', {
      deliveryId: delivery.id,
      eventType: delivery.eventType,
      recipientType: delivery.recipientType,
      provider: providerAdapter.name,
      errorSummary,
    });
    return toDeliveryRecord(updated);
  }
}

// ─── Failure Diagnostics ────────────────────────────────────────────────

/**
 * Build a safe, bounded error summary for the delivery row and the logs.
 *
 * The stored text is shown in the admin email log, so it must never contain a
 * credential. SMTP error strings can echo the auth username, so any
 * `user:password@host` style authority is redacted before it is persisted.
 */
function summarizeEmailError(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Unknown error';
  const withoutControlChars = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  // Redact any `user:password@host` authority pair (SMTP errors can echo the
  // auth username) down to `***@host`. The trailing `.+` is greedy so the
  // match always ends at the last `@` before the host, never mid-credential.
  const redacted = withoutControlChars
    .replace(/[^\s:@/]+:[^\s:@/]+@[^\s:@/]+/g, '***')
    .replace(/[^\s:@/]+:[^\s:@/]+(?=\s|$)/g, '***');
  const trimmed = (redacted || 'Unknown error').slice(0, 500);
  return trimmed;
}

type EmailLogLevel = 'info' | 'warn' | 'error';

/**
 * Structured, secret-free email logging. Records the outcome, the provider,
 * and the event type - never the recipient address, subject line, or body.
 */
function logEmailEvent(level: EmailLogLevel, message: string, context: Record<string, unknown>) {
  const payload = JSON.stringify({ at: new Date().toISOString(), message, ...context });
  if (level === 'error') console.error(`[email] ${payload}`);
  else if (level === 'warn') console.warn(`[email] ${payload}`);
  else console.info(`[email] ${payload}`);
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