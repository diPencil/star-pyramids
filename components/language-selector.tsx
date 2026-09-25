'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Globe2, X } from 'lucide-react'
import { useLocale, type Currency, type Locale } from './locale'

const copy = {
  en: { modalTitle: 'Language and Currency', curTitle: 'Currency', regTitle: 'Region and Language', soon: 'Soon', comingSoon: 'Coming soon' },
  ar: { modalTitle: 'اللغة والعملة', curTitle: 'العملة', regTitle: 'المنطقة واللغة', soon: 'قريبًا', comingSoon: 'قريبًا' },
} as const

export function LanguageModal({ locale, currency, onClose, onSelect, onCurrency }: { locale: Locale; currency: Currency; onClose: () => void; onSelect: (locale: Locale) => void; onCurrency: (currency: Currency) => void }) {
  const text = copy[locale]
  const currencies = [['US Dollar', '$ USD', 'USD'], ['Euro', '€ EUR', 'EUR'], ['Egyptian Pound', '£ EGP', 'EGP']] as const
  const regions = [['United States', 'English', 'en'], ['Egypt', 'العربية', 'ar'], ['France', 'Français', null], ['Germany', 'Deutsch', null], ['Italy', 'Italiano', null], ['Portugal', 'Português', null], ['Spain', 'Español', null], ['China', '中文', null]] as const
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  const node = <div className="language-backdrop" role="presentation" onMouseDown={onClose}><div className="language-modal" role="dialog" aria-modal="true" aria-labelledby="language-title" onMouseDown={event => event.stopPropagation()}><div className="language-modal-head"><h2 id="language-title">{text.modalTitle}</h2><button className="language-close" onClick={onClose} aria-label="Close language and currency"><X size={20} /></button></div><h3>{text.curTitle}</h3><div className="language-options currency-options">{currencies.map(([name, code, value]) => <button key={code} className={currency === value ? 'selected' : ''} onClick={() => { onCurrency(value); onClose() }} aria-pressed={currency === value}><span>{name}</span><strong>{code}</strong></button>)}</div><h3>{text.regTitle}</h3><div className="language-options region-options">{regions.map(([region, language, value]) => value === null ? <button key={region} type="button" disabled aria-disabled="true" title={text.comingSoon}><span>{region}</span><strong>{language}</strong><em className="lang-soon">{text.soon}</em></button> : <button key={region} type="button" className={value === locale ? 'selected' : ''} onClick={() => { onSelect(value); onClose() }} aria-pressed={value === locale}><span>{region}</span><strong>{language}</strong></button>)}</div></div></div>
  return createPortal(node, document.body)
}

export function LanguageToggle({ label, onOpen }: { label: string; onOpen: () => void }) {
  return <button className="language" onClick={onOpen} aria-label="Open language and currency"><Globe2 size={18} /><span className="language-label-full">{label}</span><span className="language-label-compact">{label.split(' - ')[0]}</span></button>
}

export function LanguageSelector() {
  const { locale, setLocale, currency, setCurrency } = useLocale()
  const [open, setOpen] = useState(false)
  return <>
    <LanguageToggle label={(locale === 'ar' ? 'AR' : 'EN') + ' - ' + currency} onOpen={() => setOpen(true)} />
    {open && <LanguageModal locale={locale} currency={currency} onClose={() => setOpen(false)} onSelect={setLocale} onCurrency={setCurrency} />}
  </>
}
