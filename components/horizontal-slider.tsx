"use client"

import { Children, type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"

type HorizontalSliderProps = {
  children: ReactNode
  className: string
  ariaLabel: string
  previousLabel: string
  nextLabel: string
  autoAdvanceMs?: number
}

export function HorizontalSlider({
  children,
  className,
  ariaLabel,
  previousLabel,
  nextLabel,
  autoAdvanceMs = 4200,
}: HorizontalSliderProps) {
  const items = Children.toArray(children)
  const trackRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [positions, setPositions] = useState([0])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const measure = () => {
      const first = track.children.item(0) as HTMLElement | null
      if (!first) return
      const max = Math.max(0, track.scrollWidth - track.clientWidth)
      const measured = Array.from(track.children, (child) => {
        const raw = (child as HTMLElement).offsetLeft - first.offsetLeft
        return Math.round(Math.max(-max, Math.min(max, raw)))
      }).filter((value, index, values) => values.indexOf(value) === index)
      const next = measured.length ? measured : [0]
      setPositions((current) => current.join(",") === next.join(",") ? current : next)
      setActiveIndex((current) => Math.min(current, next.length - 1))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => observer.disconnect()
  }, [items.length])

  const scrollToPosition = useCallback((index: number) => {
    trackRef.current?.scrollTo({ left: positions[index] ?? 0, behavior: "smooth" })
  }, [positions])

  const goTo = useCallback((requestedIndex: number) => {
    if (!positions.length) return
    const nextIndex = (requestedIndex + positions.length) % positions.length
    scrollToPosition(nextIndex)
    setActiveIndex(nextIndex)
  }, [positions, scrollToPosition])

  useEffect(() => {
    if (positions.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = window.setInterval(() => {
      if (!pausedRef.current) setActiveIndex((current) => {
        const nextIndex = (current + 1) % positions.length
        scrollToPosition(nextIndex)
        return nextIndex
      })
    }, autoAdvanceMs)
    return () => window.clearInterval(timer)
  }, [autoAdvanceMs, positions.length, scrollToPosition])

  const syncActivePosition = () => {
    const current = trackRef.current?.scrollLeft ?? 0
    const nearest = positions.reduce((best, position, index) => Math.abs(position - current) < Math.abs(positions[best] - current) ? index : best, 0)
    setActiveIndex(nearest)
  }

  return <div
    className="horizontal-slider"
    onMouseEnter={() => { pausedRef.current = true }}
    onMouseLeave={() => { pausedRef.current = false }}
    onFocusCapture={() => { pausedRef.current = true }}
    onBlurCapture={() => { pausedRef.current = false }}
  >
    <div ref={trackRef} className={className} aria-label={ariaLabel} role="region" onScroll={syncActivePosition}>{items}</div>
    {positions.length > 1 && <div className="horizontal-slider-nav">
      <button type="button" onClick={() => goTo(activeIndex - 1)} aria-label={previousLabel}><ArrowLeft size={18}/></button>
      <div className="horizontal-slider-dots" aria-hidden="true">
        {positions.map((position, index) => <span key={position} className={activeIndex === index ? "active" : ""}/>) }
      </div>
      <button type="button" onClick={() => goTo(activeIndex + 1)} aria-label={nextLabel}><ArrowRight size={18}/></button>
    </div>}
  </div>
}
