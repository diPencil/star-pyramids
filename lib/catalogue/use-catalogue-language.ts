'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useLocale } from '@/components/locale'
import { localizeCatalogue, type CatalogueKind, type TranslatedContent } from './catalogue-translations'

export function useCatalogueLanguage<T extends { slug: string } & TranslatedContent>(rows: T[], kind: CatalogueKind): T[] {
  const { locale } = useLocale()
  const pathname = usePathname()
  // Editors always receive the canonical record; switching the website language
  // must never replace English values in an admin mutation payload.
  const editor = pathname?.startsWith('/admin')
  return useMemo(() => editor ? rows : rows.map((row) => localizeCatalogue(row, kind, locale)), [rows, kind, locale, editor])
}
