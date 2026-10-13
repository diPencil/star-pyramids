'use client'

import {
  Accessibility,
  Anchor,
  Backpack,
  BadgeCheck,
  BadgeDollarSign,
  BadgePercent,
  Bell,
  BellRing,
  Binoculars,
  CalendarCheck,
  CalendarDays,
  Camera,
  CarFront,
  Clock3,
  Compass,
  Crown,
  Gem,
  Gift,
  Globe2,
  Heart,
  Hourglass,
  Landmark,
  LifeBuoy,
  Luggage,
  MapPin,
  Megaphone,
  Mountain,
  Palmtree,
  PartyPopper,
  Percent,
  Plane,
  Sailboat,
  Ship,
  Sparkles,
  Star,
  Sun,
  Sunset,
  Tag,
  Tags,
  Tent,
  Ticket,
  Timer,
  Umbrella,
  Wallet,
  Waves,
  type LucideIcon,
} from 'lucide-react'

const ICON_COMPONENTS: Record<string, LucideIcon> = {
  Accessibility,
  Anchor,
  Backpack,
  BadgeCheck,
  BadgeDollarSign,
  BadgePercent,
  Bell,
  BellRing,
  Binoculars,
  CalendarCheck,
  CalendarDays,
  Camera,
  CarFront,
  Clock3,
  Compass,
  Crown,
  Gem,
  Gift,
  Globe2,
  Heart,
  Hourglass,
  Landmark,
  LifeBuoy,
  Luggage,
  MapPin,
  Megaphone,
  Mountain,
  Palmtree,
  PartyPopper,
  Percent,
  Plane,
  Sailboat,
  Ship,
  Sparkles,
  Star,
  Sun,
  Sunset,
  Tag,
  Tags,
  Tent,
  Ticket,
  Timer,
  Umbrella,
  Wallet,
  Waves,
}

/**
 * Renders saved promotional-bar icons in their saved order. Unknown
 * identifiers render nothing (never a broken layout); an empty list renders
 * nothing so disabling icons causes no layout shift. DOM order is the saved
 * order in both LTR and RTL.
 */
export function BarIcons({ ids, size = 26 }: { ids: readonly string[]; size?: number }) {
  return (
    <>
      {ids.map((id) => {
        const Icon = ICON_COMPONENTS[id]
        return Icon ? <Icon key={id} size={size} aria-hidden="true" /> : null
      })}
    </>
  )
}
