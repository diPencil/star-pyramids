/**
 * Approved icon registry for promotional bars. Identifiers are stable
 * lucide-react export names — never raw SVG/HTML — so records stay safe,
 * searchable, and renderable in both LTR and RTL layouts. Every entry was
 * verified against the installed lucide-react package.
 */
export const PROMO_BAR_ICONS = [
  'Ticket',
  'BadgePercent',
  'Star',
  'Accessibility',
  'Gift',
  'Sparkles',
  'Tag',
  'Tags',
  'Percent',
  'Megaphone',
  'Bell',
  'BellRing',
  'CalendarDays',
  'CalendarCheck',
  'Clock3',
  'Timer',
  'Hourglass',
  'MapPin',
  'Globe2',
  'Compass',
  'Ship',
  'Anchor',
  'Sun',
  'Sunset',
  'Waves',
  'Plane',
  'CarFront',
  'Camera',
  'Crown',
  'Gem',
  'Heart',
  'Wallet',
  'BadgeCheck',
  'BadgeDollarSign',
  'PartyPopper',
  'Luggage',
  'Backpack',
  'Tent',
  'Mountain',
  'Landmark',
  'Palmtree',
  'Sailboat',
  'LifeBuoy',
  'Binoculars',
  'Umbrella',
] as const

export type PromoBarIconId = (typeof PROMO_BAR_ICONS)[number]

/** Maximum icons per advertisement (the originals use at most two). */
export const MAX_PROMO_BAR_ICONS = 4

export function isPromoBarIconId(value: unknown): value is PromoBarIconId {
  return typeof value === 'string' && (PROMO_BAR_ICONS as readonly string[]).includes(value)
}
