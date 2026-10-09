// Server-side logging utilities
// Phase 2F-B: Provider-neutral payment gateway foundation
// Structured logging for payment events, webhooks, and audit trails

import 'server-only'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
}

/** Formats a log entry as JSON */
function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify({
    timestamp: entry.timestamp,
    level: entry.level,
    message: entry.message,
    ...entry.context,
  })
}

/** Writes a log entry to stdout (or configured logging service) */
function writeLog(level: LogLevel, message: string, context?: LogContext): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  }

  // In production, write to configured logging service (Datadog, CloudWatch, etc.)
  // For now, write to stdout with structured JSON
  console.log(formatLogEntry(entry))
}

/** Logs a debug message */
export function logDebug(message: string, context?: LogContext): void {
  if (process.env.NODE_ENV === 'development') {
    writeLog('debug', message, context)
  }
}

/** Logs an informational message */
export function logInfo(message: string, context?: LogContext): void {
  writeLog('info', message, context)
}

/** Logs a warning */
export function logWarn(message: string, context?: LogContext): void {
  writeLog('warn', message, context)
}

/** Logs an error */
export function logError(message: string, context?: LogContext): void {
  writeLog('error', message, context)
}

/** Logs a payment webhook event */
export function logPaymentWebhook(params: {
  provider: string
  eventId: string
  eventType: string
  success: boolean
  error?: string
  paymentReference?: string
  durationMs: number
}): void {
  writeLog(params.success ? 'info' : 'error', `Payment webhook ${params.success ? 'processed' : 'failed'}`, {
    type: 'payment_webhook',
    provider: params.provider,
    eventId: params.eventId,
    eventType: params.eventType,
    success: params.success,
    error: params.error,
    paymentReference: params.paymentReference,
    durationMs: params.durationMs,
  })
}

/** Logs a payment initiation */
export function logPaymentInitiation(params: {
  paymentReference: string
  bookingReference: string
  amountCents: number
  currency: string
  userId: string | null
  provider: string
  created: boolean
}): void {
  writeLog('info', 'Payment initiated', {
    type: 'payment_initiation',
    paymentReference: params.paymentReference,
    bookingReference: params.bookingReference,
    amountCents: params.amountCents,
    currency: params.currency,
    userId: params.userId,
    provider: params.provider,
    created: params.created,
  })
}

/** Logs a payment transition */
export function logPaymentTransition(params: {
  paymentReference: string
  fromStatus: string
  toStatus: string
  actor: string
  amountPaidCents?: number
  amountRefundedCents?: number
  providerPaymentId?: string
  success: boolean
  error?: string
}): void {
  writeLog(params.success ? 'info' : 'error', `Payment transition ${params.fromStatus} -> ${params.toStatus}`, {
    type: 'payment_transition',
    paymentReference: params.paymentReference,
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    actor: params.actor,
    amountPaidCents: params.amountPaidCents,
    amountRefundedCents: params.amountRefundedCents,
    providerPaymentId: params.providerPaymentId,
    success: params.success,
    error: params.error,
  })
}

/** Logs a checkout session creation */
export function logCheckoutSession(params: {
  paymentReference: string
  bookingReference: string
  provider: string
  amountCents: number
  currency: string
  userId: string | null
  success: boolean
  redirectUrl?: string
  error?: string
}): void {
  writeLog(params.success ? 'info' : 'error', `Checkout session ${params.success ? 'created' : 'failed'}`, {
    type: 'checkout_session',
    paymentReference: params.paymentReference,
    bookingReference: params.bookingReference,
    provider: params.provider,
    amountCents: params.amountCents,
    currency: params.currency,
    userId: params.userId,
    success: params.success,
    redirectUrl: params.redirectUrl,
    error: params.error,
  })
}

/** Logs an authorization decision */
export function logAuthorization(params: {
  userId: string | null
  action: string
  resource: string
  resourceId: string
  allowed: boolean
  reason?: string
}): void {
  writeLog(params.allowed ? 'info' : 'warn', `Authorization ${params.allowed ? 'granted' : 'denied'}`, {
    type: 'authorization',
    userId: params.userId,
    action: params.action,
    resource: params.resource,
    resourceId: params.resourceId,
    allowed: params.allowed,
    reason: params.reason,
  })
}

/** Logs a security event */
export function logSecurityEvent(params: {
  event: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  userId?: string | null
  ip?: string
  userAgent?: string
  details?: Record<string, unknown>
}): void {
  writeLog(params.severity === 'critical' || params.severity === 'high' ? 'error' : 'warn', `Security event: ${params.event}`, {
    type: 'security_event',
    event: params.event,
    severity: params.severity,
    userId: params.userId,
    ip: params.ip,
    userAgent: params.userAgent,
    details: params.details,
  })
}