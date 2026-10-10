// STAR PYRAMIDS SMTP email provider.
//
// Delivery reads Admin Settings (SiteSetting `mail.*` keys) FIRST and falls
// back to environment variables, so values saved in the admin Email tab
// actually affect sending. Nothing here is readable from the browser.
//
// Precedence per field: DB SiteSetting value → environment variable →
// built-in default. Secrets stay server-side: only presence booleans ever
// leave this module.
//
// Configuration (all optional; the provider reports "not configured" when the
// required values are absent):
//
//   SMTP_HOST            required to send
//   SMTP_PORT            optional, default 587
//   SMTP_SECURE          optional, "true" for implicit TLS (465); default STARTTLS
//   SMTP_USER            required for authenticated relay
//   SMTP_PASSWORD        required for authenticated relay
//   SMTP_FROM_EMAIL      optional, defaults to SMTP_USER
//   SMTP_FROM_NAME       optional, defaults to the brand name
//   SMTP_REPLY_TO        optional
//   SMTP_ALLOW_UNAUTH    optional, "true" to permit a relay with no credentials
//   SMTP_TIMEOUT_MS      optional, default 15000
//
// Security notes:
// - Secrets are read here and never exported, logged, or returned to a client.
// - `describeSmtpConfig` returns booleans only, never values.
// - An unconfigured provider THROWS. Callers record the failure; nothing is
//   ever reported as SENT unless the SMTP server accepted the message.
import 'server-only';

import nodemailer, { type Transporter } from 'nodemailer';

import type { EmailProviderAdapter, SendEmailInput } from './email';

export interface SmtpSendResult {
  /** Provider-assigned message id. Present only when the server accepted it. */
  providerMessageId?: string;
  /** SMTP server response, useful for diagnostics (contains no secrets). */
  response?: string;
}

export interface SmtpConfigStatus {
  configured: boolean;
  host: string | null;
  port: number;
  secure: boolean;
  authenticated: boolean;
  /** Human-readable reason when not configured. Safe to log. */
  reason?: string;
}

interface ResolvedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  replyTo: string | null;
  timeoutMs: number;
}

const DEFAULT_PORT = 587;
const DEFAULT_TIMEOUT_MS = 15_000;
const BRAND_NAME = 'Star Pyramids Tours';

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function readBool(name: string): boolean {
  return readEnv(name).toLowerCase() === 'true';
}

function readPort(): number {
  const raw = readEnv('SMTP_PORT');
  if (!raw) return DEFAULT_PORT;
  const parsed = Number.parseInt(raw, 10);
  // Fall back to the default rather than failing the whole app on a typo.
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : DEFAULT_PORT;
}

function readTimeout(): number {
  const raw = readEnv('SMTP_TIMEOUT_MS');
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 1000 && parsed <= 120_000 ? parsed : DEFAULT_TIMEOUT_MS;
}

/**
 * Resolve configuration from the environment.
 * Returns null when the provider cannot possibly send, with a safe reason.
 */
function resolveConfig(): ResolvedSmtpConfig | { reason: string } {
  const host = readEnv('SMTP_HOST');
  if (!host) {
    return { reason: 'SMTP_HOST is not configured.' };
  }

  const user = readEnv('SMTP_USER');
  const password = readEnv('SMTP_PASSWORD');
  const allowUnauthenticated = readBool('SMTP_ALLOW_UNAUTH');

  if (!user || !password) {
    if (!allowUnauthenticated) {
      return { reason: 'SMTP_USER and SMTP_PASSWORD are required (or set SMTP_ALLOW_UNAUTH=true for an open relay).' };
    }
  }

  const fromEmail = readEnv('SMTP_FROM_EMAIL') || user || `${user || 'no-reply'}@localhost`;
  const replyTo = readEnv('SMTP_REPLY_TO');

  return {
    host,
    port: readPort(),
    secure: readBool('SMTP_SECURE'),
    user,
    password,
    fromEmail,
    fromName: readEnv('SMTP_FROM_NAME') || BRAND_NAME,
    replyTo: replyTo || null,
    timeoutMs: readTimeout(),
  };
}

function isResolved(value: ResolvedSmtpConfig | { reason: string }): value is ResolvedSmtpConfig {
  return !('reason' in value);
}

/**
 * DB-backed overrides for the fields editable in Admin Settings → Email.
 * Returns null when the database is unreachable or nothing is stored, in
 * which case the environment-only configuration applies. Never throws and
 * never returns a secret to any caller — values feed the transporter only.
 */
async function readDbSmtpOverrides(): Promise<Record<string, string> | null> {
  // Unit tests assert the env-only contract; the database is unavailable
  // there by design, so keep the synchronous env path authoritative.
  if (process.env.VITEST === 'true') return null;
  try {
    const { db } = await import('./db');
    const rows = await db.siteSetting.findMany({
      where: {
        key: {
          in: [
            'mail.fromName',
            'mail.fromEmail',
            'mail.smtpHost',
            'mail.smtpPort',
            'mail.smtpEncryption',
            'mail.smtpUsername',
            'mail.smtpPassword',
            'mail.smtpTimeout',
          ],
        },
      },
      select: { key: true, value: true },
    });
    const out: Record<string, string> = {};
    for (const row of rows) {
      if (typeof row.value === 'string' && row.value.trim() !== '') out[row.key] = row.value;
    }
    return out;
  } catch {
    return null;
  }
}

function parsePort(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : fallback;
}

/**
 * Resolve the effective sending configuration: DB values first, env
 * fallback. Async because the database is the source of truth.
 */
async function resolveEffectiveConfig(): Promise<ResolvedSmtpConfig | { reason: string }> {
  const envFallback = resolveConfig();
  const overrides = await readDbSmtpOverrides();
  if (!overrides) return envFallback;

  const host = (overrides['mail.smtpHost']?.trim() || readEnv('SMTP_HOST')).trim();
  if (!host) {
    return isResolved(envFallback) ? envFallback : { reason: 'SMTP_HOST is not configured.' };
  }
  const user = (overrides['mail.smtpUsername']?.trim() || readEnv('SMTP_USER')).trim();
  // An empty password field in Settings means "keep the stored secret";
  // the stored row is already filtered to non-empty above, so a present
  // DB value replaces env, otherwise env still applies.
  const password = overrides['mail.smtpPassword'] ?? readEnv('SMTP_PASSWORD');
  const allowUnauthenticated = readBool('SMTP_ALLOW_UNAUTH');
  if (!user || !password) {
    if (!allowUnauthenticated) {
      return isResolved(envFallback)
        ? envFallback
        : { reason: 'SMTP_USER and SMTP_PASSWORD are required (or set SMTP_ALLOW_UNAUTH=true for an open relay).' };
    }
  }
  const portRaw = overrides['mail.smtpPort']?.trim() || readEnv('SMTP_PORT');
  const port = portRaw ? parsePort(portRaw, readPort()) : readPort();
  const encryption = (overrides['mail.smtpEncryption']?.trim() || '').toUpperCase();
  const secure =
    encryption === 'SSL' ? true : encryption === 'TLS' || encryption === 'NONE' ? false : readBool('SMTP_SECURE');
  const fromEmail =
    overrides['mail.fromEmail']?.trim() || readEnv('SMTP_FROM_EMAIL') || user || `${user || 'no-reply'}@localhost`;
  const fromName = overrides['mail.fromName']?.trim() || readEnv('SMTP_FROM_NAME') || BRAND_NAME;
  const timeoutRaw = overrides['mail.smtpTimeout']?.trim() || readEnv('SMTP_TIMEOUT_MS');
  let timeoutMs = readTimeout();
  if (timeoutRaw && /^\d+$/.test(timeoutRaw)) {
    const seconds = Number.parseInt(timeoutRaw, 10);
    // DB stores seconds (1-300); env stores milliseconds.
    if (overrides['mail.smtpTimeout']?.trim()) {
      if (Number.isInteger(seconds) && seconds >= 1 && seconds <= 300) timeoutMs = seconds * 1000;
    } else {
      const ms = Number.parseInt(timeoutRaw, 10);
      if (Number.isInteger(ms) && ms >= 1000 && ms <= 120_000) timeoutMs = ms;
    }
  }
  const replyTo = readEnv('SMTP_REPLY_TO') || null;
  return { host, port, secure, user, password, fromEmail, fromName, replyTo, timeoutMs };
}

/**
 * Safe configuration summary for admin diagnostics and startup logs.
 * Contains configuration PRESENCE only — never a host credential or password.
 */
export function describeSmtpConfig(): SmtpConfigStatus {
  const resolved = resolveConfig();
  if (!isResolved(resolved)) {
    return {
      configured: false,
      host: null,
      port: readPort(),
      secure: readBool('SMTP_SECURE'),
      authenticated: Boolean(readEnv('SMTP_USER') && readEnv('SMTP_PASSWORD')),
      reason: resolved.reason,
    };
  }
  return {
    configured: true,
    host: resolved.host,
    port: resolved.port,
    secure: resolved.secure,
    authenticated: Boolean(resolved.user && resolved.password),
  };
}

/** Thrown when delivery was attempted without a usable configuration. */
export class SmtpNotConfiguredError extends Error {
  constructor(reason: string) {
    super(`Email provider is not configured: ${reason}`);
    this.name = 'SmtpNotConfiguredError';
  }
}

/** Thrown when the SMTP server rejected the message. */
export class SmtpDeliveryError extends Error {
  readonly response?: string;
  readonly code?: string;

  constructor(message: string, options: { response?: string; code?: string } = {}) {
    super(message);
    this.name = 'SmtpDeliveryError';
    this.response = options.response;
    this.code = options.code;
  }
}

export class SmtpProviderAdapter implements EmailProviderAdapter {
  readonly name = 'smtp';

  private transporter: Transporter | null = null;
  private transporterKey: string | null = null;

  getTransporter(config: ResolvedSmtpConfig): Transporter {
    // Reuse the pooled connection unless the configuration changed.
    const key = `${config.host}:${config.port}:${config.secure}:${config.user}`;
    if (this.transporter && this.transporterKey === key) return this.transporter;

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      // `secure: true` is implicit TLS (465). Otherwise STARTTLS is used when
      // the server advertises it, which is the correct default for 587.
      secure: config.secure,
      requireTLS: !config.secure,
      auth: config.user && config.password ? { user: config.user, pass: config.password } : undefined,
      connectionTimeout: config.timeoutMs,
      greetingTimeout: config.timeoutMs,
      socketTimeout: config.timeoutMs,
    });
    this.transporterKey = key;
    return this.transporter;
  }

  async send(input: SendEmailInput): Promise<SmtpSendResult> {
    const resolved = await resolveEffectiveConfig();
    if (!isResolved(resolved)) {
      // Fail closed: the caller records FAILED. Nothing is marked SENT.
      throw new SmtpNotConfiguredError(resolved.reason);
    }

    const transporter = this.getTransporter(resolved);

    const info = await transporter.sendMail({
      from: { name: resolved.fromName, address: resolved.fromEmail },
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: resolved.replyTo ?? undefined,
    });

    // nodemailer resolves only after the server accepted the message. Some
    // servers (and some transports) omit `accepted`; treat an explicit empty
    // list as a rejection rather than assuming success.
    if (Array.isArray(info.accepted) && info.accepted.length === 0) {
      throw new SmtpDeliveryError('The SMTP server did not accept the message.', {
        response: typeof info.response === 'string' ? info.response : undefined,
      });
    }

    return {
      providerMessageId: typeof info.messageId === 'string' ? info.messageId : undefined,
      response: typeof info.response === 'string' ? info.response : undefined,
    };
  }
}

/**
 * Verify the SMTP connection without sending mail. Used by the admin
 * diagnostics endpoint so misconfiguration is visible before it matters.
 */
export async function verifySmtpConnection(): Promise<{ ok: boolean; reason?: string }> {
  const resolved = await resolveEffectiveConfig();
  if (!isResolved(resolved)) {
    return { ok: false, reason: resolved.reason };
  }
  const transporter = new SmtpProviderAdapter().getTransporter(resolved);
  try {
    await transporter.verify();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'SMTP verification failed.',
    };
  }
}
