import { beforeEach, expect, it, vi } from 'vitest'
const m=vi.hoisted(()=>({bookings:vi.fn(),items:vi.fn(),itemCount:vi.fn(),payments:vi.fn(),count:vi.fn(),empty:vi.fn()}))
vi.mock('@/lib/server/db',()=>({db:{
  booking:{findMany:m.bookings},bookingItem:{findMany:m.items,count:m.itemCount},payment:{findMany:m.payments},
  user:{count:m.count,findMany:m.empty},tour:{findMany:m.empty},tripRequest:{findMany:m.empty},carRequest:{findMany:m.empty},eventRequest:{findMany:m.empty},websiteEnquiry:{findMany:m.empty},review:{findMany:m.empty},
}}))
import { getAnalytics } from '@/lib/server/analytics/analytics'
import { parseAnalyticsRange } from '@/lib/analytics/analytics-range'
const range=()=>parseAnalyticsRange(new URLSearchParams({from:'2026-11-03',to:'2026-11-03'}))
const createdAt=new Date('2026-11-03T14:00:00Z')
const bookings=[
  {status:'PENDING',currency:'USD',total:620,createdAt,userId:null},
  {status:'CONFIRMED',currency:'EUR',total:60,createdAt,userId:null},
  {status:'CANCELLED',currency:'USD',total:25,createdAt,userId:null},
]
const items=[
  {tourSlug:'alexandria',tourTitle:'Alexandria',lineTotal:320,booking:bookings[0]},
  {tourSlug:'ancient',tourTitle:'Ancient Wonders',lineTotal:300,booking:bookings[0]},
  {tourSlug:'third',tourTitle:'Third tour',lineTotal:60,booking:bookings[1]},
  {tourSlug:'cancelled',tourTitle:'Cancelled tour',lineTotal:25,booking:bookings[2]},
]
const within=(date:Date,window:{gte:Date;lt:Date})=>date>=window.gte&&date<window.lt
beforeEach(()=>{
  vi.resetAllMocks();m.empty.mockResolvedValue([]);m.count.mockResolvedValue(0)
  m.bookings.mockImplementation(({where})=>Promise.resolve(bookings.filter(b=>within(b.createdAt,where.createdAt))))
  m.items.mockImplementation(({where})=>Promise.resolve(items.filter(i=>within(i.booking.createdAt,where.booking.createdAt)&&i.booking.status!==where.booking.status.not)))
  m.itemCount.mockResolvedValue(0)
  const payments=[
    {status:'PARTIALLY_REFUNDED',currency:'USD',amountPaid:100,amountRefunded:20,amount:100,createdAt,paidAt:createdAt},
    {status:'PAID',currency:'EUR',amountPaid:15,amountRefunded:0,amount:15,createdAt:new Date('2026-10-01'),paidAt:createdAt},
    {status:'PAID',currency:'USD',amountPaid:50,amountRefunded:0,amount:50,createdAt,paidAt:new Date('2026-11-04T00:00:00Z')},
    {status:'PENDING',currency:'USD',amountPaid:0,amountRefunded:0,amount:620,createdAt,paidAt:null},
  ]
  m.payments.mockImplementation(({where})=>Promise.resolve(payments.filter(p=>!where?.status||where.status.in.includes(p.status))))
})
it('separates booking records, requested trips, confirmed trips and collected money by currency',async()=>{
  const result=await getAnalytics(range())
  expect(result.kpis.bookings).toMatchObject({total:3,pending:1,confirmed:1,cancelled:1})
  expect(result.kpis.tripsSold).toBe(3);expect(result.kpis.confirmedTrips).toBe(1)
  expect(result.kpis.bookingVolume).toEqual([{currency:'EUR',amount:60},{currency:'USD',amount:620}])
  expect(result.kpis.collected).toEqual([{currency:'EUR',amount:15},{currency:'USD',amount:80}])
  expect(result.kpis.collectedPayments).toBe(2)
})
it('uses the same booking-creation window for trip items and bookings, never travel date',async()=>{
  const window=range()
  await getAnalytics(window)
  expect(m.bookings.mock.calls[0][0].where.createdAt).toEqual({gte:window.start,lt:window.endExclusive})
  expect(m.items.mock.calls[0][0].where.booking).toEqual({createdAt:{gte:window.start,lt:window.endExclusive},status:{not:'CANCELLED'}})
  expect(m.items.mock.calls[0][0].select.booking.select.status).toBe(true)
})
it('never reads payment data without the financial capability',async()=>{
  const result=await getAnalytics(range(),{includeFinancial:false})
  expect(m.payments).not.toHaveBeenCalled();expect(result.financial).toBe(false)
  expect(result.kpis.collected).toEqual([]);expect(result.kpis.confirmedTrips).toBe(1)
})
