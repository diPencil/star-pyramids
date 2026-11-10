'use client'
import { useEffect, useRef } from 'react'

/** Re-read moderated public data on return; never optimistically publish a submission. */
export function useReviewRefresh(reload: () => void, enabled = true) {
  const latest = useRef({ reload, enabled })
  latest.current = { reload, enabled }
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== 'hidden' && latest.current.enabled) latest.current.reload() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
}
