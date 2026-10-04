'use client'

import { useState } from 'react'
import { Globe } from 'lucide-react'

/**
 * Complete real-flag component for EVERY country in the canonical dataset
 * (`data/countries.ts`). Uses the lightweight flagcdn image set
 * (`https://flagcdn.com/w80/<iso>.png`, 2x via w160) so there is no
 * manually maintained subset and no ISO-letter placeholder circles.
 * Circular presentation is preserved via CSS (`app/globals.css`).
 * Reliable in Windows / Edge / Chrome; no emoji flags.
 */
export function CountryFlag({ code, size = 20 }: { code: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const normalized = (code ?? '').trim().toLowerCase()

  if (!normalized || failed) {
    return (
      <span className="country-flag country-flag-unknown" style={{ width: size, height: size }} aria-hidden="true">
        <Globe style={{ width: size * 0.6, height: size * 0.6 }} />
      </span>
    )
  }

  return (
    <span className="country-flag" style={{ width: size, height: size }} aria-hidden="true">
      <img
        src={`https://flagcdn.com/w80/${normalized}.png`}
        srcSet={`https://flagcdn.com/w160/${normalized}.png 2x`}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
      />
    </span>
  )
}
