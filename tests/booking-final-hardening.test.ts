import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import type {Tour} from '@/data/types'
import {Prisma} from '@prisma/client'
import {estimateCart} from '@/lib/booking/booking'
import {sanitizeCartItem} from '@/lib/booking/cart'
import {bookingPriceLine,bookingPriceSnapshot} from '@/lib/booking/booking-price'
const m=vi.hoisted(()=>({rows:[] as any[],tour:null as any,secondTour:null as any,reads:0,hook:null as null|(()=>void),mail:vi.fn(),token:vi.fn(),create:vi.fn(),query:vi.fn()}))
const db=vi.hoisted(()=>({booking:{findUnique:vi.fn(),create:vi.fn()},$transaction:vi.fn(),$queryRaw:vi.fn()}))
vi.mock('@/lib/server/db',()=>({db}))
vi.mock('@/lib/server/catalogue/tours',()=>({findTourBySlug:async(slug:string)=>{m.reads++;return slug==='second-tour'?m.secondTour:m.tour}}))
vi.mock('@/lib/server/notifications/notifications',()=>({notifyUser:vi.fn(),notifyStaff:vi.fn()}))
vi.mock('@/lib/server/email/email',()=>({sendCustomerEmailSafe:m.mail,sendStaffEmailSafe:m.mail}))
vi.mock('@/lib/server/booking/access/booking-access',()=>({issueGuestBookingToken:m.token,revokeGuestBookingTokens:vi.fn(),guestBookingPath:()=>'/booking/'+ 'x'.repeat(43)}))
import {createCheckoutBooking} from '@/lib/server/booking/checkout/booking-checkout'
import {PriceChanged,issuePriceQuote,verifyPriceQuote,requestDigest,priceDigest,QUOTE_TTL_MS} from '@/lib/server/booking/checkout/booking-quote'
const selection={tourSlug:'test-tour',date:'',adults:2,children:0,infants:0,addons:['Ticket','On request']}
const input=()=>({lines:[{...selection}],contact:{name:'Test Customer',email:'test@example.com',phone:'+201234567890'},notes:'Customer note',currency:'USD',idempotencyKey:'hardening-attempt-key'})
const snapshot=()=>bookingPriceSnapshot([bookingPriceLine(m.tour,selection)])
function tour():Tour{return {slug:'test-tour',category:'one-day-tours',status:'published',title:'Test tour',price:100,image:'',summary:'',duration:'Day',location:'Cairo',dayDetail:{overview:[],addOns:[{title:'Ticket',price:10},{title:'On request'}]}}}
beforeEach(()=>{
  vi.resetAllMocks();vi.stubEnv('BOOKING_QUOTE_SECRET','test-only-quote-secret-with-at-least-32-bytes');m.rows=[];m.tour=tour();m.secondTour=null;m.reads=0;m.hook=null
  db.booking.findUnique.mockImplementation(async({where})=>m.rows.find(row=>row.idempotencyKey===where.idempotencyKey)??null)
  db.booking.create.mockImplementation(async({data})=>{
    if(m.rows.some(row=>row.idempotencyKey===data.idempotencyKey))throw new Prisma.PrismaClientKnownRequestError('Unique constraint',{code:'P2002',clientVersion:'test',meta:{target:'bookings_idempotencyKey_key'}})
    const now=new Date();const row={...data,id:'b1',createdAt:now,updatedAt:now,payments:[],user:null,items:data.items.create.map((item:any)=>({...item})),activities:data.activities.create.map((a:any)=>({...a,createdAt:now}))};m.rows.push(row);m.create();return row
  })
  let tail=Promise.resolve()
  db.$transaction.mockImplementation(async fn=>{const previous=tail;let release!:()=>void;tail=new Promise<void>(r=>{release=r});await previous;try{m.hook?.();return await fn(db)}finally{release()}})
  db.$queryRaw.mockResolvedValue([]);m.mail.mockResolvedValue({status:'SENT'});m.token.mockResolvedValue(null)
})
afterEach(()=>vi.unstubAllEnvs())
it('books unchanged integer-cent pricing and records a hidden immutable intent',async()=>{
  const result=await createCheckoutBooking(null,input(),true,snapshot())
  expect(result.created).toBe(true);expect(m.rows).toHaveLength(1);expect(Number(m.rows[0].total)).toBe(210)
  expect(m.rows[0].status).toBe('PENDING');expect(m.rows[0].paymentStatus).toBe('PENDING')
  expect(m.rows[0].activities.find((a:any)=>a.action==='Checkout attempt fingerprint v1')).toMatchObject({isInternal:true})
  expect(result.booking?.activity.some(a=>a.action==='Checkout attempt fingerprint v1')).toBe(false)
})
const measurementGrants = { analytics: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', marketing: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }
const renewedGrant = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

it.each([null, 'customer-owner'])('returns one authoritative multi-tour milestone for new and recovered bookings (%s)', async owner => {
  const draft = input()
  const second = { ...selection, tourSlug: 'second-tour', addons: [] }
  draft.lines.push(second)
  m.secondTour = { ...tour(), slug: second.tourSlug, price: 140 }
  const accepted = bookingPriceSnapshot([bookingPriceLine(m.tour, selection), bookingPriceLine(m.secondTour, second)])
  const result = await createCheckoutBooking(owner, draft, !owner, accepted, undefined, false, measurementGrants)
  expect(result.bookingMeasurement).toEqual({
    event: {
      event: 'sp_booking_created', event_id: expect.stringMatching(/^bk_[a-f0-9]{32}$/), currency: 'USD', value: 490,
      items: [{ item_id: 'test-tour', price: 210, quantity: 1 }, { item_id: 'second-tour', price: 280, quantity: 1 }],
    },
    grants: measurementGrants,
  })
  expect(JSON.stringify(m.rows[0].activities)).not.toContain(measurementGrants.analytics)
  expect(JSON.stringify(m.rows[0].activities)).not.toContain(measurementGrants.marketing)
  const reads = m.reads
  m.tour = null
  m.secondTour = null
  const replay = await createCheckoutBooking(owner, draft, !owner, undefined, undefined, true, measurementGrants)
  expect(replay.created).toBe(false)
  expect(replay.bookingMeasurement).toEqual(result.bookingMeasurement)
  if (!owner) expect(replay.booking).toBeNull()
  expect(m.create).toHaveBeenCalledOnce()
  expect(m.reads).toBe(reads)
  await expect(createCheckoutBooking('wrong-owner', draft, false, undefined, undefined, true, measurementGrants)).rejects.toThrow(/different booking/)
})

it('keeps booking replay available without reviving withdrawn Analytics or attaching new Marketing consent', async () => {
  const analytics = measurementGrants.analytics
  const created = await createCheckoutBooking(null, input(), true, snapshot(), undefined, false, { analytics })
  const marketingLater = await createCheckoutBooking(null, input(), true, undefined, undefined, true, measurementGrants)
  expect(marketingLater.bookingMeasurement).toEqual(created.bookingMeasurement)
  expect(marketingLater.bookingMeasurement?.grants.marketing).toBeUndefined()
  const renewed = await createCheckoutBooking(null, input(), true, undefined, undefined, true, { ...measurementGrants, analytics: renewedGrant })
  expect(renewed).toMatchObject({ created: false, reference: created.reference })
  expect(renewed.bookingMeasurement).toBeUndefined()
})

it('cannot add measurement retroactively to an unmeasured booking or before persistence', async () => {
  const accepted = snapshot()
  await expect(createCheckoutBooking(null, input(), true, accepted, undefined, true, measurementGrants)).rejects.toThrow(/No completed booking/)
  m.tour.price = 110
  const changed = await createCheckoutBooking(null, input(), true, accepted, undefined, false, measurementGrants).catch(error => error)
  expect(changed).toBeInstanceOf(PriceChanged)
  expect(changed).not.toHaveProperty('bookingMeasurement')
  expect(m.rows).toHaveLength(0)
  await createCheckoutBooking(null, input(), true, changed.price, changed.quote)
  const replay = await createCheckoutBooking(null, input(), true, undefined, undefined, true, measurementGrants)
  expect(replay.bookingMeasurement).toBeUndefined()
})
it.each(['increase','decrease','extra','discount','component'] as const)('requires explicit signed acceptance for %s',async change=>{
  const old=snapshot()
  if(change==='increase')m.tour.price=120
  if(change==='decrease')m.tour.price=80
  if(change==='extra')m.tour.dayDetail.addOns[0].price=20
  if(change==='discount')m.tour.deal={percent:10,endsAt:'2099-01-01'}
  if(change==='component'){m.tour.price=101;m.tour.dayDetail.addOns[0].price=8}
  let changed!:PriceChanged
  try{await createCheckoutBooking(null,input(),true,old)}catch(e){changed=e as PriceChanged}
  expect(changed).toBeInstanceOf(PriceChanged);expect(m.create).not.toHaveBeenCalled();expect(m.token).not.toHaveBeenCalled();expect(m.mail).not.toHaveBeenCalled()
  expect((await createCheckoutBooking(null,input(),true,changed.price,changed.quote)).created).toBe(true)
})
it('invalidates acceptance after a second change, but preserves the original request',async()=>{
  const old=snapshot();m.tour.price=120
  const first=await createCheckoutBooking(null,input(),true,old).catch(e=>e as PriceChanged)
  m.tour.price=130
  await expect(createCheckoutBooking(null,input(),true,first.price,first.quote)).rejects.toBeInstanceOf(PriceChanged)
  expect(m.rows).toHaveLength(0);expect(input().lines).toEqual([selection])
})
it('rejects changed selection and forged acceptance',async()=>{
  const old=snapshot();m.tour.price=120;const changed=await createCheckoutBooking(null,input(),true,old).catch(e=>e as PriceChanged)
  await expect(createCheckoutBooking(null,input(),true,changed.price,changed.quote+'x')).rejects.toThrow(/Invalid price/)
  const other=input();other.lines[0].adults=3
  await expect(createCheckoutBooking(null,other,true,changed.price,changed.quote)).rejects.toThrow(/Invalid price/)
  expect(m.rows).toHaveLength(0)
})
it.each(['price','unpublished','deleted'] as const)('recovers a committed guest attempt after %s without private fields or new credentials',async change=>{
  const accepted=snapshot();await createCheckoutBooking(null,input(),true,accepted)
  const old=JSON.stringify(m.rows);const readCount=m.reads;const mailCount=m.mail.mock.calls.length
  if(change==='price')m.tour.price=900
  if(change==='unpublished')m.tour.status='draft'
  if(change==='deleted')m.tour=null
  const replay=await createCheckoutBooking(null,input(),true,accepted)
  expect(replay).toMatchObject({created:false,booking:null,guestAccessUrl:null});expect(m.reads).toBe(readCount)
  expect(JSON.stringify(m.rows)).toBe(old);expect(m.mail).toHaveBeenCalledTimes(mailCount);expect(m.create).toHaveBeenCalledTimes(1)
})
it('rejects mismatched intent and preserves authenticated ownership',async()=>{
  const accepted=snapshot();await createCheckoutBooking('owner',input(),false,accepted)
  const changed=input();changed.contact.phone='+201234567899'
  await expect(createCheckoutBooking('owner',changed,false,accepted)).rejects.toThrow(/different booking/)
  await expect(createCheckoutBooking('other',input(),false,accepted)).rejects.toThrow(/different booking/)
  await expect(createCheckoutBooking(null,input(),false,accepted)).rejects.toThrow(/different booking/)
})
it('serializes duplicate submissions without duplicate side effects',async()=>{
  const accepted=snapshot();const results=await Promise.all([createCheckoutBooking(null,input(),true,accepted),createCheckoutBooking(null,input(),true,accepted)])
  expect(results.map(r=>r.created).sort()).toEqual([false,true]);expect(m.create).toHaveBeenCalledTimes(1)
})
it.each(['price','publication'] as const)('rechecks %s inside the short persistence transaction',async change=>{
  const accepted=snapshot();m.hook=()=>{if(change==='price')m.tour.price=120;else m.tour.status='draft'}
  await expect(createCheckoutBooking(null,input(),true,accepted)).rejects.toThrow()
  expect(m.create).not.toHaveBeenCalled();expect(m.token).not.toHaveBeenCalled();expect(m.mail).not.toHaveBeenCalled()
  expect(db.$transaction.mock.calls[0][1]).toMatchObject({isolationLevel:'ReadCommitted'})
})
it('rejects unpublished new attempts and boolean-only acceptance',async()=>{
  const accepted=snapshot();m.tour.status='draft'
  await expect(createCheckoutBooking(null,input(),true,accepted)).rejects.toThrow(/no longer available/)
  m.tour.status='published'
  await expect(createCheckoutBooking(null,input(),true,true)).rejects.toThrow(/Invalid price snapshot/)
  expect(m.rows).toHaveLength(0)
})
it('keeps a committed booking successful when the supposedly safe mail wrapper rejects',async()=>{
  m.mail.mockRejectedValue(Error('provider unavailable'))
  await expect(createCheckoutBooking(null,input(),true,snapshot())).resolves.toMatchObject({created:true})
  expect(m.rows).toHaveLength(1)
})
it('uses expiring opaque hashes without personal details in a price token',()=>{
  const price=snapshot(),intent=requestDigest(input()),now=Date.now()
  const token=issuePriceQuote(intent,price,now)
  expect(verifyPriceQuote(token,intent,price,now)).toBe('valid')
  expect(verifyPriceQuote(token,intent,price,now+QUOTE_TTL_MS)).toBe('refresh')
  expect(Buffer.from(token.split('.')[0],'base64url').toString()).not.toMatch(/test@example|Test Customer|201234/)
  expect(priceDigest(price)).toMatch(/^[a-f0-9]{64}$/)
})
it('does not downgrade an empty supplied confirmation into an initial price acceptance',async()=>{
  const accepted=snapshot()
  await expect(createCheckoutBooking(null,input(),true,accepted,'')).rejects.toThrow(/Invalid price confirmation/)
  expect(m.rows).toHaveLength(0)
})
it('uses conservative legacy request matching without consulting the live catalogue',async()=>{
  await createCheckoutBooking(null,input(),true,snapshot())
  m.rows[0].activities=m.rows[0].activities.filter((a:any)=>a.action!=='Checkout attempt fingerprint v1')
  m.tour=null
  expect(await createCheckoutBooking(null,input(),true,undefined)).toMatchObject({created:false,booking:null})
  const other=input();other.lines[0].addons=['Ticket']
  await expect(createCheckoutBooking(null,other,true,undefined)).rejects.toThrow(/different booking/)
})
it('a recovery-only request cannot become a new booking',async()=>{
  await expect(createCheckoutBooking(null,input(),true,snapshot(),undefined,true)).rejects.toThrow(/No completed booking/)
  expect(m.create).not.toHaveBeenCalled();expect(m.reads).toBe(0)
})
it('revalidates expiry and requires a fresh explicit confirmation',async()=>{
  const price=snapshot();const identity=(await import('@/lib/server/booking/checkout/booking-checkout')).checkoutRequestIdentity(input(),true)
  const expired=issuePriceQuote(requestDigest({fingerprint:identity.fingerprint,key:identity.key,userId:null}),price,Date.now()-QUOTE_TTL_MS)
  await expect(createCheckoutBooking(null,input(),true,price,expired)).rejects.toBeInstanceOf(PriceChanged)
  expect(m.rows).toHaveLength(0)
})
it('the unique-key race winner is safely acknowledged without minting another credential',async()=>{
  const insert=db.booking.create.getMockImplementation()!
  let entered=0,release!:()=>void
  const gate=new Promise<void>(done=>{release=done})
  db.$transaction.mockImplementation(fn=>fn(db)) // unique-constraint layer, not a lock simulation
  db.booking.create.mockImplementation(async args=>{if(++entered===2)release();await gate;return insert(args)})
  const price=snapshot();const results=await Promise.all([createCheckoutBooking(null,input(),true,price),createCheckoutBooking(null,input(),true,price)])
  expect(db.booking.create).toHaveBeenCalledTimes(2);expect(m.rows).toHaveLength(1)
  expect(results.map(r=>r.created).sort()).toEqual([false,true]);expect(m.create).toHaveBeenCalledTimes(1)
  expect(results.find(r=>!r.created)?.booking).toBeNull()
})
it('keeps the displayed snapshot when a discount expires before submission',async()=>{
  vi.useFakeTimers()
  try{
    vi.setSystemTime(new Date('2026-11-03T10:00:00Z'));m.tour.deal={percent:10,endsAt:'2026-11-03T10:00:01Z'}
    const item=sanitizeCartItem({...selection,title:'Test tour'})!
    const shown=estimateCart([item],[m.tour])
    const accepted=bookingPriceSnapshot(shown.validLines.map(line=>line.price!))
    expect(accepted.total/100).toBe(shown.subtotal)
    vi.advanceTimersByTime(2000)
    await expect(createCheckoutBooking(null,input(),true,accepted)).rejects.toBeInstanceOf(PriceChanged)
    expect(m.rows).toHaveLength(0)
  }finally{vi.useRealTimers()}
})
