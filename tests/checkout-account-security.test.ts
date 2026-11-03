import {beforeEach,expect,it,vi} from 'vitest'
import {hashToken} from '@/lib/core/tokens'
import {Prisma} from '@prisma/client'
import {bookingActivityLabel} from '@/lib/booking'
const shared=vi.hoisted(()=>{
  type Row=Record<string,any>
  const state={users:[] as Row[],bookings:[] as Row[],tokens:[] as Row[],activities:[] as Row[],failLink:false}
  const db={user:{findMany:vi.fn(),findUnique:vi.fn(),create:vi.fn(),update:vi.fn(),updateMany:vi.fn()},booking:{findMany:vi.fn(),findUnique:vi.fn(),updateMany:vi.fn()},bookingActivity:{findFirst:vi.fn(),create:vi.fn()},accountSetupToken:{findUnique:vi.fn(),create:vi.fn(),updateMany:vi.fn()},bookingAccessToken:{updateMany:vi.fn()},$queryRaw:vi.fn(),$transaction:vi.fn()}
  return {state,db,mail:vi.fn(),hash:vi.fn(),current:vi.fn(),permission:vi.fn(),checkout:vi.fn()}
})
vi.mock('@/lib/server/db',()=>({db:shared.db}))
vi.mock('@/lib/server/email',()=>({sendCustomerEmailSafe:shared.mail}))
vi.mock('@/lib/core/password',()=>({hashPassword:shared.hash}))
vi.mock('@/lib/server/auth',()=>({getCurrentUser:shared.current,hasPermission:shared.permission}))
vi.mock('@/lib/server/booking-checkout',()=>({createCheckoutBooking:shared.checkout}))
vi.mock('@/lib/server/booking-request-security',()=>({bookingSameOrigin:(request:Request)=>request.headers.get('origin')===new URL(request.url).origin,bookingClientIp:()=> 'unknown',reserveBookingAttempt:async()=>({allowed:true})}))
import {prepareCheckoutAccount,inspectCheckoutAccount,completeCheckoutAccount,recordCheckoutAccountPreparationFailure} from '@/lib/server/checkout-account'
import {POST as checkoutPOST} from '@/app/api/bookings/route'
import {GET as customersGET} from '@/app/api/admin/customers/route'
const {state,db}=shared
const reference='SP-BK-ABC123',email='guest@example.com'
const oldUser=()=>({id:'u1',email,emailNormalized:email,status:'ACTIVE',passwordHash:'existing-hash',firstName:'Existing',phone:'original-phone',emailVerifiedAt:null,roles:[{assignedBy:'registration',role:{key:'CUSTOMER'}}]})
it.each(['Checkout account consent accepted','Checkout account email requested','Checkout account setup needs recovery','Booking linked after email verification'])('localizes the new history action %s',action=>{expect(bookingActivityLabel(action,'es')).not.toBe(action);expect(bookingActivityLabel(action,'it')).not.toBe(action);expect(bookingActivityLabel(action,'en')).toBe(action)})
beforeEach(()=>{
  vi.resetAllMocks();state.users=[];state.tokens=[];state.bookings=[{id:'b1',reference,userId:null,contactEmail:email,contactName:'Guest Customer',contactPhone:'+201234567890'}];state.activities=[{bookingId:'b1',action:'Checkout account consent accepted',createdAt:new Date()}];state.failLink=false
  let tail=Promise.resolve()
  db.$transaction.mockImplementation(async fn=>{const previous=tail;let release!:()=>void;tail=new Promise<void>(r=>{release=r});await previous;const snapshot=structuredClone(state);try{return await fn(db)}catch(e){Object.assign(state,snapshot);throw e}finally{release()}})
  db.booking.findUnique.mockImplementation(async({where})=>structuredClone(state.bookings.find(b=>b.reference===where.reference)??null))
  db.booking.updateMany.mockImplementation(async({where,data})=>{const b=state.bookings.find(b=>b.id===where.id&&b.userId===where.userId&&b.contactEmail===where.contactEmail);if(!b||state.failLink)return{count:0};Object.assign(b,data);return{count:1}})
  db.bookingActivity.findFirst.mockImplementation(async({where})=>state.activities.find(a=>a.bookingId===where.bookingId&&a.action===where.action&&(!where.createdAt||a.createdAt>=where.createdAt.gte))??null)
  db.bookingActivity.create.mockImplementation(async({data})=>{const row={...data,createdAt:new Date()};state.activities.push(row);return row})
  db.user.findUnique.mockImplementation(async({where})=>structuredClone(state.users.find(u=>where.id?u.id===where.id:u.emailNormalized===where.emailNormalized)??null))
  db.user.create.mockImplementation(async({data})=>{const user={...data,id:'u1',emailVerifiedAt:null,roles:[{assignedBy:data.roles.create.assignedBy,role:{key:'CUSTOMER'}}]};state.users.push(user);return structuredClone(user)})
  db.user.update.mockImplementation(async({where,data})=>{const u=state.users.find(u=>u.id===where.id)!;Object.assign(u,data);return structuredClone(u)})
  db.user.updateMany.mockImplementation(async({where,data})=>{
    const u=state.users.find(u=>u.id===where.id&&u.status===where.status&&u.passwordHash===where.passwordHash&&u.emailNormalized===where.emailNormalized)
    if(!u||!u.roles.length||u.roles.some((r:{role:{key:string}})=>r.role.key!=='CUSTOMER')||where.status==='PENDING'&&u.roles[0].assignedBy!=='checkout-registration')return{count:0}
    Object.assign(u,data);return{count:1}
  })
  db.accountSetupToken.create.mockImplementation(async({data})=>{const token={...data,id:`t${state.tokens.length}`,usedAt:null};state.tokens.push(token);return structuredClone(token)})
  db.accountSetupToken.findUnique.mockImplementation(async({where})=>structuredClone(state.tokens.find(t=>t.tokenHash===where.tokenHash)??null))
  db.accountSetupToken.updateMany.mockImplementation(async({where,data})=>{const token=state.tokens.find(t=>t.id===where.id&&t.usedAt===where.usedAt&&(!where.expiresAt||t.expiresAt>where.expiresAt.gt));if(!token)return{count:0};Object.assign(token,data);return{count:1}})
  shared.mail.mockResolvedValue({status:'SENT'});shared.hash.mockResolvedValue('new-password-hash');db.bookingAccessToken.updateMany.mockResolvedValue({count:1})
  shared.current.mockResolvedValue(null);shared.permission.mockReturnValue(true)
  db.user.findMany.mockImplementation(async()=>state.users.filter(u=>u.roles.some((r:{role:{key:string}})=>r.role.key==='CUSTOMER')).map(u=>({...u,createdAt:new Date(),lastName:u.lastName??null,lastLoginAt:null,username:null,countryCode:null,avatar:null,bookings:state.bookings.filter(b=>b.userId===u.id).map(b=>({...b,status:'PENDING',currency:'USD',total:620,createdAt:new Date(),_count:{items:2},payments:[]}))})))
  db.booking.findMany.mockImplementation(async({where})=>state.bookings.filter(b=>b.userId===where.userId).map(b=>({...b,createdAt:new Date(),status:'PENDING',currency:'USD',total:620,_count:{items:2},items:[{tourTitle:'Tour A'},{tourTitle:'Tour B'}],payments:[]})))
  shared.checkout.mockImplementation(async(_userId,_input,consent)=>{
    state.activities=consent?[{bookingId:'b1',action:'Checkout account consent accepted',createdAt:new Date()}]:[]
    return {created:true,reference,booking:{reference,total:620},guestAccessUrl:null}
  })
})
function emailedToken(){return new URLSearchParams(new URL(shared.mail.mock.calls[0][2].accountUrl).hash.slice(1)).get('token')!}
it('creates only an inactive passwordless customer and keeps the booking unlinked until email proof',async()=>{
  await prepareCheckoutAccount(reference,email)
  expect(state.users).toHaveLength(1);expect(state.users[0]).toMatchObject({status:'PENDING',passwordHash:null,lastName:null})
  expect(state.bookings[0].userId).toBeNull()
  const token=emailedToken();expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);expect(state.tokens[0].tokenHash).not.toBe(hashToken(token));expect(JSON.stringify(state.tokens)).not.toContain(token)
  expect(await inspectCheckoutAccount(reference,token)).toEqual({needsPassword:true,email})
  expect(await completeCheckoutAccount(reference,token,'SafePass123!',null)).toEqual({userId:'u1',newAccount:true})
  expect(state.bookings[0].userId).toBe('u1');expect(state.users[0]).toMatchObject({status:'ACTIVE',passwordHash:'new-password-hash'});expect(state.users[0].emailVerifiedAt).toBeInstanceOf(Date)
  expect(db.booking.updateMany.mock.calls[0][0].data).toEqual({userId:'u1'}) // no price, confirmation or payment mutation
  await expect(completeCheckoutAccount(reference,token,'SafePass123!',null)).rejects.toThrow(/invalid or expired/)
})
it('links only the specified booking for an existing account and never changes its password or identity',async()=>{
  state.users=[oldUser()];state.bookings.push({...state.bookings[0],id:'b2',reference:'SP-BK-XYZ789'})
  await prepareCheckoutAccount(reference,email);const token=emailedToken()
  expect(await completeCheckoutAccount(reference,token,'attempted-reset',null)).toEqual({userId:'u1',newAccount:false})
  expect(state.users[0]).toMatchObject({passwordHash:'existing-hash',firstName:'Existing',phone:'original-phone'})
  expect(state.bookings[1].userId).toBeNull();expect(shared.hash).not.toHaveBeenCalled();expect(db.user.create).not.toHaveBeenCalled()
})
it('coalesces concurrent duplicate requests without another user or email',async()=>{
  await Promise.all([prepareCheckoutAccount(reference,email),prepareCheckoutAccount(reference,email)])
  expect(state.users).toHaveLength(1);expect(state.tokens).toHaveLength(1);expect(shared.mail).toHaveBeenCalledTimes(1)
})
it.each(['expired','used','wrong-type','wrong-booking','changed-email'])('rejects %s proof without linking',async mode=>{
  await prepareCheckoutAccount(reference,email);const token=emailedToken()
  if(mode==='expired')state.tokens[0].expiresAt=new Date(0)
  if(mode==='used')state.tokens[0].usedAt=new Date()
  if(mode==='wrong-type')state.tokens[0].type='PASSWORD_RESET'
  if(mode==='changed-email')state.users[0].emailNormalized='changed@example.com'
  await expect(completeCheckoutAccount(mode==='wrong-booking'?'SP-BK-XYZ789':reference,token,'SafePass123!',null)).rejects.toThrow()
  expect(state.bookings[0].userId).toBeNull()
})
it.each(['staff','suspended','unrelated-pending'])('does not enroll or modify a %s account',async mode=>{
  const user=oldUser();if(mode==='staff')user.roles.push({assignedBy:'owner',role:{key:'ADMIN'}});if(mode==='suspended')user.status='SUSPENDED';if(mode==='unrelated-pending'){user.status='PENDING';user.passwordHash=null as unknown as string}state.users=[user]
  await prepareCheckoutAccount(reference,email);expect(state.tokens).toHaveLength(0);expect(shared.mail).not.toHaveBeenCalled();expect(db.user.update).not.toHaveBeenCalled()
})
it('does not enroll legacy guests or a mismatched recovery email',async()=>{
  state.activities=[];await prepareCheckoutAccount(reference,email);expect(state.users).toHaveLength(0)
  state.activities=[{bookingId:'b1',action:'Checkout account consent accepted',createdAt:new Date()}];await prepareCheckoutAccount(reference,'other@example.com');expect(state.users).toHaveLength(0)
})
it('revokes an undelivered setup token without changing the saved booking',async()=>{
  shared.mail.mockResolvedValue({status:'FAILED'});await prepareCheckoutAccount(reference,email)
  expect(state.tokens[0].usedAt).toBeInstanceOf(Date);expect(state.bookings[0].userId).toBeNull();expect(state.users[0].status).toBe('PENDING')
})
it('rolls back token consumption and account activation if linking fails',async()=>{
  await prepareCheckoutAccount(reference,email);const token=emailedToken();state.failLink=true
  await expect(completeCheckoutAccount(reference,token,'SafePass123!',null)).rejects.toThrow()
  expect(state.tokens[0].usedAt).toBeNull();expect(state.users[0].status).toBe('PENDING');expect(state.bookings[0].userId).toBeNull()
})
it('rejects a different signed-in identity and weak passwords',async()=>{
  await prepareCheckoutAccount(reference,email);const token=emailedToken()
  await expect(completeCheckoutAccount(reference,token,'SafePass123!','other-user')).rejects.toThrow(/Sign out/)
  await expect(completeCheckoutAccount(reference,token,'x',null)).rejects.toThrow(/Password/)
  expect(state.tokens[0].usedAt).toBeNull()
})
it('allows exactly one of two simultaneous confirmation submissions to consume the token',async()=>{
  await prepareCheckoutAccount(reference,email);const token=emailedToken()
  const result=await Promise.allSettled([completeCheckoutAccount(reference,token,'SafePass123!',null),completeCheckoutAccount(reference,token,'SafePass123!',null)])
  expect(result.filter(row=>row.status==='fulfilled')).toHaveLength(1)
  expect(state.activities.filter(a=>a.action==='Booking linked after email verification')).toHaveLength(1)
})
it('recovers a concurrent unique-email winner without creating a duplicate account',async()=>{
  const find=db.user.findUnique.getMockImplementation()!
  let winnerCommitted=false
  db.user.create.mockImplementationOnce(async()=>{winnerCommitted=true;throw new Prisma.PrismaClientKnownRequestError('email race',{code:'P2002',clientVersion:'test'})})
  db.user.findUnique.mockImplementation(async args=>{
    if(winnerCommitted&&!state.users.length) state.users.push({...oldUser(),status:'PENDING',passwordHash:null,roles:[{assignedBy:'checkout-registration',role:{key:'CUSTOMER'}}]})
    return find(args)
  })
  await prepareCheckoutAccount(reference,email)
  expect(state.users).toHaveLength(1);expect(state.tokens).toHaveLength(1);expect(shared.mail).toHaveBeenCalledTimes(1)
  expect(db.user.create).toHaveBeenCalledTimes(1)
})
it('fails closed if the stored email and normalized identity disagree',async()=>{
  state.users=[{...oldUser(),email:'different@example.com'}]
  await prepareCheckoutAccount(reference,email)
  expect(state.tokens).toHaveLength(0);expect(shared.mail).not.toHaveBeenCalled()
})
it('requires exact normalized identity even if a database collation returns a nearby match',async()=>{
  db.user.findUnique.mockResolvedValue({...oldUser(),email:'neighbor@example.com',emailNormalized:'neighbor@example.com'})
  await prepareCheckoutAccount(reference,email)
  expect(state.tokens).toHaveLength(0);expect(shared.mail).not.toHaveBeenCalled()
})
it('uses statement-current reads during the locked account-linking transaction',async()=>{
  await prepareCheckoutAccount(reference,email)
  const raw=emailedToken()
  await completeCheckoutAccount(reference,raw,'a-secure-password',null)
  expect(db.$transaction.mock.lastCall?.[1]).toEqual({isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted})
})
it.each(['activated','suspended','staff'])('rejects a stale authorization snapshot after the user becomes %s',async change=>{
  await prepareCheckoutAccount(reference,email);const raw=emailedToken(),stale=structuredClone(state.users[0])
  if(change==='activated'){state.users[0].status='ACTIVE';state.users[0].passwordHash='already-chosen-password'}
  if(change==='suspended')state.users[0].status='SUSPENDED'
  if(change==='staff')state.users[0].roles.push({assignedBy:'owner',role:{key:'ADMIN'}})
  db.user.findUnique.mockResolvedValue(stale) // model a repeatable-read snapshot, not the current committed row
  await expect(completeCheckoutAccount(reference,raw,'different-password',null)).rejects.toThrow()
  expect(state.bookings[0].userId).toBeNull();expect(state.tokens[0].usedAt).toBeNull()
  if(change==='activated')expect(state.users[0].passwordHash).toBe('already-chosen-password')
})

const checkoutRequest=()=>new Request('https://starpyramids.com/api/bookings',{method:'POST',headers:{origin:'https://starpyramids.com','content-type':'application/json'},body:JSON.stringify({acceptedTerms:true,contact:{name:'Guest Customer',email,phone:'+201234567890'}})})
async function directoryAfterCheckout() {
  shared.current.mockResolvedValue({id:'staff-id',publicId:'staff',roles:['SUPER_ADMIN'],permissions:[]})
  const response=await customersGET()
  expect(response.status).toBe(200)
  return response.json()
}
it('composes checkout, real enrollment and CRM reads: new consented guest appears as PENDING without booking ownership',async()=>{
  state.activities=[]
  const response=await checkoutPOST(checkoutRequest())
  expect(response.status).toBe(201)
  expect(shared.checkout.mock.calls[0][2]).toBe(true)
  expect(state.users).toHaveLength(1);expect(state.users[0]).toMatchObject({status:'PENDING',passwordHash:null})
  expect(shared.mail.mock.calls[0][0]).toBe('booking_account_access');expect(shared.mail.mock.calls[0][1]).toBe(email)
  const directory=await directoryAfterCheckout()
  expect(directory.customers).toHaveLength(1);expect(directory.customers[0]).toMatchObject({status:'PENDING',bookingsCount:0})
  expect(directory.guestContacts).toHaveLength(1);expect(directory.guestContacts[0]).toMatchObject({reference,tripsCount:2})
  expect(state.bookings[0].userId).toBeNull();expect(db.user.updateMany).not.toHaveBeenCalled()
})
it('a failed account email still leaves the PENDING customer visible and booking intact',async()=>{
  shared.mail.mockResolvedValue({status:'FAILED'})
  expect((await checkoutPOST(checkoutRequest())).status).toBe(201)
  const directory=await directoryAfterCheckout()
  expect(directory.customers[0].status).toBe('PENDING');expect(directory.guestContacts).toHaveLength(1)
  expect(state.tokens[0].usedAt).toBeInstanceOf(Date);expect(state.bookings[0].userId).toBeNull()
})
it('verified activation moves only this booking from guest CRM to the actual customer relationship',async()=>{
  expect((await checkoutPOST(checkoutRequest())).status).toBe(201)
  const token=emailedToken()
  await completeCheckoutAccount(reference,token,'SafePass123!',null)
  const directory=await directoryAfterCheckout()
  expect(directory.customers[0]).toMatchObject({status:'ACTIVE',bookingsCount:1,tripsCount:2})
  expect(directory.guestContacts).toEqual([])
  expect(state.bookings[0].userId).toBe(state.users[0].id)
})
it('records provisioning failure for staff without rolling back the booking or leaking the thrown diagnostic',async()=>{
  db.user.create.mockRejectedValue(new Error('private SQL host and bearer token'))
  const response=await checkoutPOST(checkoutRequest()),body=await response.json()
  expect(response.status).toBe(201);expect(body.reference).toBe(reference)
  expect(state.users).toHaveLength(0);expect(state.bookings).toHaveLength(1)
  const event=state.activities.find(a=>a.action==='Checkout account setup needs recovery')
  expect(event).toMatchObject({isInternal:true,actorRole:'system',booking:{connect:{reference}}})
  expect(JSON.stringify({body,event})).not.toMatch(/private SQL|bearer token/)
  expect(shared.mail).not.toHaveBeenCalled()
})
it('keeps the failure audit private, read-only for identities, and safe even if its storage fails',async()=>{
  db.bookingActivity.create.mockRejectedValue(new Error('private credential'))
  const log=vi.spyOn(console,'error').mockImplementation(()=>undefined)
  try {
    await expect(recordCheckoutAccountPreparationFailure(reference)).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith('[checkout-account] preparation_failed',{reference})
    expect(JSON.stringify(log.mock.calls)).not.toContain('private credential')
    expect(db.user.create).not.toHaveBeenCalled();expect(db.booking.updateMany).not.toHaveBeenCalled()
  } finally {log.mockRestore()}
})
