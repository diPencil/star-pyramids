'use client'
import { useEffect, useRef, useState } from 'react'
import { Monitor, Smartphone, Tablet } from 'lucide-react'
export function CmsDevicePreview({ src, revision, dirty }: { src: string; revision: number; dirty: boolean }) {
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [containerWidth, setContainerWidth] = useState(0)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => { const node = container.current; if (!node) return; const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width)); observer.observe(node); return () => observer.disconnect() }, [])
  const width = { desktop: 1440, tablet: 768, mobile: 375 }[device]
  const scale = containerWidth ? Math.min(1, containerWidth / width) : 0
  return <section className="cms-device-preview"><header><h3>Saved draft preview</h3><div>{([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([id, Icon]) => <button className="sp-btn" type="button" key={id} aria-pressed={device === id} title={id} aria-label={id + ' preview'} onClick={() => setDevice(id)}><Icon size={18} /></button>)}</div></header>
    {dirty && <p role="status">Save the draft to refresh the preview.</p>}
    <div ref={container} className="cms-device-surface" style={{ height: 1000 * scale }}><iframe key={src + revision} title={device + ' saved page preview'} src={src} tabIndex={-1} style={{ width, height: 1000, transform: `scale(${scale})` }} /></div>
  </section>
}
