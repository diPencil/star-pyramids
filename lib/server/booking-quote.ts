import 'server-only'
import {createHash,createHmac,timingSafeEqual} from 'node:crypto'
import {financialSnapshot,parseAcceptedPrice,type BookingPriceSnapshot} from '../booking-price'

export const QUOTE_TTL_MS=10*60*1000
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const priceDigest=(price:BookingPriceSnapshot)=>digest(financialSnapshot(price))
export const requestDigest=(value:unknown)=>digest(value)
function secret(){
  const value=process.env.BOOKING_QUOTE_SECRET
  if(!value||Buffer.byteLength(value)<32) throw new QuoteServiceError()
  return value
}
export class QuoteServiceError extends Error {constructor(){super('Price confirmation is temporarily unavailable. Please try again later.')}}
export class TourUnavailable extends Error {constructor(public slug:string){super('One of the selected tours is no longer available. Remove it and try again.')}}
export class PriceChanged extends Error {
  constructor(public price:BookingPriceSnapshot,public quote:string){super('Prices have changed. Review and accept the updated price.')}
}
export function issuePriceQuote(intent:string,price:BookingPriceSnapshot,now=Date.now()) {
  const payload=Buffer.from(JSON.stringify({v:1,intent,price:priceDigest(price),expires:now+QUOTE_TTL_MS})).toString('base64url')
  return `${payload}.${createHmac('sha256',secret()).update(payload).digest('base64url')}`
}
export function verifyPriceQuote(token:string,intent:string,price:BookingPriceSnapshot,now=Date.now()):'valid'|'refresh' {
  if(token.length>1024) throw Error('Invalid price confirmation. Review your cart and try again.')
  const [payload,sig,extra]=token.split('.')
  if(!payload||!sig||extra||!/^[A-Za-z0-9_-]+$/.test(payload)||!/^[A-Za-z0-9_-]{43}$/.test(sig)) throw Error('Invalid price confirmation. Review your cart and try again.')
  const expected=createHmac('sha256',secret()).update(payload).digest('base64url')
  if(!timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) throw Error('Invalid price confirmation. Review your cart and try again.')
  let data:Record<string,unknown>
  try {data=JSON.parse(Buffer.from(payload,'base64url').toString())}catch{throw Error('Invalid price confirmation. Review your cart and try again.')}
  if(data.v!==1||data.intent!==intent||typeof data.expires!=='number'||data.expires>now+QUOTE_TTL_MS) throw Error('Invalid price confirmation. Review your cart and try again.')
  return data.expires<=now||data.price!==priceDigest(price)?'refresh':'valid'
}

export function assertAcceptedPrice(intent:string,current:BookingPriceSnapshot,accepted:unknown,quote?:string) {
  if(quote!==undefined){if(verifyPriceQuote(quote,intent,current)==='valid')return}
  else if(accepted&&JSON.stringify(financialSnapshot(current))===JSON.stringify(financialSnapshot(parseAcceptedPrice(accepted))))return
  throw new PriceChanged(current,issuePriceQuote(intent,current))
}
