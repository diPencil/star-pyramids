import 'server-only';
import { isValidEmail, isValidPersonName, isValidPhone, normalizeEmail, normalizePhone } from '../../core/validation';
import { dayTourTerms, getBookingTotal, getTravelerUnitPrices } from '@/data/tours';
import { isTourPublished } from '@/lib/tours/tour-publish';
import { bookingAddonCatalog, bookingAddons, bookingCents, bookingRequestNotes, bookingSelectionKey, validBookingTravelers, MAX_BOOKING_AMOUNT_CENTS } from '@/lib/booking/booking-selection';
import { findTourBySlug } from '../catalogue/tours';
import { bookingPriceLine, bookingPriceSnapshot, type BookingPriceLine, type BookingPriceSnapshot } from '../../booking/booking-price';
import { TourUnavailable } from './checkout/booking-quote';
import { isValidPreferredDate } from '@/lib/booking/booking';
import { NOTE_MAX, hasControlChars } from './booking-values';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEY_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const MAX_LINES = 20;
const MAX_ADDONS = 20;
const NAME_MAX = 80;
const EMAIL_MAX = 120;
const PHONE_MAX = 32;

export interface ValidatedBookingLine {
  price?: BookingPriceLine;
  tourSlug: string;
  tourTitle: string;
  tourImage: string;
  travelDate: string;
  adults: number;
  children: number;
  infants: number;
  addons: string[];
  /** Unpriced requests are preserved in Booking.notes, never as purchased/free extras. */
  requestedAddons?: string[];
  adultUnitCents: number;
  childUnitCents: number;
  infantUnitCents: number;
  addonTotalCents: number;
  lineTotalCents: number;
  /** Savings on this line from the tour's active deal (integer cents, ≥ 0). */
  lineDiscountCents: number;
  /** Pre-discount line value: original traveler units + add-ons (integer cents). */
  lineOriginalCents: number;
}

export interface ValidatedBookingDraft {
  priceSnapshot?: BookingPriceSnapshot;
  /** Server-approved enrollment consent, never mass-assigned from selections. */
  accountConsent?: boolean;
  lines: ValidatedBookingLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  idempotencyKey: string;
}

const DRAFT_KEYS = new Set(['lines', 'contact', 'notes', 'currency', 'idempotencyKey']);
const LINE_KEYS = new Set(['tourSlug', 'date', 'adults', 'children', 'infants', 'addons']);
const CONTACT_KEYS = new Set(['name', 'email', 'phone']);

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function count(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return null;
  return value;
}

async function resolveLine(raw: unknown, lookup = findTourBySlug, now = new Date()): Promise<ValidatedBookingLine> {
  if (typeof raw !== 'object' || raw === null) throw new Error('Invalid booking items.');
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!LINE_KEYS.has(key)) throw new Error('Invalid booking items.');
  }
  const tourSlug = text(body.tourSlug)?.trim() ?? '';
  if (!SLUG_PATTERN.test(tourSlug) || tourSlug.length > 120) {
    throw new Error('Select a valid tour.');
  }
  // DB-authoritative catalogue: pricing always resolves from the tours table.
  const tour = await lookup(tourSlug);
  if (!tour || !isTourPublished(tour)) throw new TourUnavailable(tourSlug);

  if (body.date !== undefined && typeof body.date !== 'string') throw new Error('Select a valid travel date.');
  const date = text(body.date) ?? '';
  if (date !== '' && !isValidPreferredDate(date)) throw new Error('Select a valid travel date.');

  const adults = count(body.adults);
  const children = body.children === undefined ? 0 : count(body.children);
  const infants = body.infants === undefined ? 0 : count(body.infants);
  if (adults === null || adults < 1 || adults > 50) throw new Error('Each item needs 1-50 adults.');
  if (children === null || infants === null || children < 0 || children > 50 || infants < 0 || infants > 50) {
    throw new Error('Each item allows 0-50 children or infants.');
  }
  if (!validBookingTravelers(adults, children, infants)) throw new Error('Each item allows at most 60 travelers.');

  const rawAddons = body.addons ?? [];
  if (!Array.isArray(rawAddons) || rawAddons.length > MAX_ADDONS) throw new Error('Invalid add-ons.');
  const titles: string[] = [];
  for (const entry of rawAddons) {
    if (typeof entry !== 'string') throw new Error('Invalid add-ons.');
    const title = entry.trim();
    if (!title || title.length > 120 || hasControlChars(title)) throw new Error('Invalid add-ons.');
    if (!titles.includes(title)) titles.push(title);
  }
  const catalog = bookingAddonCatalog(tour,dayTourTerms.addOns);
  const extras = bookingAddons(catalog, titles);
  if (extras.unavailable.length) throw new Error('A selected extra is no longer available. Remove it from your cart and try again.');
  const addonTotalCents = extras.cents;

  const pricing = getBookingTotal(tour, adults, children, infants, now);
  const adultUnitCents = bookingCents(pricing.adult);
  const childUnitCents = bookingCents(pricing.child);
  const infantUnitCents = bookingCents(pricing.infant);
  const travelerCents = adults * adultUnitCents + children * childUnitCents + infants * infantUnitCents;
  // The active deal (percent + date window, resolved from the DB tour row)
  // is the ONLY discount source: it is applied here, once, to traveler
  // units. Add-ons are never discounted. The browser can neither inject
  // nor suppress it  -  selections only, prices never read from the body.
  const list = getTravelerUnitPrices(tour, Math.max(1, adults + children + infants));
  const originalTravelerCents =
    adults * bookingCents(list.adult) + children * bookingCents(list.child) + infants * bookingCents(list.infant);
  const lineDiscountCents = Math.max(0, originalTravelerCents - travelerCents);
  const lineOriginalCents = originalTravelerCents + addonTotalCents;
  if (lineOriginalCents > MAX_BOOKING_AMOUNT_CENTS || travelerCents + addonTotalCents > MAX_BOOKING_AMOUNT_CENTS) throw new Error('The current price cannot be confirmed. Please contact our team.');
  return {
    price: bookingPriceLine(tour,{tourSlug:tour.slug,date,adults,children,infants,addons:titles},now),
    tourSlug: tour.slug,
    tourTitle: tour.title.slice(0, 200),
    tourImage: (tour.image ?? '').slice(0, 255),
    travelDate: date,
    adults,
    children,
    infants,
    addons: extras.priced,
    requestedAddons: extras.requested,
    adultUnitCents,
    childUnitCents,
    infantUnitCents,
    addonTotalCents,
    lineTotalCents: travelerCents + addonTotalCents,
    lineDiscountCents,
    lineOriginalCents,
  };
}

/**
 * Strict server validation of the checkout draft. Unknown keys are
 * rejected (no mass assignment); prices, totals, status, payment,
 * references, and ownership fields are never read from the body.
 */
export async function validateBookingDraft(input: unknown, lookup = findTourBySlug): Promise<ValidatedBookingDraft> {
  if (typeof input !== 'object' || input === null) throw new Error('Invalid request.');
  const body = input as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!DRAFT_KEYS.has(key)) throw new Error('Invalid request.');
  }

  const rawLines = body.lines;
  if (!Array.isArray(rawLines) || rawLines.length < 1 || rawLines.length > MAX_LINES) {
    throw new Error('Your cart is empty or too large.');
  }
  const lines: ValidatedBookingLine[] = [];
  const now=new Date();
  for (const raw of rawLines) lines.push(await resolveLine(raw,lookup,now));
  const uniqueSelections = new Set<string>();
  for (const line of lines) {
    const key = bookingSelectionKey({ ...line, date: line.travelDate || '', addons: [...line.addons, ...(line.requestedAddons ?? [])] });
    if (uniqueSelections.has(key)) throw new Error('Your cart contains duplicate trip selections. Remove the duplicate and try again.');
    uniqueSelections.add(key);
  }

  const rawContact = body.contact;
  if (typeof rawContact !== 'object' || rawContact === null) throw new Error('Enter your contact details.');
  for (const key of Object.keys(rawContact as Record<string, unknown>)) {
    if (!CONTACT_KEYS.has(key)) throw new Error('Invalid request.');
  }
  const contact = rawContact as Record<string, unknown>;
  const contactName = text(contact.name)?.trim() ?? '';
  if (!isValidPersonName(contactName) || contactName.length > NAME_MAX) {
    throw new Error('Enter your full name.');
  }
  const contactEmail = normalizeEmail(text(contact.email) ?? '');
  if (contactEmail === '' || contactEmail.length > EMAIL_MAX || !isValidEmail(contactEmail)) {
    throw new Error('Enter a valid email address.');
  }
  const contactPhoneRaw = text(contact.phone)?.trim() ?? '';
  const phoneDigits = contactPhoneRaw.replace(/\D/g, '');
  if (!isValidPhone(contactPhoneRaw) || phoneDigits.length < 7 || contactPhoneRaw.length > PHONE_MAX) {
    throw new Error('Enter a valid phone number.');
  }

  const notes = text(body.notes) ?? '';
  if (notes.length > NOTE_MAX || hasControlChars(notes)) {
    throw new Error('Notes must be 1,000 characters or fewer.');
  }

  // Currency is presentation-only: the booking is always stored in USD base.
  if (body.currency !== undefined && body.currency !== 'USD') {
    throw new Error('Invalid request.');
  }

  const idempotencyKey = text(body.idempotencyKey)?.trim() ?? '';
  if (!KEY_PATTERN.test(idempotencyKey)) throw new Error('Invalid request.');

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineOriginalCents, 0);
  if (subtotalCents <= 0) throw new Error('Your cart has no chargeable items.');
  if (subtotalCents > MAX_BOOKING_AMOUNT_CENTS) throw new Error('The current price cannot be confirmed. Please contact our team.');
  // Booking snapshot semantics: `subtotal` is the ORIGINAL list value,
  // `discount` is the total deal savings, `total` is what is owed.
  // Stored line units are the CHARGED (post-deal) units.
  const discountCents = lines.reduce((sum, line) => sum + line.lineDiscountCents, 0);
  const storedNotes = bookingRequestNotes(notes, lines.map(line => ({title: line.tourTitle, slug: line.tourSlug, requested: line.requestedAddons ?? []})));
  if (storedNotes.length > NOTE_MAX) throw new Error('The notes and requested extras are too long. Shorten them before submitting.');
  return {
    priceSnapshot: bookingPriceSnapshot(lines.map(line=>line.price!)),
    lines,
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
    contactName,
    contactEmail,
    contactPhone: normalizePhone(contactPhoneRaw),
    notes: storedNotes,
    idempotencyKey,
  };
}
