import 'server-only'
import {isIP} from 'node:net'
import {checkBookingRateLimit,recordBookingAttempt,checkResetSubmitRateLimit,recordPasswordResetAttempt} from '../rate-limit'

/** Opt in only where the edge overwrites (not appends arbitrary client) headers. */
export function bookingClientIp(request:Request) {
  if(process.env.BOOKING_TRUST_PROXY_HEADERS!=='1')return 'unknown'
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??''
  return ip.length<=64&&isIP(ip)?ip:'unknown'
}
export function bookingSameOrigin(request:Request) {
  const trusted=process.env.BOOKING_TRUST_PROXY_HEADERS==='1'
  const requestUrl=new URL(request.url)
  const host=(trusted?request.headers.get('x-forwarded-host'):null)??request.headers.get('host')??requestUrl.host
  const forwardedProtocol=trusted?request.headers.get('x-forwarded-proto'):null
  const protocol=forwardedProtocol==='https'||forwardedProtocol==='http'?forwardedProtocol+':':requestUrl.protocol
  const origin=request.headers.get('origin')??request.headers.get('referer')
  try{const url=new URL(origin??'');return url.host===host&&url.protocol===protocol&&!url.username&&!url.password}catch{return false}
}

type Limit={allowed:boolean;retryAfterSeconds?:number}
const queues=new Map<string,{tail:Promise<void>;waiting:number}>()
/** Closes the demonstrated same-process check/record race without claiming a
 * distributed quota. Bounded queue, released before hashing, SMTP or booking. */
async function reserve(name:string,work:()=>Promise<Limit>):Promise<Limit> {
  const queue=queues.get(name)??{tail:Promise.resolve(),waiting:0}
  if(queue.waiting>=32)return {allowed:false}
  queues.set(name,queue);queue.waiting++
  const previous=queue.tail
  let release!:()=>void
  queue.tail=new Promise<void>(done=>{release=done})
  await previous
  try{return await work()}finally{queue.waiting--;release();if(!queue.waiting)queues.delete(name)}
}
export const reserveBookingAttempt=(email:string,ip:string)=>reserve('booking',async()=>{
  const limit=await checkBookingRateLimit(email,ip)
  if(limit.allowed)await recordBookingAttempt(email,ip)
  return limit
})
export const reserveSetupAttempt=(ip:string,complete:boolean)=>reserve('setup',async()=>{
  const limit=await checkResetSubmitRateLimit(ip)
  if(limit.allowed&&complete)await recordPasswordResetAttempt('checkout-account',ip)
  return limit
})
