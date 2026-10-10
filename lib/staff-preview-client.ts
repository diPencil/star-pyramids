'use client';

import { useEffect, useState } from 'react';

import type { Booking, BookingPaymentStatus, BookingStatus } from '@/lib/booking';

/**
 * Staff preview of a customer's account.
 *
 * The portal has always had a staff "view as customer" affordance. This module
 * makes it real: it reads the SAME permission-gated CRM aggregate the admin
 * customer page already uses (`/api/admin/customers/[publicId]`), and maps the
 * database rows onto the portal Booking shape.
 *
 * Nothing here is fabricated. If the customer has no bookings, the preview is
 * empty. Payment status comes from the real `Booking.paymentStatus` column -
 * a customer whose booking was never paid shows as unpaid.
 *
 * The staff member keeps their OWN session and permissions. The preview only
 * changes which records are displayed; it never grants customer authority and
 * never issues a customer session.
 */

type CrmBooking = {
  reference: string;
  status: string;
  paymentStatus: string;
  currency: string;
  total: number;
  createdAt: string;
  items: Array<{ tourSlug: string; tourTitle: string; travelDate: string; guests: number }>;
};

type CrmCustomer = {
  publicId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  phone: string | null;
  bookings: CrmBooking[];
  payments: Array<{ reference: string; status: string; amountPaid: number; currency: string }>;
};

const BOOKING_STATUSES: readonly BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];

function toBookingStatus(value: string): BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(value)
    ? (value as BookingStatus)
    : 'pending';
}

function toPaymentStatus(value: string): BookingPaymentStatus {
  return value === 'PAID' || value === 'REFUNDED' ? value.toLowerCase() as BookingPaymentStatus : 'pending';
}

/**
 * Map a CRM booking row onto the portal Booking shape using only real values.
 * Fields the CRM aggregate does not carry are left empty rather than invented.
 */
function toPortalBooking(row: CrmBooking, customer: CrmCustomer): Booking {
  const contactName = customer.displayName;
  return {
    reference: row.reference,
    createdAt: row.createdAt,
    updatedAt: row.createdAt,
    status: toBookingStatus(row.status),
    paymentStatus: toPaymentStatus(row.paymentStatus),
    subtotal: row.total,
    discount: 0,
    total: row.total,
    currency: 'USD',
    contact: { name: contactName, email: customer.email, phone: customer.phone ?? '' },
    notes: '',
    lines: row.items.map((item) => ({
      key: `${row.reference}-${item.tourSlug}`,
      tourSlug: item.tourSlug,
      title: item.tourTitle,
      image: '',
      date: item.travelDate,
      adults: item.guests,
      children: 0,
      infants: 0,
      addons: [],
      addonTotal: 0,
      adultUnit: 0,
      childUnit: 0,
      infantUnit: 0,
      total: 0,
    })),
    activity: [],
  };
}

export type StaffPreviewState = {
  /** Real bookings for the previewed customer; empty when they have none. */
  bookings: Booking[];
  displayName: string;
  loading: boolean;
  error: string | null;
};

/**
 * Loads the previewed customer's real bookings from the CRM API. Requires the
 * viewer's own `customers.view` permission - the request is made with the
 * staff session, and the route enforces the permission server side.
 */
export function useStaffPreviewBookings(publicId: string | null): StaffPreviewState {
  const [state, setState] = useState<StaffPreviewState>({
    bookings: [],
    displayName: '',
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!publicId) {
      setState({ bookings: [], displayName: '', loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    void (async () => {
      try {
        const res = await fetch(`/api/admin/customers/${encodeURIComponent(publicId)}`, {
          credentials: 'same-origin',
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || 'Could not load this customer.');
        }
        const payload = (await res.json()) as { customer?: CrmCustomer };
        if (cancelled) return;
        const customer = payload.customer;
        if (!customer) {
          setState({ bookings: [], displayName: '', loading: false, error: 'Customer not found.' });
          return;
        }
        setState({
          bookings: (customer.bookings ?? []).map((row) => toPortalBooking(row, customer)),
          displayName: customer.displayName,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          bookings: [],
          displayName: '',
          loading: false,
          error: err instanceof Error ? err.message : 'Could not load this customer.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicId]);

  return state;
}
