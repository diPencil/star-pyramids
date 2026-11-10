import 'server-only'
import { Prisma } from '@prisma/client'
import { db } from '../../db'
import { generateOpaqueToken, hashToken } from '../../../core/tokens'
import { hashPassword } from '../../../core/password'
import { normalizeEmail, validatePasswordStrength } from '../../../core/validation'
import { sendCustomerEmailSafe } from '../../email/email'
import { resolveSiteUrl } from '../../../seo/seo'

const ACTION = 'Checkout account email requested'
const TTL = 60 * 60 * 1000
const DENIED = 'This account link is invalid or expired. Request a new link from your booking receipt.'
const binding = (reference: string, raw: string) => hashToken(`checkout-account:v1:${reference}:${raw}`)
type Account = {id:string;email:string;emailNormalized:string;status:string;passwordHash:string|null;roles:{assignedBy:string|null;role:{key:string}}[]}
function eligible(user: Account) {
  const customerOnly = user.roles.length === 1 && user.roles[0].role.key === 'CUSTOMER'
  return normalizeEmail(user.email) === user.emailNormalized && customerOnly && (user.status === 'ACTIVE' || user.status === 'PENDING' && user.passwordHash === null && user.roles[0].assignedBy === 'checkout-registration')
}

/** Best-effort staff evidence only; never store the thrown error or credentials. */
export async function recordCheckoutAccountPreparationFailure(reference: string): Promise<void> {
  try {
    await db.bookingActivity.create({data:{
      booking:{connect:{reference}},actorRole:'system',isInternal:true,
      action:'Checkout account setup needs recovery',
      note:'Account preparation did not complete. Check consent and email delivery history before using the existing verified recovery flow.',
    }})
  } catch {
    // A committed booking must still succeed if its audit store is unavailable.
    console.error('[checkout-account] preparation_failed', {reference})
  }
}

/** Called only for an explicitly consented guest booking or its matching recovery email. */
export async function prepareCheckoutAccount(reference: string, email: string): Promise<void> {
  for (let attempt=0; attempt<3; attempt++) {
    try {
      const issued=await db.$transaction(async tx=>{
        await tx.$queryRaw`SELECT reference FROM bookings WHERE reference = ${reference} FOR UPDATE`
        const booking=await tx.booking.findUnique({where:{reference}})
        if(!booking || booking.userId!==null || normalizeEmail(booking.contactEmail)!==normalizeEmail(email)) return null
        const consent=await tx.bookingActivity.findFirst({where:{bookingId:booking.id,action:'Checkout account consent accepted'}})
        if(!consent) return null // legacy guest records are not silently enrolled
        const recent=await tx.bookingActivity.findFirst({where:{bookingId:booking.id,action:ACTION,createdAt:{gte:new Date(Date.now()-60_000)}}})
        if(recent) return null
        let user=await tx.user.findUnique({where:{emailNormalized:normalizeEmail(booking.contactEmail)},include:{roles:{include:{role:true}}}})
        if(!user) user=await tx.user.create({data:{email:booking.contactEmail,emailNormalized:normalizeEmail(booking.contactEmail),firstName:booking.contactName,lastName:null,phone:booking.contactPhone,status:'PENDING',passwordHash:null,roles:{create:{assignedBy:'checkout-registration',role:{connect:{key:'CUSTOMER'}}}}},include:{roles:{include:{role:true}}}})
        if(!eligible(user) || user.emailNormalized!==normalizeEmail(booking.contactEmail)) return null
        const raw=generateOpaqueToken(32)
        const token=await tx.accountSetupToken.create({data:{userId:user.id,type:'PASSWORD_SETUP',tokenHash:binding(reference,raw),expiresAt:new Date(Date.now()+TTL)}})
        await tx.bookingActivity.create({data:{bookingId:booking.id,actorRole:'system',action:ACTION}})
        return {raw,token,email:user.email}
      })
      if(!issued) return
      const url=`${resolveSiteUrl()}/booking-account#reference=${encodeURIComponent(reference)}&token=${encodeURIComponent(issued.raw)}`
      const delivery=await sendCustomerEmailSafe('booking_account_access',issued.email,{accountUrl:url,reference},{relatedReference:reference,idempotencyKey:`booking-account:${issued.token.id}`}).catch(()=>null)
      if(delivery?.status!=='SENT') await db.accountSetupToken.updateMany({where:{id:issued.token.id,usedAt:null},data:{usedAt:new Date()}})
      return
    } catch(error) {
      // Simultaneous different bookings for one new email: the unique user
      // constraint wins; retry lookup, never insert a second account.
      if(error instanceof Prisma.PrismaClientKnownRequestError && error.code==='P2002' && attempt<2) continue
      throw error
    }
  }
}

async function checked(tx: Prisma.TransactionClient, reference:string, raw:string) {
  if(!/^[A-Za-z0-9_-]{43}$/.test(raw)) throw Error(DENIED)
  const token=await tx.accountSetupToken.findUnique({where:{tokenHash:binding(reference,raw)}})
  if(!token || token.type!=='PASSWORD_SETUP' || token.usedAt || token.expiresAt.getTime()<=Date.now()) throw Error(DENIED)
  const user=await tx.user.findUnique({where:{id:token.userId},include:{roles:{include:{role:true}}}})
  const booking=await tx.booking.findUnique({where:{reference}})
  if(!user || !eligible(user) || !booking || booking.userId!==null || user.emailNormalized!==normalizeEmail(booking.contactEmail)) throw Error(DENIED)
  return {token,user,booking}
}

export async function inspectCheckoutAccount(reference:string,raw:string) {
  const {user}=await checked(db,reference,raw)
  return {needsPassword:user.status==='PENDING',email:user.email}
}

export async function completeCheckoutAccount(reference:string,raw:string,password:string,currentUserId:string|null) {
  const initial=await checked(db,reference,raw)
  if(currentUserId && currentUserId!==initial.user.id) throw Error('Sign out before using this account link.')
  const newAccount=initial.user.status==='PENDING'
  if(newAccount) {const error=validatePasswordStrength(password);if(error) throw Error(error)}
  const passwordHash=newAccount ? await hashPassword(password) : null
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT reference FROM bookings WHERE reference = ${reference} FOR UPDATE`
    const {token,user,booking}=await checked(tx,reference,raw)
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`
    const fresh=await tx.user.findUnique({where:{id:user.id},include:{roles:{include:{role:true}}}})
    if(!fresh || !eligible(fresh) || (fresh.status==='PENDING')!==newAccount || fresh.emailNormalized!==user.emailNormalized) throw Error(DENIED)
    const consumed=await tx.accountSetupToken.updateMany({where:{id:token.id,usedAt:null,expiresAt:{gt:new Date()}},data:{usedAt:new Date()}})
    if(consumed.count!==1) throw Error(DENIED)
    // Reads may have observed a snapshot before another booking activated this
    // user. Authorize again in the conditional write, not just by primary key.
    const updated=await tx.user.updateMany({
      where:{
        id:user.id,
        emailNormalized:user.emailNormalized,
        status:newAccount?'PENDING':'ACTIVE',
        passwordHash:newAccount?null:fresh.passwordHash,
        roles:{
          every:{role:{key:'CUSTOMER'}},
          some:{role:{key:'CUSTOMER'},...(newAccount?{assignedBy:'checkout-registration'}:{})},
        },
      },
      data:{...(newAccount ? {status:'ACTIVE',passwordHash} : {}),emailVerifiedAt:fresh.emailVerifiedAt??new Date()},
    })
    if(updated.count!==1) throw Error(DENIED)
    const linked=await tx.booking.updateMany({where:{id:booking.id,userId:null,contactEmail:booking.contactEmail},data:{userId:user.id}})
    if(linked.count!==1) throw Error(DENIED)
    await tx.bookingAccessToken.updateMany({where:{bookingRef:reference,revokedAt:null},data:{revokedAt:new Date()}})
    await tx.bookingActivity.create({data:{bookingId:booking.id,actorRole:'customer',action:'Booking linked after email verification'}})
    return {userId:user.id,newAccount}
  },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted})
}
