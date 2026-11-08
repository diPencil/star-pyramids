import type { MakeYourTripRequestDraft, TripRequest } from './trip-request'
import { recordTripRequestReceipt, tripRequestMeasurementGrants } from './booking-funnel'

export async function submitTripRequest(browser: Window, environment: string | undefined, draft: MakeYourTripRequestDraft, editReference: string | null = null): Promise<TripRequest> {
  const grants = editReference ? undefined : tripRequestMeasurementGrants(browser, environment)
  const response = await browser.fetch(editReference ? `/api/account/trip-requests/${encodeURIComponent(editReference)}` : '/api/trip-requests', {
    method: editReference ? 'PATCH' : 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(editReference ? { action: 'update', draft } : draft),
  })
  const data = await response.json() as TripRequest & { error?: string; tripRequestMeasurement?: unknown }
  if (!response.ok) throw new Error(data.error || 'Could not save the request.')
  if (!editReference && response.status === 201) recordTripRequestReceipt(browser, environment, data.tripRequestMeasurement, grants)
  return data
}
