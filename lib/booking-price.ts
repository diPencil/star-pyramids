import type { Tour } from '@/data/types'
import { dayTourTerms, getBookingTotal, getTravelerUnitPrices } from '@/data/tours'
import { bookingAddonCatalog, bookingAddons, bookingCents, bookingSelectionKey } from './booking-selection'
import {MAX_BOOKING_AMOUNT_CENTS} from './booking-selection'

export type PriceSelection = {tourSlug:string;date:string;adults:number;children:number;infants:number;addons:readonly string[]}
export type BookingPriceLine = {
  selection:string; title:string; base:number; units:number[]; originalUnits:number[];
  extras:{title:string;cents:number|null}[]; deal:{percent:number;endsAt:string}|null;
  original:number; discount:number; total:number;
}
export type BookingPriceSnapshot = {currency:'USD';lines:BookingPriceLine[];subtotal:number;discount:number;total:number}

/** One cents-only projection for displayed acceptance and server comparison. */
export function bookingPriceLine(tour:Tour, selection:PriceSelection, now:Date = new Date()):BookingPriceLine {
  const catalog=bookingAddonCatalog(tour,dayTourTerms.addOns)
  const extras=bookingAddons(catalog,selection.addons)
  if(extras.unavailable.length) throw Error('A selected extra is no longer available. Remove it from your cart and try again.')
  const units=getBookingTotal(tour,selection.adults,selection.children,selection.infants,now)
  const original=getTravelerUnitPrices(tour,selection.adults+selection.children+selection.infants)
  const charged=[units.adult,units.child,units.infant].map(bookingCents)
  const list=[original.adult,original.child,original.infant].map(bookingCents)
  const counts=[selection.adults,selection.children,selection.infants]
  const total=charged.reduce((sum,unit,i)=>sum+unit*counts[i],extras.cents)
  const before=list.reduce((sum,unit,i)=>sum+unit*counts[i],extras.cents)
  return {selection:bookingSelectionKey({...selection,tourSlug:tour.slug}),title:tour.title,
    base:bookingCents(tour.price),units:charged,originalUnits:list,
    extras:[...new Set(selection.addons)].sort().map(title=>({title,cents:catalog.find(row=>row.title===title)!.price===undefined?null:bookingCents(catalog.find(row=>row.title===title)!.price!)})),
    deal:tour.deal?{percent:tour.deal.percent,endsAt:tour.deal.endsAt}:null,
    original:before,discount:Math.max(0,before-total),total}
}
export function bookingPriceSnapshot(lines:BookingPriceLine[]):BookingPriceSnapshot {
  const sorted=[...lines].sort((a,b)=>a.selection<b.selection?-1:a.selection>b.selection?1:0)
  return {currency:'USD',lines:sorted,subtotal:sorted.reduce((n,l)=>n+l.original,0),discount:sorted.reduce((n,l)=>n+l.discount,0),total:sorted.reduce((n,l)=>n+l.total,0)}
}
/** Display titles are not commercial authority and may be translated. */
export function financialSnapshot(snapshot:BookingPriceSnapshot) {
  return {...snapshot,lines:snapshot.lines.map(({title:_,...line})=>line)}
}

export function parseAcceptedPrice(value:unknown):BookingPriceSnapshot {
  const invalid=()=>{throw Error('Invalid price snapshot. Review your cart and try again.')}
  const money=(v:unknown):number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=MAX_BOOKING_AMOUNT_CENTS?v:invalid()
  if(!value||typeof value!=='object'||Array.isArray(value))return invalid()
  const snapshot=value as Record<string,unknown>
  if(snapshot.currency!=='USD'||!Array.isArray(snapshot.lines)||!snapshot.lines.length||snapshot.lines.length>20)return invalid()
  const lines=snapshot.lines.map((raw:unknown):BookingPriceLine=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return invalid()
    const line=raw as Record<string,unknown>
    if(typeof line.selection!=='string'||line.selection.length>4096||!Array.isArray(line.units)||line.units.length!==3||!Array.isArray(line.originalUnits)||line.originalUnits.length!==3||!Array.isArray(line.extras)||line.extras.length>20)return invalid()
    const extras=line.extras.map((raw:unknown)=>{
      if(!raw||typeof raw!=='object')return invalid()
      const extra=raw as Record<string,unknown>
      if(typeof extra.title!=='string'||extra.title.length>120)return invalid()
      return {title:extra.title,cents:extra.cents===null?null:money(extra.cents)}
    }).sort((a,b)=>a.title<b.title?-1:a.title>b.title?1:0)
    let deal:BookingPriceLine['deal']=null
    if(line.deal!==null){
      if(!line.deal||typeof line.deal!=='object')return invalid()
      const d=line.deal as Record<string,unknown>
      if(typeof d.percent!=='number'||!Number.isFinite(d.percent)||d.percent<0||d.percent>100||typeof d.endsAt!=='string'||d.endsAt.length>100)return invalid()
      deal={percent:d.percent,endsAt:d.endsAt}
    }
    return {selection:line.selection,title:'',base:money(line.base),units:line.units.map(money),originalUnits:line.originalUnits.map(money),extras,deal,original:money(line.original),discount:money(line.discount),total:money(line.total)}
  }).sort((a,b)=>a.selection<b.selection?-1:a.selection>b.selection?1:0)
  return {currency:'USD',lines,subtotal:money(snapshot.subtotal),discount:money(snapshot.discount),total:money(snapshot.total)}
}
