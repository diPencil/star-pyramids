/**
 * Admin Car Requests — FRONTEND DEMO FIXTURE ONLY.
 *
 * This module is the admin-side demo contract for the future "Car Requests"
 * area (`/admin/car-requests`). It is deliberately separate from
 * `lib/car-request.ts`, which owns the CUSTOMER draft/local-preview contract
 * (`CarRequestDraft`). Nothing here is read from, written to, or synced with
 * the customer browser-local preview.
 *
 * Future backend entity will add authoritative server fields (server request
 * id/reference, lifecycle status, timestamps, assigned vehicle, quote/rate,
 * availability decision, …). Do NOT add those to `CarRequestDraft`.
 *
 * Every reference below uses the `DEMO-CR-xxx` prefix so demo rows can never
 * be mistaken for real server references. Displayed statuses are demo admin
 * states only: no payment, no availability, no confirmed rate.
 */

export type AdminCarRequestStatus = 'new' | 'reviewing' | 'confirmed' | 'cancelled'

export type AdminCarTripType = 'One Way' | 'Round Trip'

export type AdminCarRequest = {
  /** Demo reference only. Never presented as a server reference. */
  ref: string
  status: AdminCarRequestStatus
  tripType: AdminCarTripType
  /** Requested/preferred vehicle. Not proof of availability or assignment. */
  vehicleName: string
  vehicleSlug: string
  pickup: string
  dropoff: string
  /** Preferred/requested dates (YYYY-MM-DD). Return is '' unless round trip. */
  preferredPickupDate: string
  preferredReturnDate: string
  passengers: number
  customerName: string
  customerEmail: string
  customerPhone: string
  notes: string
  /** Demo-received date label (fixture metadata, not a server timestamp). */
  receivedOn: string
}

export const demoCarRequests: AdminCarRequest[] = [
  {
    ref: 'DEMO-CR-001',
    status: 'new',
    tripType: 'One Way',
    vehicleName: 'Toyota Corolla',
    vehicleSlug: 'toyota-corolla',
    pickup: 'Cairo International Airport',
    dropoff: 'Giza Pyramids View Hotel',
    preferredPickupDate: '2026-10-14',
    preferredReturnDate: '',
    passengers: 3,
    customerName: 'Layla Hassan',
    customerEmail: 'layla.hassan@example.com',
    customerPhone: '+20 101 234 5678',
    notes: 'Child seat requested for one toddler, if possible.',
    receivedOn: '2026-09-24',
  },
  {
    ref: 'DEMO-CR-002',
    status: 'new',
    tripType: 'Round Trip',
    vehicleName: 'Hyundai H1 Van',
    vehicleSlug: 'hyundai-h1-van',
    pickup: 'Hurghada Marina',
    dropoff: 'Luxor East Bank',
    preferredPickupDate: '2026-11-02',
    preferredReturnDate: '2026-11-06',
    passengers: 7,
    customerName: 'Jonas Weber',
    customerEmail: 'jonas.weber@example.com',
    customerPhone: '+49 171 234 5678',
    notes: 'Family group with large luggage; van preferred over two cars.',
    receivedOn: '2026-09-25',
  },
  {
    ref: 'DEMO-CR-003',
    status: 'reviewing',
    tripType: 'One Way',
    vehicleName: 'Mercedes E-Class',
    vehicleSlug: 'mercedes-e-class',
    pickup: 'Four Seasons Cairo',
    dropoff: 'Alexandria Corniche',
    preferredPickupDate: '2026-10-20',
    preferredReturnDate: '',
    passengers: 2,
    customerName: 'Sara El-Masry',
    customerEmail: 'sara.elmasry@example.com',
    customerPhone: '+20 122 345 6789',
    notes: 'Quiet executive transfer; English-speaking driver preferred.',
    receivedOn: '2026-09-22',
  },
  {
    ref: 'DEMO-CR-004',
    status: 'reviewing',
    tripType: 'Round Trip',
    vehicleName: 'Toyota Hiace',
    vehicleSlug: 'toyota-hiace',
    pickup: 'Aswan High Dam',
    dropoff: 'Abu Simbel Temples',
    preferredPickupDate: '2026-12-05',
    preferredReturnDate: '2026-12-05',
    passengers: 12,
    customerName: 'Marco Bianchi',
    customerEmail: 'marco.bianchi@example.com',
    customerPhone: '+39 345 678 9012',
    notes: '',
    receivedOn: '2026-09-20',
  },
  {
    ref: 'DEMO-CR-005',
    status: 'confirmed',
    tripType: 'One Way',
    vehicleName: 'Toyota Corolla',
    vehicleSlug: 'toyota-corolla',
    pickup: 'Sphinx International Airport',
    dropoff: 'Zamalek, Cairo',
    preferredPickupDate: '2026-10-08',
    preferredReturnDate: '',
    passengers: 2,
    customerName: 'Emily Turner',
    customerEmail: 'emily.turner@example.com',
    customerPhone: '+44 7700 900123',
    notes: 'Flight lands 22:40; pickup from arrivals hall requested.',
    receivedOn: '2026-09-18',
  },
  {
    ref: 'DEMO-CR-006',
    status: 'cancelled',
    tripType: 'Round Trip',
    vehicleName: 'Hyundai H1 Van',
    vehicleSlug: 'hyundai-h1-van',
    pickup: 'Sharm El Sheikh Airport',
    dropoff: 'Dahab Blue Hole',
    preferredPickupDate: '2026-09-28',
    preferredReturnDate: '2026-10-01',
    passengers: 5,
    customerName: 'Omar Adel',
    customerEmail: 'omar.adel@example.com',
    customerPhone: '+20 155 456 7890',
    notes: 'Customer asked to cancel in demo scenario; dates changed.',
    receivedOn: '2026-09-15',
  },
]
