'use client'

import { createContext, useContext, useState, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode, type Dispatch, type SetStateAction } from 'react'
import { Tabs } from '@base-ui/react/tabs'
import { ENABLED_LOCALES, LOCALE_LABELS, type EnabledLocale } from '@/lib/locale-config'
import { removeTranslationRow, type CatalogueTranslations } from '@/lib/catalogue-translations'

type LanguageContext = { locale: EnabledLocale; translations: CatalogueTranslations; setTranslations: Dispatch<SetStateAction<CatalogueTranslations>> }
const Context = createContext<LanguageContext | null>(null)
export function useContentLanguage() { return useContext(Context) }

export function ContentLanguageTabs({ translations, setTranslations, children }: Omit<LanguageContext, 'locale'> & { children: ReactNode }) {
  const [locale, setLocale] = useState<EnabledLocale>('en')
  return <Context.Provider value={{ locale, translations, setTranslations }}>
    <Tabs.Root value={locale} onValueChange={(value) => { const next = ENABLED_LOCALES.find((entry) => entry === value); if (next) setLocale(next) }} className="sp-builder-languages">
      <Tabs.List className="sp-builder-language-tabs" aria-label="Content language">{ENABLED_LOCALES.map((entry) => <Tabs.Tab key={entry} value={entry}>{LOCALE_LABELS[entry]}</Tabs.Tab>)}</Tabs.List>
      <Tabs.Panel value={locale} className="sp-form" lang={locale}>{children}</Tabs.Panel>
    </Tabs.Root>
  </Context.Provider>
}

function useTranslatedProps(field: string, value: InputHTMLAttributes<HTMLInputElement>['value']) {
  const context = useContentLanguage()
  if (!context || context.locale === 'en') return { value, update: (_text: string) => {} }
  const { locale, translations, setTranslations } = context
  return {
    value: translations[locale]?.[field] ?? '',
    update: (text: string) => setTranslations((current) => {
      const entries = { ...current[locale] }
      if (text) entries[field] = text
      else delete entries[field]
      const next = { ...current }
      if (Object.keys(entries).length) next[locale] = entries
      else delete next[locale]
      return next
    }),
  }
}

export function TranslatedInput({ field, value, onChange, ...props }: InputHTMLAttributes<HTMLInputElement> & { field: string }) {
  const context = useContentLanguage()
  const translated = useTranslatedProps(field, value)
  return <input {...props} value={translated.value} onChange={context?.locale === 'en' || !context ? onChange : (event) => translated.update(event.target.value)} />
}

export function TranslatedTextarea({ field, value, onChange, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { field: string }) {
  const context = useContentLanguage()
  const translated = useTranslatedProps(field, value)
  return <textarea {...props} value={translated.value} onChange={context?.locale === 'en' || !context ? onChange : (event) => translated.update(event.target.value)} />
}

export function removeContentRow(context: LanguageContext | null, prefix: string | undefined, index: number) {
  if (context && prefix) context.setTranslations((current) => removeTranslationRow(current, prefix, index))
}
