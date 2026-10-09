// Shared error classes for server-side code
// Phase 2F-B: Provider-neutral payment gateway foundation

/** Base class for application errors with structured error codes */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace?.(this, this.constructor)
  }
}

/** Configuration is missing or invalid */
export class ConfigurationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_ERROR', 503, metadata)
    this.name = 'ConfigurationError'
  }
}

/** Input validation failed */
export class ValidationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, metadata)
    this.name = 'ValidationError'
  }
}

/** Authentication required or failed */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', metadata?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_ERROR', 401, metadata)
    this.name = 'AuthenticationError'
  }
}

/** Authorization failed (insufficient permissions) */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied', metadata?: Record<string, unknown>) {
    super(message, 'AUTHORIZATION_ERROR', 403, metadata)
    this.name = 'AuthorizationError'
  }
}

/** Resource not found */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', metadata?: Record<string, unknown>) {
    super(message, 'NOT_FOUND', 404, metadata)
    this.name = 'NotFoundError'
  }
}

/** Conflict with existing resource */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists', metadata?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, metadata)
    this.name = 'ConflictError'
  }
}

/** Rate limit exceeded */
export class RateLimitError extends AppError {
  constructor(
    message: string = 'Too many requests',
    public readonly retryAfterSeconds: number,
    metadata?: Record<string, unknown>
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { ...metadata, retryAfterSeconds })
    this.name = 'RateLimitError'
  }
}

/** External service error (payment gateway, email, etc.) */
export class ExternalServiceError extends AppError {
  constructor(
    message: string,
    public readonly service: string,
    public readonly originalError?: Error,
    metadata?: Record<string, unknown>
  ) {
    super(message, 'EXTERNAL_SERVICE_ERROR', 502, { ...metadata, service, originalError: originalError?.message })
    this.name = 'ExternalServiceError'
  }
}

/** Database operation failed */
export class DatabaseError extends AppError {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly originalError?: Error,
    metadata?: Record<string, unknown>
  ) {
    super(message, 'DATABASE_ERROR', 500, { ...metadata, operation, originalError: originalError?.message })
    this.name = 'DatabaseError'
  }
}

/** Payment-specific errors */
export class PaymentError extends AppError {
  constructor(
    message: string,
    public readonly paymentReference?: string,
    public readonly paymentStatus?: string,
    metadata?: Record<string, unknown>
  ) {
    super(message, 'PAYMENT_ERROR', 400, { ...metadata, paymentReference, paymentStatus })
    this.name = 'PaymentError'
  }
}

/** Payment not in a valid state for the requested operation */
export class InvalidPaymentStateError extends PaymentError {
  constructor(
    message: string,
    paymentReference: string,
    currentStatus: string,
    allowedStatuses: string[],
    metadata?: Record<string, unknown>
  ) {
    super(message, paymentReference, currentStatus, { ...metadata, allowedStatuses })
    this.name = 'InvalidPaymentStateError'
  }
}

/** Webhook-specific errors */
export class WebhookError extends AppError {
  constructor(
    message: string,
    public readonly code: 'INVALID_SIGNATURE' | 'INVALID_TIMESTAMP' | 'REPLAY_DETECTED' | 'INVALID_PAYLOAD' | 'UNKNOWN_PROVIDER' | 'PROCESSING_FAILED',
    public readonly statusCode: number = 400,
    metadata?: Record<string, unknown>
  ) {
    super(message, `WEBHOOK_${code}`, statusCode, metadata)
    this.name = 'WebhookError'
  }
}

/** Gateway-specific errors */
export class GatewayError extends AppError {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly gatewayCode?: string,
    metadata?: Record<string, unknown>
  ) {
    super(message, 'GATEWAY_ERROR', 502, { ...metadata, provider, gatewayCode })
    this.name = 'GatewayError'
  }
}

/** Type guard for AppError */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

/** Type guard for specific error types */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError
}

export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError
}

export function isWebhookError(error: unknown): error is WebhookError {
  return error instanceof WebhookError
}

export function isGatewayError(error: unknown): error is GatewayError {
  return error instanceof GatewayError
}

/** Extracts a user-friendly message from any error */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'An unexpected error occurred'
}

/** Extracts the error code from any error */
export function getErrorCode(error: unknown): string {
  if (error instanceof AppError) {
    return error.code
  }
  return 'UNKNOWN_ERROR'
}

/** Extracts the HTTP status code from any error */
export function getErrorStatusCode(error: unknown): number {
  if (error instanceof AppError) {
    return error.statusCode
  }
  return 500
}

/** Formats an error for API response */
export function formatErrorResponse(error: unknown): {
  error: string
  code: string
  statusCode: number
  metadata?: Record<string, unknown>
} {
  if (error instanceof AppError) {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      metadata: error.metadata,
    }
  }
  if (error instanceof Error) {
    return {
      error: error.message,
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    }
  }
  return {
    error: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
  }
}

/** Wraps an async function to catch and format errors */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      // Wrap unexpected errors
      console.error('Unexpected error:', error)
      throw new AppError(
        'An unexpected error occurred',
        'INTERNAL_ERROR',
        500,
        { originalError: error instanceof Error ? error.message : String(error) }
      )
    }
  }) as T
}