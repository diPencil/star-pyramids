"use client"

import { Children, type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react"

type HorizontalSliderProps = {
  children: ReactNode
  className: string
  ariaLabel: string
  previousLabel: string
  nextLabel: string
  autoAdvanceMs?: number
  rotationLabels?: { pause: string; play: string }
  arrowsOnly?: boolean
  footerAction?: ReactNode
}

export function HorizontalSlider({
  children,
  className,
  ariaLabel,
  previousLabel,
  nextLabel,
  autoAdvanceMs = 4200,
  rotationLabels,
  arrowsOnly = false,
  footerAction,
}: HorizontalSliderProps) {
  const items = Children.toArray(children)
  const trackRef = useRef<HTMLDivElement>(null)
  const interaction = useRef({ hovered: false, focused: false, touching: false, last: 0 })
  const indexRef = useRef(0)
  const [stopped, setStopped] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [positions, setPositions] = useState([0])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const measure = () => {
      const first = track.children.item(0) as HTMLElement | null
      const max = Math.max(0, track.scrollWidth - track.clientWidth)
      const measured = Array.from(track.children, (child) => {
        const raw = (child as HTMLElement).offsetLeft - (first?.offsetLeft ?? 0)
        return Math.round(Math.max(-max, Math.min(max, raw)))
      }).filter((value, index, values) => values.indexOf(value) === index)
      const next = measured.length ? measured : [0]
      setPositions((current) => current.join(",") === next.join(",") ? current : next)
      const nearest = next.reduce((best, position, index) => Math.abs(position - track.scrollLeft) < Math.abs(next[best] - track.scrollLeft) ? index : best, 0)
      indexRef.current = nearest
      setActiveIndex(nearest)
    }

    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(track)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [items.length])

  const scrollToPosition = useCallback((index: number) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    trackRef.current?.scrollTo({ left: positions[index] ?? 0, behavior: reduced ? "auto" : "smooth" })
  }, [positions])

  const goTo = useCallback((requestedIndex: number) => {
    if (!positions.length) return
    const nextIndex = (requestedIndex + positions.length) % positions.length
    scrollToPosition(nextIndex)
    indexRef.current = nextIndex
    setActiveIndex(nextIndex)
  }, [positions, scrollToPosition])

  useEffect(() => {
    if (positions.length < 2 || items.length < 2 || stopped || autoAdvanceMs <= 0) return
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const timer = window.setInterval(() => {
      const state = interaction.current
      const track = trackRef.current
      if (!track || motion.matches || document.visibilityState === 'hidden' || state.hovered || state.focused || state.touching || Date.now() - state.last < autoAdvanceMs) return
      const bounds = track.getBoundingClientRect()
      if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) return
      goTo(indexRef.current + 1)
    }, autoAdvanceMs)
    return () => window.clearInterval(timer)
  }, [autoAdvanceMs, positions.length, items.length, goTo, stopped])

  const syncActivePosition = () => {
    const current = trackRef.current?.scrollLeft ?? 0
    const nearest = positions.reduce((best, position, index) => Math.abs(position - current) < Math.abs(positions[best] - current) ? index : best, 0)
    indexRef.current = nearest
    setActiveIndex(nearest)
  }

  if (!items.length) return null

  const navigation = positions.length > 1 && <div className="horizontal-slider-nav">
    <button type="button" onClick={() => goTo(indexRef.current - 1)} aria-label={previousLabel}><ArrowLeft size={18}/></button>
    {!arrowsOnly && (rotationLabels ? <span className="horizontal-slider-count" aria-hidden="true">{activeIndex + 1} / {positions.length}</span> : <div className="horizontal-slider-dots" aria-hidden="true">
      {positions.map((position, index) => <span key={position} className={activeIndex === index ? "active" : ""}/>)}
    </div>)}
    <button type="button" onClick={() => goTo(indexRef.current + 1)} aria-label={nextLabel}><ArrowRight size={18}/></button>
    {!arrowsOnly && rotationLabels && <button type="button" aria-label={stopped ? rotationLabels.play : rotationLabels.pause} onClick={() => {
      setStopped(!stopped)
      if (stopped) interaction.current = { hovered: false, focused: false, touching: false, last: 0 }
    }}>{stopped ? <Play size={16}/> : <Pause size={16}/>}</button>}
  </div>

  return <div
    className="horizontal-slider"
    onMouseEnter={() => { interaction.current.hovered = true }}
    onMouseLeave={() => { interaction.current.hovered = false }}
    onFocusCapture={() => { interaction.current.focused = true }}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) interaction.current.focused = false }}
    onPointerDown={() => { interaction.current.touching = true }}
    onPointerUp={() => { interaction.current.touching = false; interaction.current.last = Date.now() }}
    onPointerCancel={() => { interaction.current.touching = false; interaction.current.last = Date.now() }}
    onPointerLeave={() => { interaction.current.touching = false }}
    onWheel={() => { interaction.current.last = Date.now() }}
  >
    <div ref={trackRef} className={className} aria-label={ariaLabel} role="region" tabIndex={0} onScroll={syncActivePosition} onKeyDown={(event) => {
      if (event.target !== event.currentTarget || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      interaction.current.last = Date.now()
      goTo(event.key === 'Home' ? 0 : event.key === 'End' ? positions.length - 1 : indexRef.current + (event.key === 'ArrowLeft' ? -1 : 1))
    }}>{items}</div>
    {footerAction ? <div className="horizontal-slider-footer">{navigation}<div className="horizontal-slider-action">{footerAction}</div></div> : navigation}
  </div>
}
