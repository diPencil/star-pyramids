'use client'

import { useEffect, useRef } from 'react'
import type { TourCategory } from '@/data/types'
import { GTM_READY_EVENT, analyticsDataLayer, subscribeToTrackingConsent, subscribeToTrackingLocation } from '@/lib/tracking/tracking-browser'
import { isPublicTourId } from '@/lib/tracking/leads/booking-measurement'

export function TourViewMeasurement({ routeSlug, itemId, category }: { routeSlug: string; itemId: string; category: TourCategory }) {
  const sent = useRef<string | null>(null)
  useEffect(() => {
    let active = true
    const report = () => {
      if (!active) return
      const path = window.location.pathname.replace(/\/$/, '')
      if (path !== `/egypt-tours/${routeSlug}` || sent.current === path || !isPublicTourId(itemId)) return
      const layer = analyticsDataLayer(window, process.env.NODE_ENV)
      if (!layer) return
      sent.current = path
      try { layer.push({ event: 'sp_view_item', items: [{ item_id: itemId, item_category: category }] }) }
      catch { /* A tag failure cannot affect the tour page. */ }
    }
    // SiteMeasurement must apply consent and URL eligibility before dispatch.
    const reportAfterUpdate = () => queueMicrotask(report)
    const stopConsent = subscribeToTrackingConsent(window, reportAfterUpdate)
    const stopLocation = subscribeToTrackingLocation(window, reportAfterUpdate)
    window.addEventListener(GTM_READY_EVENT, report)
    report()
    return () => {
      active = false
      window.removeEventListener(GTM_READY_EVENT, report)
      stopConsent()
      stopLocation()
    }
  }, [routeSlug, itemId, category])
  return null
}
