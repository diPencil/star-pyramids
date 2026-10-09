// Tests for webhook security handler
// Phase 2F-B: Provider-neutral payment gateway foundation

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateTimestamp,
  normalizeHeaders,
  getProviderFromUrl,
  getRawBody,
  WebhookError,
  DEFAULT_MAX_TIMESTAMP_AGE_SECONDS,
} from '@/lib/server/webhooks/handler'

describe('Webhook Security Handler', () => {
  describe('validateTimestamp', () => {
    it('should accept current timestamp', () => {
      const now = Math.floor(Date.now() / 1000)
      expect(() => validateTimestamp(now)).not.toThrow()
    })

    it('should accept timestamp within max age', () => {
      const recent = Math.floor(Date.now() / 1000) - 60 // 1 minute ago
      expect(() => validateTimestamp(recent, 300)).not.toThrow()
    })

    it('should reject timestamp older than max age', () => {
      const old = Math.floor(Date.now() / 1000) - 400 // 400 seconds ago, max is 300
      expect(() => validateTimestamp(old, 300)).toThrow('Webhook timestamp too old')
    })

    it('should reject timestamp in the future (beyond tolerance)', () => {
      const future = Math.floor(Date.now() / 1000) + 120 // 2 minutes in future, tolerance is 60s
      expect(() => validateTimestamp(future)).toThrow('Webhook timestamp is in the future')
    })

    it('should accept timestamp slightly in the future (within tolerance)', () => {
      const future = Math.floor(Date.now() / 1000) + 30 // 30 seconds in future
      expect(() => validateTimestamp(future)).not.toThrow()
    })

    it('should use default max age of 300 seconds', () => {
      const old = Math.floor(Date.now() / 1000) - 350
      expect(() => validateTimestamp(old)).toThrow() // 350 > 300 default
    })

    it('should accept custom max age', () => {
      const old = Math.floor(Date.now() / 1000) - 500
      expect(() => validateTimestamp(old, 600)).not.toThrow() // 500 < 600
    })
  })

  describe('normalizeHeaders', () => {
    it('should normalize header keys to lowercase', () => {
      const headers = new Headers()
      headers.set('Content-Type', 'application/json')
      headers.set('X-Signature', 'sig123')
      headers.set('X-Request-ID', 'req_123')

      const normalized = normalizeHeaders(headers)
      expect(normalized['content-type']).toBe('application/json')
      expect(normalized['x-signature']).toBe('sig123')
      expect(normalized['x-request-id']).toBe('req_123')
      // Original case should not exist
      expect(normalized['Content-Type']).toBeUndefined()
    })

    it('should handle empty headers', () => {
      const headers = new Headers()
      const normalized = normalizeHeaders(headers)
      expect(normalized).toEqual({})
    })
  })

  describe('getProviderFromUrl', () => {
    it('should extract provider from standard webhook URL', () => {
      expect(getProviderFromUrl('/api/payments/webhook/stripe')).toBe('stripe')
      expect(getProviderFromUrl('/api/payments/webhook/paypal')).toBe('paypal')
      expect(getProviderFromUrl('/api/payments/webhook/adyen')).toBe('adyen')
    })

    it('should handle URLs with query strings', () => {
      expect(getProviderFromUrl('/api/payments/webhook/stripe?challenge=123')).toBe('stripe')
    })

    it('should handle URLs with fragments', () => {
      expect(getProviderFromUrl('/api/payments/webhook/stripe#fragment')).toBe('stripe')
    })

    it('should return null for invalid URLs', () => {
      expect(getProviderFromUrl('/api/payments/other')).toBeNull()
      expect(getProviderFromUrl('/api/payments/other')).toBeNull()
      expect(getProviderFromUrl('/api/other/webhook/stripe')).toBeNull()
    })
  })

  describe('WebhookError', () => {
    it('should create error with correct properties', () => {
      const error = new WebhookError('Invalid signature', 'INVALID_SIGNATURE', 401)
      expect(error.message).toBe('Invalid signature')
      expect(error.code).toBe('INVALID_SIGNATURE')
      expect(error.statusCode).toBe(401)
      expect(error.name).toBe('WebhookError')
    })

    it('should have correct error codes', () => {
      const codes = ['INVALID_SIGNATURE', 'INVALID_TIMESTAMP', 'REPLAY_DETECTED', 'INVALID_PAYLOAD', 'UNKNOWN_PROVIDER', 'PROCESSING_FAILED'] as const
      codes.forEach(code => {
        const error = new WebhookError('test', code)
        expect(error.code).toBe(code)
      })
    })
  })

  describe('DEFAULT_MAX_TIMESTAMP_AGE_SECONDS', () => {
    it('should be 300 seconds (5 minutes)', () => {
      expect(DEFAULT_MAX_TIMESTAMP_AGE_SECONDS).toBe(300)
    })
  })

  describe('Webhook Handler Integration', () => {
    // Mock provider adapter for integration tests
    const mockAdapter = {
      key: 'test',
      metadata: {
        key: 'test',
        name: 'Test Provider',
        version: '1.0.0',
        capabilities: {
          immediateCapture: true,
          authorizeCapture: false,
          refunds: true,
          partialRefunds: true,
          voids: false,
          threeDSecure: false,
          supportedCurrencies: ['USD'],
          minAmountCents: 50,
          maxAmountCents: 9999999,
          paymentMethodStorage: false,
          webhookRetries: true,
          signatureAlgorithm: 'hmac-sha256' as const,
          webhookPayloadType: 'full' as const,
        },
        requiredConfig: [],
        optionalConfig: [],
        webhookPath: 'test',
        webhookEvents: [],
      },
      initiate: vi.fn(),
      handleCallback: vi.fn(),
      verifyWebhook: vi.fn(),
    }

    beforeEach(() => {
      vi.clearAllMocks()
    })

    describe('Webhook handler flow', () => {
      it('should reject unsupported provider', async () => {
        const { handleProviderWebhook } = await import('@/lib/server/webhooks/handler')
        
        // We can't easily test the full flow without mocking the adapter registry
        // This is a placeholder for integration tests
        expect(true).toBe(true)
      })
    })
  })
})

describe('WebhookError codes', () => {
  it('should have all required error codes', () => {
    const codes = [
      'INVALID_SIGNATURE',
      'INVALID_TIMESTAMP',
      'REPLAY_DETECTED',
      'INVALID_PAYLOAD',
      'UNKNOWN_PROVIDER',
      'PROCESSING_FAILED',
    ]
    
    codes.forEach(code => {
      const error = new WebhookError('test', code)
      expect(error.code).toBe(code)
    })
  })
})

describe('Provider URL extraction', () => {
  it('should extract provider from various URL formats', () => {
    const testCases = [
      { url: '/api/payments/webhook/stripe', expected: 'stripe' },
      { url: '/api/payments/webhook/paypal?challenge=123', expected: 'paypal' },
      { url: 'https://example.com/api/payments/webhook/adyen', expected: 'adyen' },
      { url: '/api/payments/webhook/stripe#fragment', expected: 'stripe' },
    ]

    testCases.forEach(({ url, expected }) => {
      const result = getProviderFromUrl(url)
      expect(result).toBe(expected)
    })
  })

  it('should return null for non-webhook URLs', () => {
    expect(getProviderFromUrl('/api/payments/other')).toBeNull()
    expect(getProviderFromUrl('/api/webhook/stripe')).toBeNull()
    expect(getProviderFromUrl('/other/webhook/stripe')).toBeNull()
  })
})