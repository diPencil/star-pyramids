import 'server-only';
import { createHash } from 'node:crypto';
import { parseBookingFunnelEvent, type BookingMeasurementGrants, type BookingMeasurementReceipt } from '../../tracking/leads/booking-measurement';
import { Prisma } from '@prisma/client';
import { db } from '../db';
import { readJsonText } from '../../json-text';
import { bookingRequestNotes } from '@/lib/booking/booking-selection';
import { rowInclude, toCustomerView, type BookingRow } from './booking-read-models';
export const ATTEMPT_ACTION='Checkout attempt fingerprint v1';
export type CheckoutWriteOptions={fingerprint:string;measurement?:BookingMeasurementGrants;persist?:(data:Prisma.BookingUncheckedCreateInput)=>Promise<BookingRow>};
type BookingConsentProof = { analytics: string; marketing?: string };
type LegacyCheckoutIdentity={lines:{tourSlug:string;date:string;adults:unknown;children:unknown;infants:unknown;addons:string[]}[];contact:{name:string;email:string;phone:string};notes:string;acceptedTerms:boolean};

export function bookingConsentProof(key: string, grants: BookingMeasurementGrants): BookingConsentProof {
  const digest = (category: string, grant: string) =>
    createHash('sha256').update(JSON.stringify(['sp-booking-consent-v1', key, category, grant])).digest('hex');
  return {
    analytics: digest('analytics', grants.analytics),
    marketing: grants.marketing ? digest('marketing', grants.marketing) : undefined,
  };
}

export function bookingMeasurement(row: BookingRow, grants?: BookingMeasurementGrants): BookingMeasurementReceipt | undefined {
  if (!grants) return undefined;
  const event = parseBookingFunnelEvent({
    event: 'sp_booking_created',
    event_id: 'bk_' + createHash('sha256').update(`sp-booking-created-v1:${row.id}`).digest('hex').slice(0, 32),
    currency: row.currency,
    value: Number(row.total),
    items: row.items.map(item => ({ item_id: item.tourSlug, quantity: 1, price: Number(item.lineTotal) })),
  });
  return event?.event === 'sp_booking_created' ? { event, grants } : undefined;
}

export function assertCheckoutReplay(row:BookingRow,userId:string|null,fingerprint:string,legacy?:LegacyCheckoutIdentity) {
  const activity=row.activities.find(entry=>entry.isInternal&&entry.action===ATTEMPT_ACTION);
  if(!activity&&legacy){
    const denied=()=>{throw Error('That submission key was already used for a different booking.')};
    const consent=row.activities.some(entry=>entry.action==='Checkout account consent accepted');
    if(row.userId!==null&&row.userId!==userId&&!consent||legacy.acceptedTerms!==consent||row.currency!=='USD'||row.contactName!==legacy.contact.name||row.contactEmail!==legacy.contact.email||row.contactPhone!==legacy.contact.phone||row.items.length!==legacy.lines.length)return denied();
    const requests:{title:string;slug:string;requested:string[]}[]=[];
    const used=new Set<string>();
    for(const stored of row.items){
      const paid=readJsonText(stored.addons);
      if(!Array.isArray(paid)||paid.some(title=>typeof title!=='string'))return denied();
      const matches=legacy.lines.filter(line=>line.tourSlug===stored.tourSlug&&line.date===stored.travelDate&&line.adults===stored.adults&&line.children===stored.children&&line.infants===stored.infants&&paid.every(title=>line.addons.includes(title)));
      // Old snapshots cannot disambiguate every unpriced-extra permutation.
      if(matches.length!==1||used.has(JSON.stringify(matches[0])))return denied();
      used.add(JSON.stringify(matches[0]));
      requests.push({title:stored.tourTitle,slug:stored.tourSlug,requested:matches[0].addons.filter(title=>!paid.includes(title))});
    }
    if((row.notes??'')!==bookingRequestNotes(legacy.notes,requests))return denied();
    return undefined;
  }
  let metadata:{fingerprint?:string;owner?:string|null;measurement?:BookingConsentProof}={};
  try {metadata=JSON.parse(activity?.note??'{}')}catch{ /* fail closed for missing/legacy metadata */ }
  if(metadata.fingerprint!==fingerprint || metadata.owner!==null&&metadata.owner!==userId) throw Error('That submission key was already used for a different booking.');
  return metadata.measurement;
}
export async function findCheckoutReplay(userId:string|null,key:string,fingerprint:string,client:Pick<Prisma.TransactionClient,'booking'>=db,legacy?:LegacyCheckoutIdentity,measurement?:BookingMeasurementGrants) {
  const row=await client.booking.findUnique({where:{idempotencyKey:key},include:rowInclude});
  if(!row)return null;
  const captured = assertCheckoutReplay(row,userId,fingerprint,legacy);
  const current = measurement && bookingConsentProof(key, measurement);
  const grants = measurement && current && captured?.analytics === current.analytics
    ? { analytics: measurement.analytics, marketing: captured.marketing === current.marketing ? measurement.marketing : undefined }
    : undefined;
  return {booking:userId!==null&&row.userId===userId?toCustomerView(row):null,reference:row.reference,created:false as const,guestAccessUrl:null,bookingMeasurement:bookingMeasurement(row, grants)};
}
