import type { MoneyByCurrency } from '../analytics/analytics'
import { formatCurrency } from '../payments/currency'

type StoredAmount = { toString(): string } | string | number
type BookingAmount = { status: string; currency: string; total: StoredAmount }
type PaymentAmount = { status: string; currency: string; amountPaid: StoredAmount; amountRefunded: StoredAmount }

/** Report in stored currencies; integer cents, no exchange rates or item joins. */
export function groupCrmMoney(rows: readonly { currency: string; amount: StoredAmount }[]): MoneyByCurrency[] {
  const cents = new Map<string, number>()
  for (const row of rows) {
    const value = Math.round(Number(String(row.amount)) * 100)
    if (!Number.isSafeInteger(value)) throw new Error('Invalid stored reporting amount.')
    cents.set(row.currency, (cents.get(row.currency) ?? 0) + value)
    if (!Number.isSafeInteger(cents.get(row.currency))) throw new Error('Reporting amount exceeds safe bounds.')
  }
  return [...cents].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({ currency, amount: amount / 100 }))
}

export function customerBookingAmounts(bookings: readonly BookingAmount[]) {
  const bookedValue = groupCrmMoney(bookings.map(b => ({ currency: b.currency, amount: b.total })))
  const confirmedValue = groupCrmMoney(bookings.filter(b => b.status === 'CONFIRMED').map(b => ({ currency: b.currency, amount: b.total })))
  return {
    bookedValue, confirmedValue,
    // Compatibility for older callers: these legacy scalar fields are USD only.
    totalSpent: bookedValue.find(v => v.currency === 'USD')?.amount ?? 0,
    confirmedSpent: confirmedValue.find(v => v.currency === 'USD')?.amount ?? 0,
  }
}

/** Same qualifying status/net-refund rule as dashboard analytics. */
export function collectedCrmMoney(payments: readonly PaymentAmount[]): MoneyByCurrency[] {
  return groupCrmMoney(payments.filter(p => ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(p.status)).map(p => ({
    currency: p.currency,
    amount: (Math.round(Number(String(p.amountPaid)) * 100) - Math.round(Number(String(p.amountRefunded)) * 100)) / 100,
  })))
}

export function formatCrmMoney(values: readonly MoneyByCurrency[] | null | undefined): string {
  if (values === null) return 'Restricted'
  if (values === undefined) return 'Not available'
  return values.map(v => `${v.currency} ${formatCurrency(v.amount, v.currency, 'en')}`).join(' · ') || 'No recorded value'
}

export function crmAccountLabel(account: { status: string; emailVerifiedAt: string | Date | null }): string {
  return account.status === 'PENDING' || !account.emailVerifiedAt ? 'Pending verification' : 'Registered'
}
