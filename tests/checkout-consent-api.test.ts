import {beforeEach,expect,it,vi} from 'vitest'
import {Prisma} from '@prisma/client'
import {PriceChanged} from '@/lib/server/booking-quote'
import {bookingPriceSnapshot} from '@/lib/booking-price'
const m=vi.hoisted(()=>({current:vi.fn(),validate:vi.fn(),create:vi.fn(),prepare:vi.fn()}))
vi.mock('@/lib/server/auth',()=>({getCurrentUser:m.current}))
vi.mock('@/lib/server/bookings',()=>({validateBookingDraft:m.validate,createBookingRecord:m.create}))
vi.mock('@/lib/server/checkout-account',()=>({prepareCheckoutAccount:m.prepare}))
vi.mock('@/lib/server/booking-checkout',()=>({createCheckoutBooking:async(userId:string|null,selections:unknown,acceptedTerms:boolean)=>{
  if(!userId&&!acceptedTerms)throw Error('You must accept the Terms and Privacy Policy.')
  const draft=await m.validate(selections);draft.accountConsent=userId===null&&acceptedTerms
  const result=await m.create(userId,draft)
  return {...result,reference:result.booking.reference}
}}))
vi.mock('@/lib/server/rate-limit',()=>({checkBookingRateLimit:async()=>({allowed:true}),recordBookingAttempt:async()=>undefined}))
import {POST} from '@/app/api/bookings/route'
const request=(acceptedTerms?:unknown)=>new Request('https://starpyramids.com/api/bookings',{method:'POST',headers:{origin:'https://starpyramids.com',host:'starpyramids.com','content-type':'application/json'},body:JSON.stringify({contact:{email:'guest@example.com'},...(acceptedTerms===undefined?{}:{acceptedTerms})})})
beforeEach(()=>{vi.resetAllMocks();m.current.mockResolvedValue(null);m.validate.mockResolvedValue({contactEmail:'guest@example.com'});m.create.mockResolvedValue({created:true,booking:{reference:'SP-BK-ABC123'},guestAccessUrl:null});m.prepare.mockResolvedValue(undefined)})
it('requires explicit guest consent before any booking or enrollment write',async()=>{expect((await POST(request())).status).toBe(400);expect((await POST(request(false))).status).toBe(400);expect(m.create).not.toHaveBeenCalled();expect(m.prepare).not.toHaveBeenCalled()})
it('passes consent through a server-owned field and strips it from the selection validator',async()=>{const res=await POST(request(true));expect(res.status).toBe(201);expect(m.validate.mock.calls[0][0]).not.toHaveProperty('acceptedTerms');expect(m.create.mock.calls[0][1].accountConsent).toBe(true);expect(m.prepare).toHaveBeenCalledExactlyOnceWith('SP-BK-ABC123','guest@example.com')})
it('does not re-enroll authenticated customers or trust nonboolean consent',async()=>{expect((await POST(request('yes'))).status).toBe(400);m.current.mockResolvedValue({id:'u1',roles:['CUSTOMER']});expect((await POST(request())).status).toBe(201);expect(m.prepare).not.toHaveBeenCalled();expect(m.create.mock.calls[0][0]).toBe('u1')})
it('returns the committed booking even if account provisioning/email fails',async()=>{m.prepare.mockRejectedValue(Error('mail failed'));const res=await POST(request(true));expect(res.status).toBe(201);expect((await res.json()).reference).toBe('SP-BK-ABC123')})
it('price confirmation response cannot create a booking or enroll/send account credentials',async()=>{
  m.validate.mockRejectedValue(new PriceChanged(bookingPriceSnapshot([]),'signed-quote'))
  const res=await POST(request(true));expect(res.status).toBe(409);expect(await res.json()).toMatchObject({code:'PRICE_CHANGED',quote:'signed-quote'})
  expect(m.create).not.toHaveBeenCalled();expect(m.prepare).not.toHaveBeenCalled()
})
it.each(['validate','create'] as const)('does not expose persistence diagnostics from %s',async stage=>{
  m[stage].mockRejectedValue(new Prisma.PrismaClientKnownRequestError('private SQL details and internal-database-host',{code:'P2010',clientVersion:'test'}))
  const res=await POST(request(true))
  expect(res.status).toBe(503)
  expect(JSON.stringify(await res.json())).not.toMatch(/private SQL|internal-database-host/)
})
