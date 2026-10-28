'use client'

export type AdminLocale = 'en' | 'ar'

// This legacy helper controls the English/Arabic admin chrome only.
// Content and supported EN/ES/IT editors keep their separate locale controls.
// Arabic is disabled; a stale browser preference must not enable it.
export function useAdminLocale(): AdminLocale {
  return 'en'
}
