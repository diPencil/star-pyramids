'use client'

import type { ReactNode } from 'react'

type ReviewMarqueeProps<T> = {
  ariaLabel: string
  getKey: (item: T) => string
  items: T[]
  renderItem: (item: T, isClone: boolean) => ReactNode
}

export function ReviewMarquee<T>({ ariaLabel, getKey, items, renderItem }: ReviewMarqueeProps<T>) {
  const seen = new Set<string>()
  const uniqueItems = items.filter(item => { const key = getKey(item); if (seen.has(key)) return false; seen.add(key); return true })
  if (!uniqueItems.length) return null
  // Sparse feeds are real cards, not a repeated rail that looks like many reviews.
  if (uniqueItems.length < 4) return <div className="rev-marquee rev-marquee-static" role="region" aria-label={ariaLabel}>
    {uniqueItems.map(item => <div className="rev-marquee-item" key={getKey(item)}>{renderItem(item, false)}</div>)}
  </div>
  const loopItems = uniqueItems

  return <div className="rev-marquee" role="region" aria-label={ariaLabel}>
    <div className="rev-marquee-track">
      {[false, true].map(isSecondGroup => <div key={String(isSecondGroup)} className="rev-marquee-group" aria-hidden={isSecondGroup || undefined}>
        {loopItems.map((item, index) => {
          const isClone = isSecondGroup || index >= uniqueItems.length
          return <div key={`${getKey(item)}-${index}`} className="rev-marquee-item" aria-hidden={isClone || undefined}>
            {renderItem(item, isClone)}
          </div>
        })}
      </div>)}
    </div>
  </div>
}
