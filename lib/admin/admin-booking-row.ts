import type {BookingStatus,StaffBooking} from '../booking/booking'

export type AdminBookingRow = {
  reference: string
  currency: string
  customer: string
  trips: number
  tourTitles: string[]
  tour: string
  date: string
  guests: number
  total: number
  status: BookingStatus
  paymentSummary?: { paidTotal: number; state: string }
}

export function toAdminBookingRow(booking: StaffBooking): AdminBookingRow {
  const tourTitles = booking.lines.map(line=>line.title)
  const guests = booking.lines.reduce((sum, line) => sum + line.adults + line.children + line.infants, 0)
  const date = booking.lines.map((line) => line.date).find((d) => d !== '') ?? booking.createdAt.slice(0, 10)
  return {
    reference: booking.reference,
    currency: booking.currency,
    customer: booking.account?.name || booking.contact.name,
    tour: tourTitles.join(' · ') || '-',
    tourTitles,
    trips: booking.lines.length,
    date,
    guests,
    total: booking.total,
    status: booking.status,
    paymentSummary: booking.paymentSummary ? { paidTotal: booking.paymentSummary.paidTotal, state: booking.paymentSummary.state } : undefined,
  }
}
