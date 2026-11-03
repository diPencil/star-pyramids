import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { getCurrentUser } from '@/lib/server/auth';
import {bookingSameOrigin,bookingClientIp,reserveBookingAttempt} from '@/lib/server/booking-request-security';
import { readBoundedJson } from '@/lib/server/request-json';
import { prepareCheckoutAccount } from '@/lib/server/checkout-account';
import { createCheckoutBooking } from '@/lib/server/booking-checkout';
import {PriceChanged,QuoteServiceError,TourUnavailable} from '@/lib/server/booking-quote';

function bodyEmail(body: unknown): string {
  if (typeof body !== 'object' || body === null) return 'unknown';
  const contact = (body as { contact?: unknown }).contact;
  if (typeof contact !== 'object' || contact === null) return 'unknown';
  const email = (contact as { email?: unknown }).email;
  return typeof email === 'string' && email ? email : 'unknown';
}

function bookingFailure(error: unknown) {
  if(error instanceof Error&&error.message==='Invalid price confirmation. Review your cart and try again.')return NextResponse.json({code:'PRICE_CONFIRMATION_INVALID',error:error.message},{status:400,headers:{'Cache-Control':'no-store'}});
  if(error instanceof TourUnavailable)return NextResponse.json({code:'TOUR_UNAVAILABLE',slug:error.slug,error:error.message},{status:409,headers:{'Cache-Control':'no-store'}});
  if(error instanceof PriceChanged)return NextResponse.json({code:'PRICE_CHANGED',price:error.price,quote:error.quote},{status:409,headers:{'Cache-Control':'no-store'}});
  if(error instanceof QuoteServiceError)return NextResponse.json({code:'SERVICE_UNAVAILABLE',error:error.message},{status:503,headers:{'Cache-Control':'no-store'}});
  const persistenceError = [
    Prisma.PrismaClientKnownRequestError,
    Prisma.PrismaClientUnknownRequestError,
    Prisma.PrismaClientInitializationError,
    Prisma.PrismaClientValidationError,
    Prisma.PrismaClientRustPanicError,
  ].some(ErrorType => error instanceof ErrorType);
  if (error instanceof Error && !persistenceError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(
    { error: 'Unable to process your booking right now. Please try again.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * Public checkout submission (cart -> booking).
 * Guest checkout is preserved: contact details identify the booking.
 * An authenticated CUSTOMER session links the record to that user  -
 * ownership always comes from the server session, never the browser.
 * Pricing is recalculated server-side from the canonical catalogue;
 * any client-supplied price/total/status/payment field is rejected.
 * A repeated submission with the same idempotency key returns the
 * original booking instead of creating a duplicate.
 */
export async function POST(request: Request) {
  if (!bookingSameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const ip = bookingClientIp(request);

  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  let limit;
  try {limit=await reserveBookingAttempt(bodyEmail(body), ip)}catch{return bookingFailure(null)}
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: limit.retryAfterSeconds?{ 'Retry-After': String(limit.retryAfterSeconds) }:{} },
    );
  }

  try {
    if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Invalid request.');
    const selections={...body} as Record<string,unknown>;
    const acceptedPrice=selections.acceptedPrice;
    const priceQuote=selections.priceQuote;
    const recoverOnly=selections.recoverOnly;
    delete selections.recoverOnly;
    if(recoverOnly!==undefined&&typeof recoverOnly!=='boolean')throw Error('Invalid request.');
    delete selections.acceptedPrice;delete selections.priceQuote;
    if(priceQuote!==undefined&&(typeof priceQuote!=='string'||priceQuote.length>1024))throw Error('Invalid request.');
    const acceptedTerms=selections.acceptedTerms===true;
    if (selections && typeof selections === 'object' && 'acceptedTerms' in selections) {
      if (typeof selections.acceptedTerms !== 'boolean') throw Error('Invalid request.');
      delete selections.acceptedTerms;
    }
    const current=await getCurrentUser();
    const userId=current&&current.roles.includes('CUSTOMER')?current.id:null;
    const {booking,reference,created,guestAccessUrl}=await createCheckoutBooking(userId,selections,acceptedTerms,acceptedPrice,priceQuote as string|undefined,recoverOnly===true);
    if(created&&userId===null&&acceptedTerms)await prepareCheckoutAccount(reference,bodyEmail(body)).catch(()=>undefined);
    if(!booking)return NextResponse.json({success:true,existing:true,reference,guest:true,guestAccessUrl:null},{status:200,headers:{'Cache-Control':'no-store'}});
    // `guestAccessUrl` is the private link minted for a guest checkout; it
    // is null for account bookings, which keep their existing session flow.
    return NextResponse.json({ ...booking, existing:!created,guestAccessUrl, guest: userId === null }, { status: created ? 201 : 200, headers:{'Cache-Control':'no-store'} });
  } catch (error) {
    return bookingFailure(error);
  }
}
