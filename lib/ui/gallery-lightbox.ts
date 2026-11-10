/** Shared deterministic navigation and DOM lifecycle, testable without a browser. */
export function galleryNextIndex(index: number, delta: number, count: number) {
  return count < 1 ? -1 : ((index + delta) % count + count) % count
}

export function stopGalleryVideo(video: HTMLVideoElement | null) {
  if (video) { video.pause(); video.removeAttribute('src'); video.load() }
}

export function bindGalleryDialog(doc: Document, dialog: HTMLElement, close: () => void, navigate: (delta: number) => void) {
  const previous = doc.activeElement as HTMLElement | null
  const overflow = doc.body.style.overflow
  doc.body.style.overflow = 'hidden'
  const controls = () => [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], video[controls], iframe, [tabindex="0"]')].filter(node => !node.hidden)
  ;(controls()[0] ?? dialog).focus()
  const keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return }
    const target = event.target as HTMLElement | null
    // Preserve native player keyboard controls.
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (target?.tagName === 'VIDEO' || target?.tagName === 'IFRAME') return
      event.preventDefault(); navigate(event.key === 'ArrowRight' ? 1 : -1)
    }
    if (event.key !== 'Tab') return
    const nodes = controls(), first = nodes[0], last = nodes[nodes.length - 1]
    if (!first) { event.preventDefault(); dialog.focus(); return }
    if (event.shiftKey && (doc.activeElement === first || !dialog.contains(doc.activeElement))) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && (doc.activeElement === last || !dialog.contains(doc.activeElement))) { event.preventDefault(); first.focus() }
  }
  doc.addEventListener('keydown', keydown)
  return () => {
    dialog.querySelectorAll<HTMLVideoElement>('video').forEach(stopGalleryVideo)
    doc.removeEventListener('keydown', keydown)
    doc.body.style.overflow = overflow
    if (previous?.isConnected) previous.focus({ preventScroll: true })
  }
}
