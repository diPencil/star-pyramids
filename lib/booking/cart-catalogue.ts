'use client'

import { useMemo } from 'react'
import type { Tour } from '@/data/types'
import type { CartItem } from './cart'
import { estimateCart } from './booking'
import { useDbToursStatus } from '../tours/tours-client'

const EMPTY_TOURS: readonly Tour[] = []

/** One live catalogue contract for cart, checkout and the account cart estimate. */
export function useCartCatalogue(items: readonly CartItem[]) {
  const catalogue = useDbToursStatus(EMPTY_TOURS, { includeNew: true })
  const ready = catalogue.data !== null && !catalogue.loading && !catalogue.error
  const estimate = useMemo(() => estimateCart(items, catalogue.data ?? EMPTY_TOURS), [items, catalogue.data])
  return { ...catalogue, ready, estimate }
}
