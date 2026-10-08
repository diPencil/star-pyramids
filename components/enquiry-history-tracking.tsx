'use client'

import { useEffect } from 'react'
import { installEnquiryHistoryTracking } from '@/lib/enquiry-navigation'

// Older browsers need entry positions recorded from the start of the document,
// before the user enters Inbox. Modern browsers already expose these positions.
export function EnquiryHistoryTracking() {
  useEffect(() => installEnquiryHistoryTracking(window), [])
  return null
}
