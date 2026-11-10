import 'server-only'
import { hashToken } from '@/lib/core/tokens'
import type { TripRequestMeasurement } from '@/lib/tracking/leads/booking-measurement'

/** Stable across acknowledgements; never expose the internal ID or request reference. */
export function tripRequestMeasurement(persistedId: string): TripRequestMeasurement {
  return { event: 'trip_request_created', event_id: 'tr_' + hashToken(`sp-trip-request-created-v1:${persistedId}`).slice(0, 32) }
}
