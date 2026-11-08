'use client'

import { Analytics, type BeforeSend } from '@vercel/analytics/next'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { canMeasureLocation, sanitizeMeasurementUrl } from '@/lib/tracking'
import { GTM_READY_EVENT, initializeGtm, readTrackingConsent, subscribeToTrackingConsent, subscribeToTrackingLocation } from '@/lib/tracking-browser'
import { createPageViewTracker } from '@/lib/tracking-events'
import { flushBookingFunnel, FUNNEL_STORAGE_PREFIX } from '@/lib/booking-funnel'
import { installTrackingHealthResponder } from '@/lib/tracking-health-browser'

function PublicPageViews({ enabled, refresh }: { enabled: boolean; refresh: () => void }) {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const [observe] = useState(createPageViewTracker)

  useEffect(() => { refresh() }, [pathname, search, refresh])

  useEffect(() => {
    const report = (restored = false) => {
      // Wait for the App Router's committed location before counting it.
      observe(window, process.env.NODE_ENV, {
        pathname, search, restored,
        enabled: enabled && (!restored || readTrackingConsent(window).analytics),
      })
    }
    report()
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) report(true)
    }
    window.addEventListener('pageshow', onPageShow)
    const onReady = () => report()
    window.addEventListener(GTM_READY_EVENT, onReady)
    return () => {
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener(GTM_READY_EVENT, onReady)
    }
  }, [pathname, search, enabled, observe])

  return null
}

export function SiteMeasurement({ containerId, explicitPageViews }: { containerId: string | null; explicitPageViews: boolean }) {
  const analyticsAllowed = useRef(false)
  const [mountAnalytics, setMountAnalytics] = useState(false)
  const [analyticsGranted, setAnalyticsGranted] = useState(false)

  const refresh = useCallback(() => {
    const eligible = canMeasureLocation(new URL(window.location.href), process.env.NODE_ENV)
    const consent = readTrackingConsent(window)
    const analytics = eligible && consent.analytics
    analyticsAllowed.current = analytics
    initializeGtm(window, eligible ? containerId : null, consent, process.env.NODE_ENV, 'advanced')
    setAnalyticsGranted(analytics)
    if (analytics) setMountAnalytics(true)
    void flushBookingFunnel(window, process.env.NODE_ENV)
  }, [containerId])

  useEffect(() => {
    const flush = () => { void flushBookingFunnel(window, process.env.NODE_ENV) }
    const stopDiagnostics = installTrackingHealthResponder(window, process.env.NODE_ENV, containerId)
    const onStorage = (event: StorageEvent) => {
      if (event.key?.startsWith(FUNNEL_STORAGE_PREFIX)) flush()
    }
    window.addEventListener(GTM_READY_EVENT, flush)
    window.addEventListener('storage', onStorage)
    window.addEventListener('online', refresh)
    const unsubscribe = subscribeToTrackingConsent(window, refresh)
    const stopLocation = subscribeToTrackingLocation(window, refresh)
    refresh()
    return () => {
      unsubscribe()
      stopDiagnostics()
      stopLocation()
      window.removeEventListener(GTM_READY_EVENT, flush)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('online', refresh)
    }
  }, [refresh])

  const beforeSend: BeforeSend = event => {
    // Keep this guard after consent is withdrawn. The library script can
    // remain installed for the lifetime of the document.
    if (!analyticsAllowed.current || !readTrackingConsent(window).analytics || event.type !== 'pageview' ||
        !canMeasureLocation(new URL(window.location.href), process.env.NODE_ENV)) return null
    const url = sanitizeMeasurementUrl(event.url, process.env.NODE_ENV)
    return url ? { ...event, url } : null
  }

  return <>
    <Suspense fallback={null}><PublicPageViews enabled={explicitPageViews && Boolean(containerId) && analyticsGranted} refresh={refresh} /></Suspense>
    {mountAnalytics && <Analytics beforeSend={beforeSend} />}
  </>
}
