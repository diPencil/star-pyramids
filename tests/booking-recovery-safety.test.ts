import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => {
  const tokens: {id:string; createdAt:Date; tokenHash:string; revokedAt?:Date; expiresAt:Date}[] = []
  const db = { $queryRaw:vi.fn(), booking:{findUnique:vi.fn()}, bookingAccessToken:{findFirst:vi.fn(),create:vi.fn(),updateMany:vi.fn()}, $transaction:vi.fn() }
  return {db,tokens,mail:vi.fn(),check:vi.fn(),record:vi.fn()}
})
vi.mock('@/lib/server/db',()=>({db:state.db}))
vi.mock('@/lib/server/email/email',()=>({sendCustomerEmailSafe:state.mail}))
vi.mock('@/lib/server/booking/access/booking-access',()=>({DEFAULT_ACCESS_TTL_DAYS:90,guestBookingPath:(raw:string)=>`/booking/${raw}`}))
vi.mock('@/lib/server/rate-limit',()=>({checkBookingRateLimit:state.check,recordBookingAttempt:state.record}))
import { emailGuestBookingAccess } from '@/lib/server/booking/access/booking-recovery'
import { POST } from '@/app/api/bookings/request-access/route'
import { hashToken } from '@/lib/core/tokens'
import { readBoundedJson } from '@/lib/server/request-json'
const ref='SP-BK-ABC123'
const customer={reference:ref,userId:null,contactEmail:'guest@example.com',contactName:'Guest'}
const request=(body:unknown={reference:ref,email:customer.contactEmail},origin='https://starpyramids.com')=>new Request('https://starpyramids.com/api/bookings/request-access',{method:'POST',headers:{origin,host:'starpyramids.com','content-type':'application/json'},body:JSON.stringify(body)})
beforeEach(()=>{
  vi.resetAllMocks(); state.tokens.length=0
  let tail=Promise.resolve()
  state.db.$transaction.mockImplementation(async fn=>{const previous=tail;let release!:()=>void;tail=new Promise<void>(resolve=>{release=resolve});await previous;try{return await fn(state.db)}finally{release()}})
  state.db.booking.findUnique.mockResolvedValue({...customer})
  state.db.bookingAccessToken.findFirst.mockImplementation(async ({where})=>state.tokens.find(t=>!t.revokedAt&&t.createdAt>=where.createdAt.gte&&t.expiresAt>where.expiresAt.gt)??null)
  state.db.bookingAccessToken.create.mockImplementation(async ({data})=>{const token={...data,id:`t${state.tokens.length}`,createdAt:new Date()};state.tokens.push(token);return token})
  state.db.bookingAccessToken.updateMany.mockResolvedValue({count:1})
  state.mail.mockResolvedValue({status:'SENT'});state.check.mockResolvedValue({allowed:true,retryAfterSeconds:0});state.record.mockResolvedValue(undefined)
})
it('sends only to the stored address, persists only a token hash and revokes older links after mail acceptance',async()=>{
  await emailGuestBookingAccess(ref,customer.contactEmail)
  const [event,to,data] = state.mail.mock.calls[0]
  expect(event).toBe('booking_access_requested');expect(to).toBe(customer.contactEmail)
  expect(data.detailUrl).toMatch(/^\/booking\/[A-Za-z0-9_-]{43}$/)
  const raw=data.detailUrl.split('/').pop()
  expect(state.tokens[0].tokenHash).toBe(hashToken(raw))
  expect(JSON.stringify(state.db.bookingAccessToken.create.mock.calls)).not.toContain(raw)
  expect(state.db.bookingAccessToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({tokenHash:{not:hashToken(raw)},createdAt:{lte:state.tokens[0].createdAt}})}))
  expect(state.db.$queryRaw).toHaveBeenCalled()
})
it.each([null,{...customer,userId:'customer-id'},{...customer,contactEmail:'someone-else@example.com'}])('never mints a credential for an unmatched/owned booking %j',async row=>{
  state.db.booking.findUnique.mockResolvedValue(row)
  await emailGuestBookingAccess(ref,customer.contactEmail)
  expect(state.mail).not.toHaveBeenCalled();expect(state.db.bookingAccessToken.create).not.toHaveBeenCalled()
})
it('coalesces simultaneous recovery requests under the booking lock',async()=>{
  await Promise.all([emailGuestBookingAccess(ref,customer.contactEmail),emailGuestBookingAccess(ref,customer.contactEmail)])
  expect(state.mail).toHaveBeenCalledTimes(1);expect(state.tokens).toHaveLength(1)
})
it.each([null,{status:'FAILED'}])('revokes only the newly undelivered token if mail fails (%j)',async delivery=>{
  state.mail.mockResolvedValue(delivery)
  await emailGuestBookingAccess(ref,customer.contactEmail)
  expect(state.db.bookingAccessToken.updateMany).toHaveBeenCalledExactlyOnceWith({where:{id:'t0'},data:{revokedAt:expect.any(Date)}})
})
it('uses the same generic endpoint response for known and missing bookings and never returns the private URL',async()=>{
  const known=await POST(request()),body=await known.json()
  state.db.booking.findUnique.mockResolvedValue(null)
  const missing=await POST(request())
  expect(known.status).toBe(200);expect(await missing.json()).toEqual(body);expect(body).toEqual({accepted:true})
  expect(JSON.stringify(body)).not.toMatch(/booking\/|guest@example|tokenHash/)
  expect(state.record).toHaveBeenCalledTimes(2)
})
it('normalizes the submitted email while mailing only the address saved on the booking',async()=>{
  const response=await POST(request({reference:ref,email:' GUEST@EXAMPLE.COM '}))
  expect(response.status).toBe(200);expect(state.mail.mock.calls[0][1]).toBe(customer.contactEmail)
})
it('rejects cross-origin requests and attempts to redirect the email without touching persistence',async()=>{
  expect((await POST(request(undefined,'https://evil.example'))).status).toBe(403)
  expect((await POST(request({reference:ref,email:customer.contactEmail,to:'evil@example.com'}))).status).toBe(400)
  expect(state.record).not.toHaveBeenCalled();expect(state.db.$transaction).not.toHaveBeenCalled()
})
it('honors the existing rate limit without emailing or minting tokens',async()=>{
  state.check.mockResolvedValue({allowed:false,retryAfterSeconds:60})
  const response=await POST(request());expect(response.status).toBe(429);expect(response.headers.get('retry-after')).toBe('60');expect(state.db.$transaction).not.toHaveBeenCalled()
})
it('bounds actual body bytes even without Content-Length',async()=>{
  const body={reference:ref,email:customer.contactEmail,padding:'x'.repeat(2200)}
  expect((await POST(request(body))).status).toBe(400)
  await expect(readBoundedJson(request(body),100)).rejects.toThrow(/too large/)
  expect(state.check).not.toHaveBeenCalled()
})
