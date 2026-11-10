import { formLeadMeasurementGrants, recordFormLeadReceipt } from './booking-funnel'
import type { BookingMeasurementGrants, FormLeadType } from './booking-measurement'

export type FormLeadAttempt = { form_type: FormLeadType; grants?: BookingMeasurementGrants }

/** Keep this attempt with the existing request ID across network retries. */
export function beginFormLead(browser: Window, environment: string | undefined, form_type: FormLeadType): FormLeadAttempt {
  return { form_type, grants: formLeadMeasurementGrants(browser, environment) }
}

export function confirmFormLead(browser: Window, environment: string | undefined, attempt: FormLeadAttempt, status: number, data: unknown) {
  try {
    const expected = attempt.form_type === 'car_request' ? 'car_request_created' : attempt.form_type === 'event_request' ? 'event_request_created' : 'enquiry_created'
    if (status !== 201 && !(expected === 'enquiry_created' && status === 200)) return
    const receipt = (data as { leadMeasurement?: { event?: unknown; event_id?: unknown } } | null)?.leadMeasurement
    if (receipt?.event !== expected) return
    recordFormLeadReceipt(browser, environment, { event: expected, event_id: receipt.event_id, form_type: attempt.form_type }, attempt.grants)
  } catch { /* A missing/old deployment receipt is not a failed customer request. */ }
}
