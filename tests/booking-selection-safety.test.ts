import { beforeEach, expect, it, vi } from 'vitest'
import type { Tour } from '@/data/types'
import { bookingAddonCatalog, bookingAddons, bookingCents, validBookingTravelers } from '@/lib/booking-selection'
import { estimateCart } from '@/lib/booking'
import { sanitizeCartItem } from '@/lib/cart'

const mocks = vi.hoisted(() => ({ find: vi.fn(), findBooking: vi.fn(), create: vi.fn(), notify: vi.fn(), mail: vi.fn(), token: vi.fn() }))
vi.mock('@/lib/server/db', () => ({ db: { booking: {findUnique: mocks.findBooking, create: mocks.create} } }))
vi.mock('@/lib/server/tours', () => ({ findTourBySlug: mocks.find }))
vi.mock('@/lib/server/notifications', () => ({notifyUser: mocks.notify, notifyStaff: mocks.notify}))
vi.mock('@/lib/server/email', () => ({sendCustomerEmailSafe: mocks.mail, sendStaffEmailSafe: mocks.mail}))
vi.mock('@/lib/server/booking-access', () => ({issueGuestBookingToken: mocks.token, revokeGuestBookingTokens: vi.fn(), guestBookingPath: (token: string) => `/booking/${token}`}))
import { createBookingRecord, validateBookingDraft } from '@/lib/server/bookings'

const tour = (): Tour => ({slug: 'current-tour', status: 'published', category: 'one-day-tours', title: 'Current tour', price: 100, image: '', summary: '', duration: 'Full day', location: 'Cairo', dayDetail: { overview: [], travelerPrices: [{travelers: 2, adultPrice: 100, childPrice: 50, infantPrice: 0}], addOns: [{title: 'Ticket', price: 12.34}, {title: 'Transfer on request'}] }})
const draft = (selection: Record<string, unknown> = {}) => ({lines: [{tourSlug: 'old-alias', date: '', adults: 2, children: 0, infants: 0, addons: [], ...selection}], contact: {name: 'Test Customer', email: 'test@example.com', phone: '+201234567890'}, notes: 'A customer note', currency: 'USD', idempotencyKey: 'safety-attempt-key'})
it.each(['one-day-tours','multi-days-tours','nile-cruises','shore-excursions'] as const)('uses only the %s widget add-on owner',category=>{
  const current=tour();current.category=category
  current.detail={addOns:[{title:'Package extra',price:99}]} as Tour['detail']
  expect(bookingAddonCatalog(current,[])[0].title).toBe(category==='one-day-tours'?'Ticket':'Package extra')
})
it('preserves an intentionally empty day add-on list',()=>{
  const current=tour();current.dayDetail!.addOns=[]
  current.detail={addOns:[{title:'Hidden legacy extra',price:99}]} as Tour['detail']
  expect(bookingAddonCatalog(current,[{title:'Default extra',price:10}])).toEqual([])
})
beforeEach(() => { vi.resetAllMocks(); mocks.find.mockResolvedValue(tour()); mocks.findBooking.mockResolvedValue(null); mocks.token.mockResolvedValue(null); mocks.notify.mockResolvedValue(undefined); mocks.mail.mockResolvedValue(null) })

it.each([[50,10,0,true], [50,10,1,false], [0,1,0,false], [1,50,9,true], [51,0,0,false], [2,0.5,0,false]])('enforces the same traveler bounds (%s, %s, %s)', (a,c,i,valid) => { expect(validBookingTravelers(a as number,c as number,i as number)).toBe(valid) })
it.each([NaN, Infinity, -1, 100_000_000])('fails closed on invalid/oversized money %s', price => { expect(() => bookingCents(price)).toThrow(/cannot be confirmed/) })
it('deduplicates extras and separates removed, priced and genuinely unpriced selections', () => {
  expect(bookingAddons(tour().dayDetail!.addOns!, ['Ticket','Ticket','Transfer on request','Removed'])).toEqual({priced:['Ticket'], requested:['Transfer on request'], unavailable:['Removed'], cents:1234})
})
it('charges the extras displayed by the day-tour widget when legacy detail JSON is also present',async()=>{
  const current=tour();current.detail={addOns:[{title:'Ticket',price:999}]} as Tour['detail'];mocks.find.mockResolvedValue(current)
  const validated=await validateBookingDraft(draft({addons:['Ticket']}))
  const selected=sanitizeCartItem({...draft({addons:['Ticket']}).lines[0],tourSlug:current.slug,title:current.title})!
  expect(validated.lines[0].addonTotalCents).toBe(1234)
  expect(estimateCart([selected],[current]).validLines[0].addonTotal).toBe(12.34)
})
it('rejects ambiguous catalogue extras instead of choosing the first price', () => {
  expect(() => bookingAddons([{title:'Transfer',price:15},{title:'Transfer',price:30}],['Transfer'])).toThrow(/cannot be confirmed/)
})
it('rejects duplicate configurations after alias resolution on the server', async () => {
  const input=draft();input.lines.push({...input.lines[0],tourSlug:'current-tour'})
  await expect(validateBookingDraft(input)).rejects.toThrow(/duplicate trip selections/)
  expect(mocks.create).not.toHaveBeenCalled()
})
it('flags canonical/alias duplicates for explicit removal while preserving both saved selections', () => {
  const current=tour();current.aliases=['old-alias']
  const first=sanitizeCartItem({...draft().lines[0],title:current.title})!
  const second=sanitizeCartItem({...first,tourSlug:current.slug})!
  const result=estimateCart([first,second],[current])
  expect(result.blocked).toBe(true);expect(result.validLines).toHaveLength(2)
  expect(result.validLines.map(line=>line.duplicateSelection)).toEqual([false,true])
  expect(first.tourSlug).toBe('old-alias');expect(second.tourSlug).toBe('current-tour')
})
it('preserves requests in notes, excludes them from purchased extras, and uses canonical slugs and live cents', async () => {
  const result = await validateBookingDraft(draft({addons:['Transfer on request','Ticket','Ticket']}))
  expect(result.totalCents).toBe(21234)
  expect(result.lines[0]).toMatchObject({tourSlug:'current-tour', addons:['Ticket'], requestedAddons:['Transfer on request'], addonTotalCents:1234})
  expect(result.notes).toContain('A customer note\nRequested extras')
  expect(result.notes).toContain('NOT confirmed; excluded from the total')
  expect(result.notes).toContain('Transfer on request')
  expect(mocks.create).not.toHaveBeenCalled()
})
it.each([{children:1.5},{children:null},{infants:'2'},{adults:50,children:11},{date:123},{date:'2026-02-30'},{addons:['Removed']},{addons:['x'.repeat(121)]}])('rejects malformed or incompatible selections %j', async selection => {
  await expect(validateBookingDraft(draft(selection))).rejects.toThrow()
  expect(mocks.create).not.toHaveBeenCalled()
})
it('never truncates notes plus requested extras', async () => {
  await expect(validateBookingDraft({...draft({addons:['Transfer on request']}), notes:'x'.repeat(990)})).rejects.toThrow(/too long/)
})
it('blocks over-limit and removed-addon carts before checkout without calling them unpublished', () => {
  const item = sanitizeCartItem({ ...draft({adults:50,children:11,addons:['Removed']}).lines[0], tourSlug:'current-tour', title:'Current tour' })!
  const result = estimateCart([item], [tour()])
  expect(result.blocked).toBe(true); expect(result.staleLines).toHaveLength(0)
  expect(result.validLines[0]).toMatchObject({invalidTravelers:true, unavailableAddons:['Removed'], onRequestAddons:[]})
})
it('matches backend unit-cent rounding including original-price savings', async () => {
  const current = tour(); current.dayDetail!.travelerPrices = [{travelers:2,adultPrice:1.005,childPrice:0,infantPrice:0}]
  mocks.find.mockResolvedValue(current)
  const validated = await validateBookingDraft(draft())
  const item = sanitizeCartItem({...draft().lines[0],tourSlug:current.slug,title:current.title})!
  const estimate = estimateCart([item],[current])
  expect(Math.round(estimate.subtotal*100)).toBe(validated.totalCents)
  expect(Math.round(estimate.discount*100)).toBe(validated.discountCents)
})
it('keeps a committed booking successful when notifications and token creation fail', async () => {
  const validated = await validateBookingDraft(draft())
  mocks.token.mockRejectedValue(Error('token service offline')); mocks.notify.mockRejectedValue(Error('notification service offline'))
  mocks.create.mockImplementation(async ({data}) => ({...data, id:'b1', createdAt:new Date(), updatedAt:new Date(), items:data.items.create, activities:[], payments:[], user:null}))
  const result = await createBookingRecord(null,validated)
  expect(result.created).toBe(true); expect(result.guestAccessUrl).toBeNull()
  expect(mocks.create).toHaveBeenCalledTimes(1)
  expect(mocks.mail.mock.calls.some(call => call[0] === 'booking_created')).toBe(false)
})
it('does not send a guest to an account-only link when token issuance returns no token', async () => {
  const validated = await validateBookingDraft(draft())
  mocks.create.mockImplementation(async ({data}) => ({...data, id:'b1', createdAt:new Date(), updatedAt:new Date(), items:data.items.create, activities:[], payments:[], user:null}))
  expect((await createBookingRecord(null,validated)).guestAccessUrl).toBeNull()
  expect(mocks.mail.mock.calls.some(call => call[0] === 'booking_created')).toBe(false)
})
it('rejects a changed account request under the same submission key instead of returning an unrelated old booking', async () => {
  const validated = await validateBookingDraft(draft())
  mocks.findBooking.mockResolvedValue({userId:'customer-id',items:[],contactName:'A different customer request'})
  await expect(createBookingRecord('customer-id',validated)).rejects.toThrow(/different booking/)
  expect(mocks.create).not.toHaveBeenCalled()
})
