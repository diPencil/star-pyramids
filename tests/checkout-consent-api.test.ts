import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {Prisma} from '@prisma/client'
import {PriceChanged} from '@/lib/server/booking/checkout/booking-quote'
import {bookingPriceSnapshot} from '@/lib/booking/booking-price'
import { BOOKING_MEASUREMENT_HEADER, type BookingMeasurementGrants } from '@/lib/tracking/leads/booking-measurement'
import { confirmationCookieName, readBookingConfirmation } from '@/lib/server/booking/access/booking-confirmation'
const m=vi.hoisted(()=>({current:vi.fn(),validate:vi.fn(),create:vi.fn(),prepare:vi.fn(),recordFailure:vi.fn(),tracking:vi.fn()}))
vi.mock('@/lib/server/auth/auth',()=>({getCurrentUser:m.current}))
vi.mock('@/lib/server/booking/bookings',()=>({validateBookingDraft:m.validate,createBookingRecord:m.create}))
vi.mock('@/lib/server/booking/checkout/checkout-account',()=>({prepareCheckoutAccount:m.prepare,recordCheckoutAccountPreparationFailure:m.recordFailure}))
vi.mock('@/lib/server/tracking/tracking',()=>({getTrackingSettings:m.tracking}))
vi.mock('@/lib/server/booking/checkout/booking-checkout',()=>({createCheckoutBooking:async(userId:string|null,selections:unknown,acceptedTerms:boolean,_price:unknown,_quote:unknown,_recover:unknown,measurement?:BookingMeasurementGrants)=>{
  if(!userId&&!acceptedTerms)throw Error('You must accept the Terms and Privacy Policy.')
  const draft=await m.validate(selections);draft.accountConsent=userId===null&&acceptedTerms
  const result=await m.create(userId,draft)
  return {...result,reference:result.booking?.reference??result.reference,bookingMeasurement:measurement?result.bookingMeasurement:undefined}
}}))
vi.mock('@/lib/server/rate-limit',()=>({checkBookingRateLimit:async()=>({allowed:true}),recordBookingAttempt:async()=>undefined}))
import {POST} from '@/app/api/bookings/route'
const request=(acceptedTerms?:unknown)=>new Request('https://starpyramids.com/api/bookings',{method:'POST',headers:{origin:'https://starpyramids.com',host:'starpyramids.com','content-type':'application/json'},body:JSON.stringify({contact:{email:'guest@example.com'},...(acceptedTerms===undefined?{}:{acceptedTerms})})})
beforeEach(()=>{vi.resetAllMocks();m.current.mockResolvedValue(null);m.validate.mockResolvedValue({contactEmail:'guest@example.com'});m.create.mockResolvedValue({created:true,booking:{reference:'SP-BK-ABC123'},guestAccessUrl:null});m.prepare.mockResolvedValue(undefined);m.recordFailure.mockResolvedValue(undefined)})
afterEach(()=>vi.unstubAllEnvs())

it.each([null, 'fixture-customer'])('issues a confirmation only after persistence for guest/customer %s', async ownerId => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('BOOKING_QUOTE_SECRET', 'fixture-existing-quote-key-at-least-32-bytes')
  if (ownerId) m.current.mockResolvedValue({ id: ownerId, roles: ['CUSTOMER'] })
  const guestAccessUrl = ownerId ? null : '/booking/' + 'a'.repeat(43)
  m.create.mockResolvedValue({ created: true, booking: { reference: 'SP-BK-ABC123', total: 100 }, guestAccessUrl })
  const result = await POST(request(true))
  const reply = await result.json()
  expect(result.status).toBe(201)
  expect(m.create).toHaveBeenCalledOnce()
  expect(reply.bookingConfirmationUrl).toMatch(/^\/booking-confirmation\?flow=[a-f0-9]{32}$/)
  const flow = new URL(reply.bookingConfirmationUrl, 'https://starpyramids.com').searchParams.get('flow')
  const value = result.cookies.get(confirmationCookieName())?.value
  const context = readBookingConfirmation(value, flow)
  expect(context?.ownerId).toBe(ownerId)
  expect(context?.receipt.guestAccessUrl).toBe(guestAccessUrl)
  expect(context?.receipt.reference).toBe(reply.reference)
  m.create.mockRejectedValueOnce(Error('fixture persistence failure'))
  const failure = await POST(request(true))
  expect(failure.headers.get('set-cookie')).toBeNull()
  expect((await failure.json()).bookingConfirmationUrl).toBeUndefined()
})
it('requires explicit guest consent before any booking or enrollment write',async()=>{expect((await POST(request())).status).toBe(400);expect((await POST(request(false))).status).toBe(400);expect(m.create).not.toHaveBeenCalled();expect(m.prepare).not.toHaveBeenCalled()})
it('passes consent through a server-owned field and strips it from the selection validator',async()=>{const res=await POST(request(true));expect(res.status).toBe(201);expect(m.validate.mock.calls[0][0]).not.toHaveProperty('acceptedTerms');expect(m.create.mock.calls[0][1].accountConsent).toBe(true);expect(m.prepare).toHaveBeenCalledExactlyOnceWith('SP-BK-ABC123','guest@example.com')})
it('does not re-enroll authenticated customers or trust nonboolean consent',async()=>{expect((await POST(request('yes'))).status).toBe(400);m.current.mockResolvedValue({id:'u1',roles:['CUSTOMER']});expect((await POST(request())).status).toBe(201);expect(m.prepare).not.toHaveBeenCalled();expect(m.create.mock.calls[0][0]).toBe('u1')})
it('returns the committed booking and records a safe internal follow-up if account provisioning fails',async()=>{m.prepare.mockRejectedValue(Error('private SQL or token details'));const res=await POST(request(true));expect(res.status).toBe(201);expect((await res.json()).reference).toBe('SP-BK-ABC123');expect(m.recordFailure).toHaveBeenCalledExactlyOnceWith('SP-BK-ABC123')})
it('failure to store the follow-up never rolls back a committed booking or returns private diagnostics',async()=>{
  m.prepare.mockRejectedValue(Error('private credential'));m.recordFailure.mockRejectedValue(Error('private storage error'))
  const response=await POST(request(true))
  expect(response.status).toBe(201);expect(JSON.stringify(await response.json())).not.toContain('private')
})
it('committed replays do not re-enroll or issue another account email',async()=>{
  m.create.mockResolvedValue({created:false,booking:{reference:'SP-BK-ABC123'},guestAccessUrl:null})
  expect((await POST(request(true))).status).toBe(200)
  expect(m.prepare).not.toHaveBeenCalled();expect(m.recordFailure).not.toHaveBeenCalled()
})
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

it('returns only the safe milestone alongside a minimal guest recovery receipt when enabled', async () => {
  vi.stubEnv('NODE_ENV', 'production')
  m.tracking.mockResolvedValue({ enabled: true })
  const grants = { analytics: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }
  const bookingMeasurement = {
    grants,
    event: { event: 'sp_booking_created', event_id: 'bk_' + 'a'.repeat(32),
      value: 100, currency: 'USD', items: [{ item_id: 'tour', quantity: 1, price: 100 }] },
  }
  m.create.mockResolvedValue({ created: false, booking: null, reference: 'SP-BK-ABC123', bookingMeasurement })
  const optedIn = () => {
    const incoming = request(true)
    incoming.headers.set(BOOKING_MEASUREMENT_HEADER, grants.analytics)
    return incoming
  }
  const minimal = { success: true, existing: true, reference: 'SP-BK-ABC123', guest: true, guestAccessUrl: null }
  const response = await POST(optedIn())
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual({ ...minimal, bookingMeasurement })
  expect(await (await POST(request(true))).json()).toEqual(minimal)
  m.tracking.mockResolvedValue({ enabled: false })
  expect(await (await POST(optedIn())).json()).toEqual(minimal)
  m.tracking.mockResolvedValue({ enabled: true })
  vi.stubEnv('NODE_ENV', 'development')
  expect(await (await POST(optedIn())).json()).toEqual(minimal)
})
