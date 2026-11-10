'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'

/** Shared focus/scroll behavior for the two authenticated mobile sidebars. */
export function useMobileDrawer({ open, onClose, panel, trigger, query }: {
  open: boolean
  onClose: () => void
  panel: RefObject<HTMLElement | null>
  trigger: RefObject<HTMLButtonElement | null>
  query: string
}) {
  const [mobile, setMobile] = useState(false)
  const closeRef = useRef(onClose)
  const openRef = useRef(open)
  closeRef.current = onClose
  openRef.current = open

  useEffect(() => {
    const media = window.matchMedia(query)
    const sync = () => {
      setMobile(media.matches)
      if (!media.matches && openRef.current) closeRef.current()
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [query])

  useEffect(() => {
    if (!mobile || !open || !panel.current) return
    const sidebar = panel.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const controls = () => Array.from(sidebar.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.getClientRects().length > 0)
    controls()[0]?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
      }
      if (event.key !== 'Tab') return
      const items = controls()
      const first = items[0]
      const last = items[items.length - 1]
      if (!first) { event.preventDefault(); return }
      if (!sidebar.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first)?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      trigger.current?.focus({ preventScroll: true })
    }
  }, [mobile, open, panel, trigger])

  return mobile
}
