import type { Locale } from '@/lib/locale-config';

export function getCopy<C extends { readonly en: unknown }>(
  copy: C,
  locale: Locale,
): C['en'] {
  return (copy[locale as keyof C] ?? copy.en) as C['en'];
}

export function getCopyWithFallback<C extends { readonly en: unknown }>(
  copy: C,
  locale: Locale,
): C['en'] {
  return getCopy(copy, locale);
}
