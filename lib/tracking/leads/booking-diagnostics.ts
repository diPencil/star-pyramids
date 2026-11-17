export const BOOKING_MEASUREMENT_STATUS_EVENT = 'sp:booking-measurement-status'

type BookingMeasurementStatuses = {
  capture: 'disabled' | 'ineligible' | 'invalid_receipt' | 'queued' | 'already_queued' | 'already_enqueued' | 'storage_failed'
  acknowledgement: 'unavailable' | 'rejected' | 'timed_out' | 'request_failed' | 'navigation_interrupted' | 'ready'
  drain: 'waiting_for_gtm' | 'discarded' | 'storage_failed'
  dispatch: 'enqueued' | 'already_enqueued' | 'ineligible' | 'push_failed' | 'storage_failed' | 'enqueue_unconfirmed'
}

export function reportBookingMeasurement<Stage extends keyof BookingMeasurementStatuses>(
  browser: Window, stage: Stage, status: BookingMeasurementStatuses[Stage],
) {
  try {
    browser.dispatchEvent(new CustomEvent(BOOKING_MEASUREMENT_STATUS_EVENT, { detail: { stage, status } }))
  } catch { /* Local diagnostics are optional. */ }
}
