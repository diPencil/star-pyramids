import {beforeEach,it,expect,vi} from 'vitest'
import type {StaffBooking} from '@/lib/booking/booking'
const m=vi.hoisted(()=>({
  current:vi.fn(),permission:vi.fn(),userMany:vi.fn(),userOne:vi.fn(),bookings:vi.fn(),write:vi.fn(),
  related:vi.fn(),transaction:vi.fn(),
}))
vi.mock('@/lib/server/db',()=>({db:{
  $transaction:m.transaction,
  user:{findMany:m.userMany,findUnique:m.userOne,create:m.write,update:m.write},booking:{findMany:m.bookings,update:m.write,create:m.write},
  tripRequest:{findMany:m.related},carRequest:{findMany:m.related},eventRequest:{findMany:m.related},favoriteItem:{findMany:m.related},conversation:{findMany:m.related},supportConversation:{findMany:m.related},
}}))
vi.mock('@/lib/server/auth/auth',()=>({getCurrentUser:m.current,hasPermission:m.permission}))
import {listCustomers,listGuestBookingContacts,getCustomerDetail} from '@/lib/server/account/customers'
import {GET} from '@/app/api/admin/customers/route'
import {GET as detailGET} from '@/app/api/admin/customers/[publicId]/route'
import {toAdminBookingRow} from '@/lib/admin/admin-booking-row'
const now=new Date('2026-11-03T10:00:00Z')
const item=(title:string)=>({tourSlug:title.toLowerCase(),tourTitle:title,travelDate:'',adults:2,children:0,infants:0})
const booking=()=>({reference:'SP-BK-TEST01',total:620,currency:'USD',status:'PENDING',paymentStatus:'PENDING',createdAt:now,items:[item('Alexandria'),item('Ancient Wonders')],payments:[],_count:{items:2}})
const customer=()=>({id:'internal-customer',publicId:'public-customer',email:'customer@example.com',firstName:'Test',lastName:'Customer',username:null,countryCode:null,phone:'+201234567890',avatar:null,status:'ACTIVE',emailVerifiedAt:now,lastLoginAt:null,createdAt:now,bookings:[booking()],roles:[{role:{key:'CUSTOMER'}}]})
const guest=()=>({...booking(),contactName:'Guest Contact',contactEmail:'guest@example.com',contactPhone:'+201234567890',userId:null,tokenHash:'must-not-leak'})
beforeEach(()=>{
  vi.resetAllMocks();m.current.mockResolvedValue({publicId:'staff',roles:['STAFF'],permissions:['customers.view','bookings.view']})
  m.transaction.mockImplementation(callback=>callback({user:{findMany:m.userMany},booking:{findMany:m.bookings}}))
  m.permission.mockImplementation((_user,permission)=>['customers.view','bookings.view'].includes(permission))
  m.userMany.mockResolvedValue([customer()]);m.userOne.mockResolvedValue(customer());m.bookings.mockResolvedValue([guest()]);m.related.mockResolvedValue([])
})
it('keeps one booking distinct from two trips and four traveler participations',()=>{
  const source={reference:'SP-BK-TEST01',currency:'USD',contact:{name:'Guest Contact'},account:null,createdAt:now.toISOString(),lines:booking().items.map(row=>({title:row.tourTitle,adults:2,children:0,infants:0,date:''})),total:620,status:'pending'} as StaffBooking
  const row=toAdminBookingRow(source)
  expect(row.trips).toBe(2);expect(row.guests).toBe(4);expect(row.total).toBe(620)
  expect(row.tourTitles).toEqual(['Alexandria','Ancient Wonders']);expect(row.tour).toContain('Ancient Wonders')
})
it('registered customer counts use real linked booking rows and item counts',async()=>{
  const rows=await listCustomers()
  expect(rows[0]).toMatchObject({bookingsCount:1,tripsCount:2,totalSpent:620})
  expect(m.userMany.mock.calls[0][0].select.bookings.select._count).toEqual({select:{items:true}})
  expect(m.bookings).not.toHaveBeenCalled();expect(m.write).not.toHaveBeenCalled()
})
it('profile trip totals come only from this account foreign key',async()=>{
  m.bookings.mockResolvedValue([booking()])
  const profile=await getCustomerDetail('public-customer')
  expect(profile).toMatchObject({bookingsCount:1,tripsCount:2})
  expect(m.bookings.mock.calls[0][0].where).toEqual({userId:'internal-customer'})
  expect(m.write).not.toHaveBeenCalled()
})
it('legacy guest contacts are visible read-only without grouping or claiming accounts by email',async()=>{
  m.bookings.mockResolvedValue([guest(),{...guest(),reference:'SP-BK-TEST02'}])
  const contacts=await listGuestBookingContacts()
  expect(contacts).toHaveLength(2);expect(contacts[0].tripsCount).toBe(2)
  expect(m.bookings.mock.calls[0][0].where).toEqual({userId:null})
  expect(JSON.stringify(contacts)).not.toMatch(/tokenHash|must-not-leak|publicId|userId/)
  expect(m.userMany).not.toHaveBeenCalled();expect(m.write).not.toHaveBeenCalled()
})
it('requires both directory permission and booking permission for guest contacts',async()=>{
  m.permission.mockImplementation((_user,permission)=>permission==='customers.view')
  const response=await GET(),body=await response.json()
  expect(response.status).toBe(200);expect(body.guestContacts).toEqual([]);expect(body.viewer.canViewGuestContacts).toBe(false)
  expect(m.bookings).not.toHaveBeenCalled()
})
it('returns the explicit server capability without relying on browser permission strings',async()=>{
  m.current.mockResolvedValue({publicId:'staff',roles:['SUPER_ADMIN'],permissions:[]})
  m.permission.mockReturnValue(true)
  const response=await GET(),body=await response.json()
  expect(body.viewer.canViewGuestContacts).toBe(true);expect(body.guestContacts[0].tripsCount).toBe(2)
  expect(response.headers.get('Cache-Control')).toBe('no-store');expect(m.write).not.toHaveBeenCalled()
  expect(m.transaction.mock.calls[0][1]).toEqual({isolationLevel:'RepeatableRead'})
})
it('does not query or expose customer contacts to unauthenticated or unauthorized callers',async()=>{
  m.current.mockResolvedValue(null);expect((await GET()).status).toBe(401)
  m.current.mockResolvedValue({publicId:'staff'});m.permission.mockReturnValue(false);expect((await GET()).status).toBe(403)
  expect(m.userMany).not.toHaveBeenCalled();expect(m.bookings).not.toHaveBeenCalled()
})
it('does not merge same-name guest contacts, and excludes a linked booking on refresh',async()=>{
  const records=[guest(),{...guest(),reference:'SP-BK-TEST02',contactEmail:'different@example.com'}, {...guest(),reference:'SP-BK-LINKED',userId:'internal-customer'}]
  m.bookings.mockImplementation(({where})=>Promise.resolve(records.filter(b=>b.userId===where.userId)))
  const rows=await listGuestBookingContacts()
  expect(rows.map(r=>r.reference)).toEqual(['SP-BK-TEST01','SP-BK-TEST02'])
  expect(rows.every(r=>r.bookingsCount===1)).toBe(true)
  expect(m.bookings).toHaveBeenCalledTimes(1);expect(m.write).not.toHaveBeenCalled()
})
it('aggregates multiple linked bookings and their actual item counts without multiplying totals',async()=>{
  m.userMany.mockResolvedValue([{...customer(),bookings:[booking(),{...booking(),currency:'EUR',total:50,_count:{items:3}}]}])
  const [row]=await listCustomers()
  expect(row).toMatchObject({bookingsCount:2,tripsCount:5,totalSpent:620,collectedValue:null})
  expect(row.bookedValue).toEqual([{currency:'EUR',amount:50},{currency:'USD',amount:620}])
  expect(m.userMany.mock.calls[0][0].select.bookings.select.payments).toBe(false)
})
it('reads real guest payments only when explicitly permitted and nets refunds by currency',async()=>{
  m.bookings.mockResolvedValue([{...guest(),payments:[{currency:'EUR',status:'PARTIALLY_REFUNDED',amountPaid:100,amountRefunded:30}]}])
  const [row]=await listGuestBookingContacts({includeFinancial:true})
  expect(row.collectedValue).toEqual([{currency:'EUR',amount:70}])
  expect(m.bookings.mock.calls[0][0].select.payments.select.amountRefunded).toBe(true)
})
it('customer API permissions guard another customer record and disable financial selection',async()=>{
  m.current.mockResolvedValue(null)
  const params={params:Promise.resolve({publicId:'other-customer'})}
  expect((await detailGET(new Request('http://localhost/api/admin/customers/other-customer'),params)).status).toBe(401)
  m.current.mockResolvedValue({publicId:'customer',roles:['CUSTOMER'],permissions:[]});m.permission.mockReturnValue(false)
  expect((await detailGET(new Request('http://localhost/api/admin/customers/other-customer'),params)).status).toBe(403)
  expect(m.userOne).not.toHaveBeenCalled()
})
it('account detail rejects a non-customer rather than projecting an arbitrary identity',async()=>{
  m.userOne.mockResolvedValue({...customer(),roles:[{role:{key:'STAFF'}}]})
  await expect(getCustomerDetail('staff-user')).rejects.toThrow('Customer not found')
  expect(m.bookings).not.toHaveBeenCalled()
})
