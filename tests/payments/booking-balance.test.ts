import { describe, expect, it } from 'vitest'
import { remainingBookingBalance } from '@/lib/payment'

describe('remaining booking balance', () => {
  it('adds verified refunds back to the outstanding balance', () => {
    expect(remainingBookingBalance(500, 500, 200)).toBe(200)
    expect(remainingBookingBalance(500, 200, 50)).toBe(350)
  })

  it('never renders a negative balance and keeps cent precision', () => {
    expect(remainingBookingBalance(100, 120, 0)).toBe(0)
    expect(remainingBookingBalance(100.1, 20.03, 0.02)).toBe(80.09)
  })
})
