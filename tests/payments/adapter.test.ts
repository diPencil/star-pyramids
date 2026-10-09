// Tests for payment provider adapter contracts
// Phase 2F-B: Provider-neutral payment gateway foundation

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateAdapter, createProviderMetadata, DEFAULT_CAPABILITIES } from '@/lib/payments/adapter'
import type { ExtendedPaymentProviderAdapter, ProviderMetadata } from '@/lib/payments/adapter'
import type { PaymentHandoff, ProviderCallbackOutcome } from '@/lib/payment'

// Mock adapter for testing
function createMockAdapter(overrides: Partial<ExtendedPaymentProviderAdapter> = {}): ExtendedPaymentProviderAdapter {
  return {
    key: 'test',
    metadata: createProviderMetadata('test', 'Test Provider'),
    initiate: vi.fn().mockResolvedValue({
      provider: 'test',
      providerPaymentId: 'test_pay_123',
      redirectUrl: 'https://test.example.com/checkout/123',
      metadata: {},
    }),
    handleCallback: vi.fn().mockResolvedValue({
      type: 'paid',
      providerPaymentId: 'test_pay_123',
      amountPaidCents: 10000,
    }),
    verifyWebhook: vi.fn().mockResolvedValue({
      eventId: 'evt_123',
      eventType: 'payment_intent.succeeded',
      timestamp: Math.floor(Date.now() / 1000),
      payload: {},
    }),
    ...overrides,
  }
}

describe('Payment Provider Adapter Contracts', () => {
  describe('validateAdapter', () => {
    it('should pass for a valid adapter', () => {
      const adapter = createMockAdapter()
      expect(() => validateAdapter(adapter)).not.toThrow()
    })

    it('should throw for missing key', () => {
      const adapter = createMockAdapter({ key: '' })
      expect(() => validateAdapter(adapter)).toThrow('Adapter must have a string key')
    })

    it('should throw for missing metadata', () => {
      const adapter = createMockAdapter({ metadata: null as any })
      expect(() => validateAdapter(adapter)).toThrow('Adapter must have metadata')
    })

    it('should throw for mismatched key in metadata', () => {
      const adapter = createMockAdapter({
        key: 'test1',
        metadata: { ...createProviderMetadata('test2', 'Test') },
      })
      expect(() => validateAdapter(adapter)).toThrow('Adapter metadata.key must match adapter.key')
    })

    it('should throw for missing initiate', () => {
      const adapter = createMockAdapter({ initiate: undefined as any })
      expect(() => validateAdapter(adapter)).toThrow('Adapter must implement initiate()')
    })

    it('should throw for missing handleCallback', () => {
      const adapter = createMockAdapter({ handleCallback: undefined as any })
      expect(() => validateAdapter(adapter)).toThrow('Adapter must implement handleCallback()')
    })

    it('should throw for missing verifyWebhook', () => {
      const adapter = createMockAdapter({ verifyWebhook: undefined as any })
      expect(() => validateAdapter(adapter)).toThrow('Adapter must implement verifyWebhook()')
    })

    it('should throw for missing capabilities', () => {
      const adapter = createMockAdapter({
        metadata: { ...createProviderMetadata('test', 'Test'), capabilities: undefined as any },
      })
      expect(() => validateAdapter(adapter)).toThrow('Adapter metadata must include capabilities')
    })
  })

  describe('createProviderMetadata', () => {
    it('should create metadata with defaults', () => {
      const metadata = createProviderMetadata('stripe', 'Stripe')
      expect(metadata.key).toBe('stripe')
      expect(metadata.name).toBe('Stripe')
      expect(metadata.version).toBe('1.0.0')
      expect(metadata.capabilities).toEqual(DEFAULT_CAPABILITIES)
      expect(metadata.requiredConfig).toEqual([])
      expect(metadata.optionalConfig).toEqual([])
      expect(metadata.webhookPath).toBe('stripe')
      expect(metadata.webhookEvents).toEqual([])
    })

    it('should allow overriding defaults', () => {
      const metadata = createProviderMetadata('paypal', 'PayPal', {
        capabilities: { ...DEFAULT_CAPABILITIES, refunds: false },
        requiredConfig: ['client_id', 'client_secret'],
      })
      expect(metadata.capabilities.refunds).toBe(false)
      expect(metadata.requiredConfig).toEqual(['client_id', 'client_secret'])
    })
  })

  describe('DEFAULT_CAPABILITIES', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_CAPABILITIES.immediateCapture).toBe(true)
      expect(DEFAULT_CAPABILITIES.authorizeCapture).toBe(false)
      expect(DEFAULT_CAPABILITIES.refunds).toBe(true)
      expect(DEFAULT_CAPABILITIES.partialRefunds).toBe(true)
      expect(DEFAULT_CAPABILITIES.voids).toBe(false)
      expect(DEFAULT_CAPABILITIES.threeDSecure).toBe(false)
      expect(DEFAULT_CAPABILITIES.supportedCurrencies).toEqual(['USD'])
      expect(DEFAULT_CAPABILITIES.minAmountCents).toBe(50)
      expect(DEFAULT_CAPABILITIES.maxAmountCents).toBe(9999999)
      expect(DEFAULT_CAPABILITIES.paymentMethodStorage).toBe(false)
      expect(DEFAULT_CAPABILITIES.webhookRetries).toBe(true)
      expect(DEFAULT_CAPABILITIES.signatureAlgorithm).toBe('hmac-sha256')
      expect(DEFAULT_CAPABILITIES.webhookPayloadType).toBe('full')
    })
  })
})

describe('PaymentHandoff and ProviderCallbackOutcome types', () => {
  it('should accept valid PaymentHandoff', () => {
    const handoff: PaymentHandoff = {
      provider: 'stripe',
      providerPaymentId: 'pi_123',
      redirectUrl: 'https://checkout.stripe.com/pay/123',
      metadata: { session_id: 'cs_123' },
    }
    expect(handoff.provider).toBe('stripe')
    expect(handoff.providerPaymentId).toBe('pi_123')
    expect(handoff.redirectUrl).toContain('stripe.com')
  })

  it('should accept paid outcome', () => {
    const outcome: ProviderCallbackOutcome = {
      type: 'paid',
      providerPaymentId: 'pi_123',
      amountPaidCents: 10000,
    }
    expect(outcome.type).toBe('paid')
    expect(outcome.amountPaidCents).toBe(10000)
  })

  it('should accept failed outcome with failure details', () => {
    const outcome: ProviderCallbackOutcome = {
      type: 'failed',
      providerPaymentId: 'pi_123',
      failureCode: 'card_declined',
      failureMessage: 'Your card was declined',
    }
    expect(outcome.type).toBe('failed')
    expect(outcome.failureCode).toBe('card_declined')
  })

  it('should accept refunded outcome', () => {
    const outcome: ProviderCallbackOutcome = {
      type: 'refunded',
      providerPaymentId: 'pi_123',
      amountRefundedCents: 5000,
    }
    expect(outcome.type).toBe('refunded')
    expect(outcome.amountRefundedCents).toBe(5000)
  })

  it('should accept ignored outcome', () => {
    const outcome: ProviderCallbackOutcome = {
      type: 'ignored',
      reason: 'duplicate_event',
    }
    expect(outcome.type).toBe('ignored')
    expect(outcome.reason).toBe('duplicate_event')
  })
})

describe('ProviderCapabilities defaults', () => {
  it('should have conservative defaults', () => {
    expect(DEFAULT_CAPABILITIES.immediateCapture).toBe(true)
    expect(DEFAULT_CAPABILITIES.authorizeCapture).toBe(false)
    expect(DEFAULT_CAPABILITIES.refunds).toBe(true)
    expect(DEFAULT_CAPABILITIES.partialRefunds).toBe(true)
    expect(DEFAULT_CAPABILITIES.voids).toBe(false)
    expect(DEFAULT_CAPABILITIES.threeDSecure).toBe(false)
    expect(DEFAULT_CAPABILITIES.supportedCurrencies).toEqual(['USD'])
    expect(DEFAULT_CAPABILITIES.minAmountCents).toBe(50)
    expect(DEFAULT_CAPABILITIES.maxAmountCents).toBe(9999999)
    expect(DEFAULT_CAPABILITIES.paymentMethodStorage).toBe(false)
    expect(DEFAULT_CAPABILITIES.webhookRetries).toBe(true)
    expect(DEFAULT_CAPABILITIES.signatureAlgorithm).toBe('hmac-sha256')
    expect(DEFAULT_CAPABILITIES.webhookPayloadType).toBe('full')
  })
})

type ExtendedPaymentAdapter = {
  key: string
  metadata: import('@/lib/payments/adapter').ProviderMetadata
  initiate: (payment: {
    reference: string
    amountCents: number
    currency: string
    idempotencyKey: string | null
    customerEmail?: string
    customerName?: string
    returnUrl: string
    cancelUrl: string
    metadata?: Record<string, string>
  }) => Promise<import('@/lib/payment').PaymentHandoff>
  handleCallback: (rawBody: string, headers: Headers) => Promise<import('@/lib/payment').ProviderCallbackOutcome>
  verifyWebhook: (rawBody: string, headers: Headers) => Promise<{
    eventId: string
    eventType: string
    timestamp: number
    payload: unknown
  }>
  createRefund?: (params: { providerPaymentId: string; amountCents: number; reason?: string; idempotencyKey: string }) => Promise<{ refundId: string; status: string }>
  voidPayment?: (params: { providerPaymentId: string; idempotencyKey: string }) => Promise<{ status: string }>
  capturePayment?: (params: { providerPaymentId: string; amountCents: number; idempotencyKey: string }) => Promise<{ status: string }>
  getPaymentStatus?: (providerPaymentId: string) => Promise<{
    status: string
    amountCents: number
    capturedCents: number
    refundedCents: number
  }>
}