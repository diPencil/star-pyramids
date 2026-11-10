import { NextResponse } from 'next/server'
import {bookingSameOrigin,bookingClientIp,reserveSetupAttempt} from '@/lib/server/booking/booking-request-security'
import { readBoundedJson } from '@/lib/server/request-json'
import { inspectCheckoutAccount, completeCheckoutAccount } from '@/lib/server/booking/checkout/checkout-account'
import { recordPasswordResetAttempt } from '@/lib/server/rate-limit'
import { getCurrentUser } from '@/lib/server/auth/auth'
import { createSession } from '@/lib/server/auth/session'
import { OFFICIAL_BOOKING_REF_PATTERN } from '@/lib/booking/booking'
import {validatePasswordStrength} from '@/lib/core/validation'

export async function POST(request:Request) {
  const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})
  if(!bookingSameOrigin(request)) return reply({error:'Forbidden.'},403)
  let input:Record<string,unknown>
  try {const body=await readBoundedJson(request,4096);if(!body||typeof body!=='object'||Array.isArray(body)) throw Error();input=body as Record<string,unknown>}
  catch{return reply({error:'Invalid request.'},400)}
  if(Object.keys(input).some(key=>!['reference','token','mode','password','confirmPassword'].includes(key)) || typeof input.reference!=='string'||!OFFICIAL_BOOKING_REF_PATTERN.test(input.reference)||typeof input.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(input.token)||typeof input.mode!=='string'||!['inspect','complete'].includes(input.mode)) return reply({error:'Invalid request.'},400)
  const ip=bookingClientIp(request)
  let limit
  try {limit=await reserveSetupAttempt(ip,input.mode==='complete')}catch{return reply({code:'SERVICE_UNAVAILABLE'},503)}
  if(!limit.allowed) {
    const res=reply({code:'RATE_LIMITED',error:'Too many attempts. Please try again later.'},429)
    if(typeof limit.retryAfterSeconds==='number'&&Number.isFinite(limit.retryAfterSeconds)&&limit.retryAfterSeconds>0)res.headers.set('Retry-After',String(Math.ceil(limit.retryAfterSeconds)))
    return res
  }
  const counted=input.mode==='complete'
  try {
    const info=await inspectCheckoutAccount(input.reference,input.token)
    const current=await getCurrentUser()
    if(input.mode==='inspect') return reply(info)
    if(info.needsPassword && (typeof input.password!=='string'||input.password!==input.confirmPassword||validatePasswordStrength(input.password))) return reply({code:'PASSWORD_INVALID'},400)
    const result=await completeCheckoutAccount(input.reference,input.token,typeof input.password==='string'?input.password:'',current?.id??null)
    let signedIn=current?.id===result.userId
    let sessionRecovery=false
    if(result.newAccount) {
      try {await createSession(result.userId,{ipAddress:ip,userAgent:request.headers.get('user-agent')??undefined});signedIn=true}
      catch {signedIn=false;sessionRecovery=true} // account + booking committed; normal login recovers
    }
    return reply({success:true,redirectTo:signedIn?'/account':'/login?next=%2Faccount',...(sessionRecovery?{sessionRecovery:true}:{})})
  } catch(error) {
    if(!counted) await recordPasswordResetAttempt('checkout-account',ip).catch(()=>undefined)
    if(error instanceof Error&&error.message==='Sign out before using this account link.')return reply({code:'ACCOUNT_MISMATCH'},409)
    if(error instanceof Error&&error.message==='This account link is invalid or expired. Request a new link from your booking receipt.')return reply({code:'INVALID_LINK'},400)
    return reply({code:'SERVICE_UNAVAILABLE'},503)
  }
}
