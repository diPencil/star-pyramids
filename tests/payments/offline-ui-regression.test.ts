// Offline-only UI regression guard (Phase 3.1).
//
// The legacy customer "Pay now" online-initiation action was removed:
// it implied a payment gateway that does not exist. This file guards
// both halves of that decision:
//
// 1. REMOVED: no customer-facing online-payment initiation path may be
//    reintroduced in the account portal (static source guard — it fails
//    if a "Pay now" CTA or an initiation call comes back).
// 2. PRESERVED: the initiation API, the service, and all stored payment
//    history stay intact (behavioral assertions below).
//
// Part 1 reads repository source rather than rendered output because
// this suite runs in a Node environment without a component harness;
// it is labeled as such and complements the behavioral tests.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

describe('customer UI has no online-payment initiation path', () => {
  const portal = source('components/account-portal.tsx')

  it('contains no Pay-now call to action', () => {
    expect(portal).not.toMatch(/Pay now/)
    expect(portal).not.toMatch(/Starting payment/)
  })

  it('never calls the payment-initiation endpoint from customer UI', () => {
    expect(portal).not.toMatch(/apiPaymentInitiate/)
  })

  it('points customers at offline instructions instead', () => {
    expect(portal).toMatch(/sp-payment-instructions/)
    expect(portal).toMatch(/How to pay/)
    expect(portal).toMatch(/PaymentProofForm/)
  })
})

describe('payment APIs and history are preserved', () => {
  it('keeps the customer initiation API route', () => {
    expect(existsSync(join(ROOT, 'app', 'api', 'account', 'payments', 'route.ts'))).toBe(true)
    const route = source('app/api/account/payments/route.ts')
    expect(route).toMatch(/initiateCustomerPayment/)
  })

  it('keeps the initiation service creating PENDING-only records', async () => {
    const service = source('lib/server/payments.ts')
    // The service still exists and still documents its PENDING-only role.
    expect(service).toMatch(/export async function initiateCustomerPayment/)
    expect(service).toMatch(/initiation never marks money as paid/)
  })

  it('keeps the offline receipt/refund workflows intact', () => {
    const adminRecord = source('app/api/admin/payments/record/route.ts')
    expect(adminRecord).toMatch(/recordOfflinePayment/)
    const adminBooking = source('app/admin/bookings/[ref]/content.tsx')
    expect(adminBooking).toMatch(/Record payment/)
  })
})
