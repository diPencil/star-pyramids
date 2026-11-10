import { expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { collectedCrmMoney, crmAccountLabel, customerBookingAmounts, formatCrmMoney, groupCrmMoney } from '@/lib/admin/admin-crm-reporting'
import { BookingToursSummary } from '@/components/admin/booking-tours-summary'

it('keeps currencies separate, counts booking values once and retains USD-only legacy scalars', () => {
  const summary = customerBookingAmounts([
    { total: '620.00', currency: 'USD', status: 'PENDING' },
    { total: '70.25', currency: 'EUR', status: 'CONFIRMED' },
    { total: '0.10', currency: 'EUR', status: 'CONFIRMED' },
  ])
  expect(summary.bookedValue).toEqual([{currency:'EUR',amount:70.35},{currency:'USD',amount:620}])
  expect(summary.confirmedValue).toEqual([{currency:'EUR',amount:70.35}])
  expect(summary.totalSpent).toBe(620); expect(summary.confirmedSpent).toBe(0)
})
it('adds cents exactly and rejects corrupt persisted amounts without presenting a fake zero', () => {
  expect(groupCrmMoney([{currency:'USD',amount:0.1},{currency:'USD',amount:0.2}])).toEqual([{currency:'USD',amount:0.3}])
  expect(()=>groupCrmMoney([{currency:'USD',amount:'invalid'}])).toThrow()
})
it('collection is qualifying paid money net of refunds, never pending requested amounts', () => {
  const payments = [
    {currency:'USD',status:'PAID',amountPaid:'100.00',amountRefunded:'0'},
    {currency:'USD',status:'PARTIALLY_REFUNDED',amountPaid:'50.00',amountRefunded:'20.00'},
    {currency:'USD',status:'REFUNDED',amountPaid:'30.00',amountRefunded:'30.00'},
    {currency:'EUR',status:'PAID',amountPaid:'15.00',amountRefunded:'0'},
    {currency:'USD',status:'PENDING',amountPaid:'900',amountRefunded:'0'},
  ]
  expect(collectedCrmMoney(payments)).toEqual([{currency:'EUR',amount:15},{currency:'USD',amount:130}])
})
it('distinguishes missing reporting data, restricted payments, and no recorded money', () => {
  expect(formatCrmMoney(null)).toBe('Restricted')
  expect(formatCrmMoney(undefined)).toBe('Not available')
  expect(formatCrmMoney([])).toBe('No recorded value')
  expect(formatCrmMoney([{currency:'EUR',amount:70}])).toContain('EUR')
})
it('uses persisted verification facts to distinguish registered from pending accounts', () => {
  expect(crmAccountLabel({status:'PENDING',emailVerifiedAt:null})).toBe('Pending verification')
  expect(crmAccountLabel({status:'ACTIVE',emailVerifiedAt:null})).toBe('Pending verification')
  expect(crmAccountLabel({status:'ACTIVE',emailVerifiedAt:'2026-11-03'})).toBe('Registered')
})
it('summarizes multiple tours with a keyboard-native disclosure and all detail links', () => {
  const html=renderToStaticMarkup(createElement(BookingToursSummary,{titles:['Alexandria','Ancient Wonders'],reference:'SP-BK-TEST01'}))
  expect(html).toContain('+1 more');expect(html).toContain('<details>')
  expect(html).toContain('aria-label="Show all 2 booked tours"');expect(html).toContain('Ancient Wonders')
  expect(html).toContain('/admin/bookings/SP-BK-TEST01')
  expect(renderToStaticMarkup(createElement(BookingToursSummary,{titles:['Only tour'],reference:'x'}))).not.toContain('<details>')
})
