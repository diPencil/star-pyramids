'use client'

import type { ReactNode } from 'react'

type ReviewMarqueeProps<T> = {
  ariaLabel: string
  getKey: (item: T) => string
  items: T[]
  renderItem: (item: T, isClone: boolean) => ReactNode
}

export function ReviewMarquee<T>({ ariaLabel, getKey, items, renderItem }: ReviewMarqueeProps<T>) {
  if (items.length === 0) return null

  const repeatCount = Math.max(1, Math.ceil(6 / items.length))
  const loopItems = Array.from({ length: repeatCount }, () => items).flat()

  return <div className="rev-marquee" role="region" aria-label={ariaLabel}>
    <div className="rev-marquee-track">
      {[false, true].map(isSecondGroup => <div key={String(isSecondGroup)} className="rev-marquee-group" aria-hidden={isSecondGroup || undefined}>
        {loopItems.map((item, index) => {
          const isClone = isSecondGroup || index >= items.length
          return <div key={`${getKey(item)}-${index}`} className="rev-marquee-item" aria-hidden={isClone || undefined}>
            {renderItem(item, isClone)}
          </div>
        })}
      </div>)}
    </div>
  </div>
}
