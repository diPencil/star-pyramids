'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PublicAppearancePortal } from './public-appearance'
import { Globe2, X } from 'lucide-react'
import { tx, useLocale, type Currency, type Locale } from './locale'
import { ENABLED_LOCALES, LOCALE_LABELS, LOCALE_SHORT_LABELS, type EnabledLocale } from '@/lib/locale-config'

const copy = {
  en: { modalTitle: 'Language and Currency', curTitle: 'Currency', regTitle: 'Region and Language', soon: 'Soon', comingSoon: 'Coming soon' },
  es: { modalTitle: 'Idioma y Moneda', curTitle: 'Moneda', regTitle: 'Región e Idioma', soon: 'Próximamente', comingSoon: 'Próximamente' },
  it: { modalTitle: 'Lingua e Valuta', curTitle: 'Valuta', regTitle: 'Regione e Lingua', soon: 'Presto', comingSoon: 'Presto' },
  ar: { modalTitle: 'اللغة والعملة', curTitle: 'العملة', regTitle: 'المنطقة واللغة', soon: 'قريبًا', comingSoon: 'قريبًا' },
} as const

export function LanguageModal({ locale, currency, onClose, onSelect, onCurrency }: { locale: Locale; currency: Currency; onClose: () => void; onSelect: (locale: EnabledLocale) => void; onCurrency: (currency: Currency) => void }) {
  const text = copy[locale]
  const currencies = [
    [tx(locale, { en: 'US Dollar', es: 'Dólar estadounidense', it: 'Dollaro statunitense', ar: 'الدولار الأمريكي' }), '$ USD', 'USD'],
    [tx(locale, { en: 'Euro', es: 'Euro', it: 'Euro', ar: 'اليورو' }), '€ EUR', 'EUR'],
    [tx(locale, { en: 'Egyptian Pound', es: 'Libra egipcia', it: 'Sterlina egiziana', ar: 'الجنيه المصري' }), '£ EGP', 'EGP'],
  ] as const
  const regionNames = {
    en: tx(locale, { en: 'United States', es: 'Estados Unidos', it: 'Stati Uniti', ar: 'الولايات المتحدة' }),
    es: tx(locale, { en: 'Spain', es: 'España', it: 'Spagna', ar: 'إسبانيا' }),
    it: tx(locale, { en: 'Italy', es: 'Italia', it: 'Italia', ar: 'إيطاليا' }),
  }
  const regions = ENABLED_LOCALES.map((value) => [regionNames[value], LOCALE_LABELS[value], value] as const)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  const node = <div className="language-backdrop" role="presentation" onMouseDown={onClose}><div className="language-modal" role="dialog" aria-modal="true" aria-labelledby="language-title" onMouseDown={event => event.stopPropagation()}><div className="language-modal-head"><h2 id="language-title">{text.modalTitle}</h2><button className="language-close" onClick={onClose} aria-label={tx(locale, { en: 'Close language and currency', es: 'Cerrar idioma y moneda', it: 'Chiudi lingua e valuta', ar: 'إغلاق اللغة والعملة' })}><X size={20} /></button></div><h3>{text.curTitle}</h3><div className="language-options currency-options">{currencies.map(([name, code, value]) => <button key={code} className={currency === value ? 'selected' : ''} onClick={() => { onCurrency(value); onClose() }} aria-pressed={currency === value}><span>{name}</span><strong>{code}</strong></button>)}</div><h3>{text.regTitle}</h3><div className="language-options region-options">{regions.map(([region, language, value]) => <button key={region} type="button" className={value === locale ? 'selected' : ''} onClick={() => { onSelect(value); onClose() }} aria-pressed={value === locale}><span>{region}</span><strong>{language}</strong></button>)}</div></div></div>
  return createPortal(<PublicAppearancePortal>{node}</PublicAppearancePortal>, document.body)
}

export function LanguageToggle({ label, onOpen }: { label: string; onOpen: () => void }) {
  const { locale } = useLocale()
  return <button className="language" onClick={onOpen} aria-label={tx(locale, { en: 'Open language and currency', es: 'Abrir idioma y moneda', it: 'Apri lingua e valuta', ar: 'فتح اللغة والعملة' })}><Globe2 size={18} /><span className="language-label-full">{label}</span><span className="language-label-compact">{label.split(' - ')[0]}</span></button>
}

export function LanguageSelector() {
  const { locale, setLocale, currency, setCurrency } = useLocale()
  const [open, setOpen] = useState(false)
  return <>
    <LanguageToggle label={LOCALE_SHORT_LABELS[locale] + ' - ' + currency} onOpen={() => setOpen(true)} />
    {open && <LanguageModal locale={locale} currency={currency} onClose={() => setOpen(false)} onSelect={setLocale} onCurrency={setCurrency} />}
  </>
}
