import 'server-only'
import { hashToken } from '@/lib/core/tokens'
import type { FormLeadName, FormLeadReceipt } from '@/lib/booking-measurement'

/** Called only after persistence/replay confirmation. Never return a raw reference. */
export function formLeadMeasurement(event: FormLeadName, persistedIdentity: string): FormLeadReceipt {
  const prefix = event === 'enquiry_created' ? 'enq' : event === 'car_request_created' ? 'car' : 'evt'
  return { event, event_id: prefix + '_' + hashToken(`sp-form-lead-v1:${event}:${persistedIdentity}`).slice(0, 32) }
}
