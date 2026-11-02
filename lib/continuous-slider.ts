/** Recycle the existing grid cards, preserving their React identity and live controls. */
export function bindContinuousSlider(track: HTMLElement, options: { canMove: () => boolean; onOverflow: (count: number) => void; pixelsPerSecond?: number }) {
  const cards = Array.from(track.children) as HTMLElement[]
  const orders = cards.map(card => card.style.order)
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let offset = 0, phase = track.scrollLeft, step = 0, overflow = false, loop = false
  let remaining = 0, last = 0, frame = 0, disposed = false
  const reorder = () => cards.forEach((card, index) => { card.style.order = String((index - offset + cards.length) % cards.length) })
  const measure = () => {
    const width = cards[0]?.getBoundingClientRect().width ?? 0
    const gap = Number.parseFloat(window.getComputedStyle(track).columnGap) || 0
    const next = width + gap
    if (!width || !track.clientWidth) return
    const fraction = step ? track.scrollLeft / step : 0
    step = next
    const available = cards.length * width + Math.max(0, cards.length - 1) * gap - track.clientWidth
    overflow = available > 1
    // An entire outgoing card must fit offscreen before it can be recycled.
    loop = available >= step - 1 && cards.length > 1
    options.onOverflow(overflow ? cards.length : 1)
    phase = Math.min(Math.max(0, fraction * step), Math.max(0, available))
    if (!loop) { offset = 0; remaining = 0 }
    reorder()
    track.scrollLeft = phase
  }
  const shift = (distance: number) => {
    phase += distance
    const turns = Math.floor((phase + 0.000001) / step)
    if (turns) {
      phase -= turns * step
      offset = ((offset + turns) % cards.length + cards.length) % cards.length
      reorder()
    }
    if (Math.abs(phase) < 0.000001) phase = 0
    track.scrollLeft = phase
  }
  const cancelManual = () => { remaining = 0 }
  const tick = (time: number) => {
    if (disposed) return
    const elapsed = last ? Math.min(64, time - last) / 1000 : 0
    last = time
    const bounds = track.getBoundingClientRect()
    const visible = document.visibilityState !== 'hidden' && bounds.bottom > 0 && bounds.top < window.innerHeight
    if (visible && loop) {
      if (remaining) {
        const delta = motion.matches ? remaining : Math.sign(remaining) * Math.min(Math.abs(remaining), step * elapsed / 0.35)
        shift(delta); remaining -= delta
      } else if (!motion.matches && options.canMove()) {
        // Read native touch/wheel position when resuming, including a manual drag.
        if (Math.abs(track.scrollLeft - phase) > 1) phase = track.scrollLeft
        shift((options.pixelsPerSecond ?? 40) * elapsed)
      } else phase = track.scrollLeft
    }
    frame = window.requestAnimationFrame(tick)
  }
  measure()
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
  observer?.observe(track)
  window.addEventListener('resize', measure)
  track.addEventListener('pointerdown', cancelManual)
  track.addEventListener('wheel', cancelManual, { passive: true })
  frame = window.requestAnimationFrame(tick)
  return {
    move(direction: number) {
      if (!overflow || !step) return
      phase = track.scrollLeft
      if (!loop) {
        const max = Math.max(0, track.scrollWidth - track.clientWidth)
        track.scrollTo({ left: direction > 0 ? (phase >= max - 1 ? 0 : max) : (phase <= 1 ? max : 0), behavior: motion.matches ? 'auto' : 'smooth' })
      } else if (motion.matches) shift(Math.sign(direction) * step)
      else remaining = Math.sign(direction) * step
    },
    jump(index: number) {
      remaining = 0; offset = Math.max(0, Math.min(cards.length - 1, index)); phase = 0
      reorder(); track.scrollLeft = 0
    },
    dispose() {
      disposed = true
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      track.removeEventListener('pointerdown', cancelManual)
      track.removeEventListener('wheel', cancelManual)
      cards.forEach((card, index) => { card.style.order = orders[index] })
      track.scrollLeft = 0
    },
  }
}
