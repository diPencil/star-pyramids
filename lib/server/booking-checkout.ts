import 'server-only'
import {Prisma} from '@prisma/client'
import {db} from './db'
import {createBookingRecord,findCheckoutReplay,validateBookingDraft} from './bookings'
import {findTourBySlug} from './tours'
import {assertAcceptedPrice,requestDigest} from './booking-quote'
import {normalizeEmail,normalizePhone} from '../core/validation'
import {validBookingTravelers} from '../booking-selection'
import type { BookingMeasurementGrants } from '../booking-measurement'

/** Stable request identity requires no live catalogue, so committed retries
 * remain recoverable after repricing, deletion or expiry of a price quote. */
export function checkoutRequestIdentity(input:unknown,acceptedTerms:boolean) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid request.')
  const body=input as Record<string,unknown>
  if(Object.keys(body).some(k=>!['lines','contact','notes','currency','idempotencyKey'].includes(k)))throw Error('Invalid request.')
  if(typeof body.idempotencyKey!=='string'||!/^[A-Za-z0-9-]{8,64}$/.test(body.idempotencyKey)||body.currency!==undefined&&body.currency!=='USD')throw Error('Invalid request.')
  if(!Array.isArray(body.lines)||!body.lines.length||body.lines.length>20)throw Error('Your cart is empty or too large.')
  const lines=body.lines.map(raw=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid booking items.')
    const line=raw as Record<string,unknown>
    if(Object.keys(line).some(k=>!['tourSlug','date','adults','children','infants','addons'].includes(k))||typeof line.tourSlug!=='string'||!/^[a-z0-9][a-z0-9-]{0,119}$/.test(line.tourSlug))throw Error('Invalid booking items.')
    const date=line.date??'',children=line.children??0,infants=line.infants??0
    if(typeof date!=='string'||date.length>10||!validBookingTravelers(line.adults as number,children as number,infants as number))throw Error('Invalid booking items.')
    const addons=line.addons??[]
    if(!Array.isArray(addons)||addons.length>20||addons.some(x=>typeof x!=='string'||!x.trim()||x.length>120||/[\x00-\x1f\x7f]/.test(x)))throw Error('Invalid add-ons.')
    return {tourSlug:line.tourSlug,date,adults:line.adults,children,infants,addons:[...new Set(addons.map(x=>(x as string).trim()))].sort()}
  }).sort((a,b)=>{const left=JSON.stringify(a),right=JSON.stringify(b);return left<right?-1:left>right?1:0})
  if(!body.contact||typeof body.contact!=='object'||Array.isArray(body.contact))throw Error('Enter your contact details.')
  const contact=body.contact as Record<string,unknown>
  if(Object.keys(contact).some(k=>!['name','email','phone'].includes(k))||['name','email','phone'].some(k=>typeof contact[k]!=='string'||(contact[k] as string).length>200))throw Error('Invalid request.')
  if(body.notes!==undefined&&(typeof body.notes!=='string'||body.notes.length>1000||/[\x00-\x1f\x7f]/.test(body.notes)))throw Error('Invalid request.')
  const identity={lines,contact:{name:(contact.name as string).trim(),email:normalizeEmail(contact.email as string),phone:normalizePhone(contact.phone as string)},notes:typeof body.notes==='string'?body.notes:'',currency:'USD',acceptedTerms}
  return {key:body.idempotencyKey,fingerprint:requestDigest(identity),identity}
}

class ReplayWon extends Error {}
export async function createCheckoutBooking(userId:string|null,input:unknown,acceptedTerms:boolean,acceptedPrice:unknown,quote?:string,recoverOnly=false,measurement?:BookingMeasurementGrants) {
  const {key,fingerprint,identity}=checkoutRequestIdentity(input,acceptedTerms)
  const replay=await findCheckoutReplay(userId,key,fingerprint,db,identity,measurement)
  if(replay)return replay
  if(recoverOnly)throw Error('No completed booking request was found. Review your cart before sending a new request.')
  if(!userId&&!acceptedTerms)throw Error('You must accept the Terms and Privacy Policy.')
  try {
    const draft=await validateBookingDraft(input)
    draft.accountConsent=userId===null&&acceptedTerms
    const quoteIntent=requestDigest({fingerprint,key,userId})
    assertAcceptedPrice(quoteIntent,draft.priceSnapshot!,acceptedPrice,quote)
    const slugs=[...new Set(draft.lines.map(line=>line.tourSlug))].sort()
    const result=await createBookingRecord(userId,draft,{fingerprint,measurement,persist:data=>db.$transaction(async tx=>{
      // Deterministic order; lock only selected tours and their existing offers.
      // SMTP, hashing and enrollment are deliberately outside this transaction.
      await tx.$queryRaw(Prisma.sql`SELECT slug FROM tours WHERE slug IN (${Prisma.join(slugs)}) ORDER BY slug FOR UPDATE`)
      await tx.$queryRaw(Prisma.sql`SELECT id FROM offers WHERE tourSlug IN (${Prisma.join(slugs)}) ORDER BY id FOR UPDATE`)
      if(await findCheckoutReplay(userId,key,fingerprint,tx))throw new ReplayWon()
      const fresh=await validateBookingDraft(input,slug=>findTourBySlug(slug,tx))
      if(fresh.lines.some(line=>!slugs.includes(line.tourSlug)))throw Error('One of the selected tours is no longer available. Remove it and try again.')
      assertAcceptedPrice(quoteIntent,fresh.priceSnapshot!,acceptedPrice,quote)
      return tx.booking.create({data,include:{items:true,activities:true,payments:{select:{status:true,amountPaid:true,amountRefunded:true,reference:true,createdAt:true,currency:true}},user:{select:{email:true,firstName:true,lastName:true}}}})
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted,maxWait:5000,timeout:10000})})
    if(!result.created){
      const existing=await findCheckoutReplay(userId,key,fingerprint,db,identity,measurement)
      if(!existing)throw Error('Unable to process your booking right now. Please try again.')
      return existing
    }
    return {...result,reference:result.booking.reference}
  }catch(error){
    // The winner is checked even if publication/price changed while waiting.
    // Fingerprint/ownership verification still happens before any acknowledgement.
    const winner=await findCheckoutReplay(userId,key,fingerprint,db,identity,measurement)
    if(winner)return winner
    throw error
  }
}
