import 'server-only'
import type { Prisma } from '@prisma/client'
import { db } from './db'
import { readJsonText, readJsonObject } from '../json-text'
import { isOfferActive, offerDeadline } from '../special-offers'
import { NextResponse } from 'next/server'

export class OfferInputError extends Error {}
export async function offerBody(request: Request): Promise<Record<string, unknown>> {
  let value: unknown
  try { value = await request.json() } catch { throw new OfferInputError('Invalid JSON body.') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new OfferInputError('Invalid JSON body.')
  return value as Record<string, unknown>
}
export function offerError(error: unknown) {
  if (error instanceof OfferInputError) return NextResponse.json({ error: error.message }, { status: 400 })
  if (error instanceof Error && 'code' in error && error.code === 'P2002') return NextResponse.json({ error: 'This slug or tour already has an offer. Edit the existing offer.' }, { status: 409 })
  if (error instanceof Error && 'code' in error && error.code === 'P2003') return NextResponse.json({ error: 'The linked tour changed. Reload and try again.' }, { status: 409 })
  return NextResponse.json({ error: 'Could not save the offer. Please try again.' }, { status: 500 })
}
export const offerTourSelect = { slug: true, status: true, title: true, image: true, gallery: true, duration: true, price: true, summary: true } as const
export function presentOffer<T extends { tourSlug: string | null; discountPercent: number | null; image: string; duration: string | null; price: number | null; originalPrice: number | null; content: string; tour: { image: string; duration: string; price: { toString(): string }; gallery: string } | null }>(row: T) {
  if (!row.tour || row.discountPercent === null) return row
  const originalPrice = Number(row.tour.price.toString())
  return { ...row, image: row.tour.image, duration: row.tour.duration, originalPrice, price: Math.round(originalPrice * (1 - row.discountPercent / 100) * 100) / 100, content: JSON.stringify({ ...readJsonObject(row.content), gallery: readJsonText(row.tour.gallery) }) }
}

export async function linkedOfferFields(tx: Prisma.TransactionClient, input: Record<string, unknown>, existing?: { tourSlug: string | null; discountPercent: number | null; startsAt: Date | null; deadline: string | null }) {
  const tourSlug = input.tourSlug === undefined ? existing?.tourSlug ?? null : input.tourSlug === null || input.tourSlug === '' ? null : input.tourSlug
  if (tourSlug !== null && (typeof tourSlug !== 'string' || tourSlug.length > 80)) throw new OfferInputError('Select a valid tour.')
  const rawStart = input.startsAt === undefined ? existing?.startsAt : input.startsAt
  if (rawStart != null && rawStart !== '' && typeof rawStart !== 'string' && !(rawStart instanceof Date)) throw new OfferInputError('Choose a valid start date.')
  if (input.deadline != null && typeof input.deadline !== 'string') throw new OfferInputError('Choose a valid end date.')
  if (typeof rawStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawStart) && !Number.isFinite(offerDeadline(rawStart))) throw new OfferInputError('Choose a valid start date.')
  const startsAt = rawStart ? new Date(String(rawStart)) : null
  if (startsAt && !Number.isFinite(startsAt.getTime())) throw new OfferInputError('Choose a valid start date.')
  const deadline = input.deadline === undefined ? existing?.deadline ?? null : input.deadline === null || input.deadline === '' ? null : typeof input.deadline === 'string' ? input.deadline.trim() : null
  if (deadline && !Number.isFinite(offerDeadline(deadline))) throw new OfferInputError('Choose a valid end date.')
  if (startsAt && deadline && startsAt.getTime() > offerDeadline(deadline)) throw new OfferInputError('The end date must follow the start date.')
  if (!tourSlug) return { tourSlug: null, discountPercent: null, startsAt, deadline }
  const discountPercent = input.discountPercent === undefined ? existing?.discountPercent : input.discountPercent
  if (typeof discountPercent !== 'number' || !Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 90) throw new OfferInputError('Enter a discount between 1 and 90.')
  if (!deadline) throw new OfferInputError('A linked offer requires an end date.')
  const tour = await tx.tour.findUnique({ where: { slug: tourSlug }, select: { slug: true, price: true, image: true, duration: true } })
  if (!tour) throw new OfferInputError('The selected tour no longer exists.')
  return { tourSlug, discountPercent, startsAt, deadline, originalPrice: Number(tour.price), price: Math.round(Number(tour.price) * (1 - discountPercent / 100) * 100) / 100, image: tour.image, duration: tour.duration }
}

// One authoritative resolver for public cards, tour pages and booking pricing.
// Never writes to Tour.deal: unrelated/manual deals are preserved verbatim.
export async function applyLinkedOfferDeals<T extends { slug: string; deal: unknown }>(rows: T[]): Promise<(Omit<T, 'deal'> & { deal: unknown; manualDeal: unknown })[]> {
  if (!rows.length) return []
  const offers = await db.offer.findMany({ where: { tourSlug: { in: rows.map(row => row.slug) } }, select: { tourSlug: true, isPublished: true, startsAt: true, deadline: true, discountPercent: true } })
  const byTour = new Map(offers.map(offer => [offer.tourSlug, offer]))
  return rows.map(row => {
    const offer = byTour.get(row.slug)
    const deal = offer && isOfferActive(offer) && offer.discountPercent !== null ? { percent: offer.discountPercent, endsAt: offer.deadline } : readJsonText(row.deal)
    return { ...row, deal, manualDeal: readJsonText(row.deal) }
  })
}
