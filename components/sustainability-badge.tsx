'use client'
import { useState } from 'react'
import { validateHeroMedia } from '@/lib/website-heroes'

export function sustainabilityImage(value: unknown): string {
  try { return validateHeroMedia(value ?? '', 'image', true) } catch { return '' }
}

export function SustainabilityBadge({ image, first, second, caption }: { image?: string; first: string; second: string; caption: string }) {
  const src = sustainabilityImage(image)
  const [failed, setFailed] = useState<string | null>(null)
  const showImage = !!src && failed !== src
  return <div className="sus-badge">
    <span className="sus-ring" aria-hidden="true" style={showImage ? { visibility: 'hidden' } : undefined} />
    <b aria-hidden={showImage || undefined} style={showImage ? { visibility: 'hidden' } : undefined}>{first}<br /><strong>{second}</strong></b>
    <small aria-hidden={showImage || undefined} style={showImage ? { visibility: 'hidden' } : undefined}>{caption}</small>
    {showImage && <img src={src} alt={[first, second, caption].filter(Boolean).join(' — ') || 'Travel with purpose'} loading="lazy" decoding="async" onError={() => setFailed(src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />}
  </div>
}
