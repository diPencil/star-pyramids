'use client'
import { AccountShell, type AccountSection } from './shared/account-shell'
export { AccountShell } from './shared/account-shell'
export type { AccountSection } from './shared/account-shell'
import { SettingsSection, ChangePasswordSection, PersonalProfileSection } from "./profile/profile-settings"

import { MessagesSection } from "./support/messages-section"

import { PaymentDetailSection, PaymentsSection } from "./payments/payment-sections"

import { OverviewSection } from "./overview/overview-section"

import { FavoritesSection } from "./favorites/favorites-section";

import { CarRequestDetailSection, CarRequestsSection } from "./cars/car-request-sections"

import { useVisibleBookings, BookingDetailSection, GuestBookingSection, BookingsSection } from "./bookings/booking-sections";
export { useCustomerBookings, useVisibleBookings } from "./bookings/booking-sections"

import { NotificationPanel } from "./shared/account-notifications"

import { CustomerAvatar } from "./shared/account-ui";
export { EmptyState, CustomerPagination } from "./shared/account-ui"

import { useImpersonated, useAccountProfile, useVisibleInquiries } from "./shared/account-hooks"
export { useImpersonated, useVisibleInquiries } from "./shared/account-hooks"

import { BrandMark } from '@/components/branding/brand-mark'
import { CURRENCY_OPTIONS, type Currency } from "@/lib/payments/currency";

// 'use client' is required here: the access token is read from the router
// rather than passed as a prop, so the credential never enters the
// server-rendered payload that ships in the HTML.

import Link from 'next/link'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ArrowLeft, Ban, Bell, CarFront, ChevronDown, ChevronRight, Compass, CircleDollarSign, ExternalLink, Globe2, Heart, HelpCircle, FlaskConical, LayoutDashboard, LogOut, Mail, Menu, MessageCircle, Search, Settings2, ShoppingBag, ShoppingCart, Ticket, UserRound, WalletCards, X } from "lucide-react";
import { LocaleProvider, tx, useLocale } from "@/components/locale";
import { catalogTours, findTour } from '@/data/tours'

import { localizeTourLocation } from "@/lib/tours/tour-format";



import { useCart } from '@/lib/booking/cart'

import { stopImpersonation } from "@/lib/admin-store";

import { useDbTours } from '@/lib/tours/tours-client'



import { useCustomerFavorites } from "@/lib/account/customer-account";

import { useCustomerNotifications } from "@/lib/account/customer-notifications";


import { useSupportChat } from '@/lib/support/support-chat'



import { SharedSelect } from '@/components/shared/forms/shared-select'



import { LanguageModal } from '@/components/shared/language-selector'

export {CustomerConfirmDialog} from './customer-confirm-dialog'
import { LOCALE_SHORT_LABELS } from "@/lib/i18n/locale-config";


import { useMobileDrawer } from '@/lib/ui/use-mobile-drawer'
import { CustomerTripRequestsPage } from '@/components/account/account-custom-trip'
import { CustomerEventRequestsPage } from '@/components/account/account-event-requests'

export function BookingDetailPage({ reference, autoPrint = false }: { reference: string; autoPrint?: boolean }) {
  return <LocaleProvider><AccountShell section="bookings"><BookingDetailSection reference={reference} autoPrint={autoPrint} /></AccountShell></LocaleProvider>
}

/**
 * Guest booking access (P0 Fix 04).
 *
 * Read-only view for a guest who booked without an account. The private
 * access token in the URL is the only credential  -  there is no session and
 * no reference lookup  -  so this screen deliberately exposes NO mutation:
 * no cancel, no payment, no messaging draft. A leaked link therefore
 * reveals a booking and nothing more.
 *
 * Reuses the account booking presentation so guests and customers read the
 * same booking identically.
 *
 * This is a client component on purpose: the token is read from the router
 * rather than received as a prop, so the credential is never serialized into
 * the server-rendered payload that ships in the HTML.
 */
export function GuestBookingPage({ autoPrint = false }: { autoPrint?: boolean }) {
  const params = useParams<{ token?: string }>()
  const token = typeof params.token === 'string' ? params.token : ''
  return <LocaleProvider><GuestBookingSection token={token} autoPrint={autoPrint} /></LocaleProvider>
}

export function CarRequestDetailPage({ reference }: { reference: string }) {
  return <LocaleProvider><CarRequestDetailHeader reference={reference} /></LocaleProvider>
}

function CarRequestDetailHeader({ reference }: { reference: string }) {
  const { locale } = useLocale()

  return (
    <AccountShell
      section="car-requests"
      headLeading={<Link href="/account/car-requests" className="account-icon-action">{locale === 'ar' ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}{tx(locale, { en: 'Back to car requests', es: 'Volver a las solicitudes de coche', it: 'Torna alle richieste auto', ar: 'عودة لطلبات السيارات' })}</Link>}
    ><CarRequestDetailSection reference={reference} /></AccountShell>
  )
}

export function PaymentDetailPage({ reference }: { reference: string }) {
  return <LocaleProvider><AccountShell section="payments"><PaymentDetailSection reference={reference} /></AccountShell></LocaleProvider>
}

export function CustomerAccountPage({ section = 'overview' }: { section?: AccountSection }) {
  // These dedicated pages already own their locale provider and account shell.
  if (section === 'trip-requests') return <CustomerTripRequestsPage />
  if (section === 'event-requests') return <CustomerEventRequestsPage />
  return <LocaleProvider><AccountShell section={section}>{section === 'overview' ? <OverviewSection /> : section === 'bookings' ? <BookingsSection /> : section === 'car-requests' ? <CarRequestsSection /> : section === 'favorites' ? <FavoritesSection /> : section === 'payments' ? <PaymentsSection /> : section === 'messages' ? <MessagesSection /> : section === 'settings' ? <SettingsSection /> : section === 'change-password' ? <ChangePasswordSection /> : <PersonalProfileSection />}</AccountShell></LocaleProvider>
}
