'use client'

import { useEffect, useState } from 'react'
import { countryByCode, countryFromPhone, internationalPhone, nationalPhone } from '@/data/countries'
import { stripTrunkZero } from '@/lib/phone'
import { CountrySelect } from '@/components/country-select'

type InternationalPhoneInputProps = {
  value: string
  onChange: (value: string) => void
  locale?: 'en' | 'ar'
  id?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
  maxLength?: number
  countryCode?: string
  onCountryChange?: (countryCode: string) => void
  invalid?: boolean
  describedBy?: string
  className?: string
}

export function InternationalPhoneInput({ value, onChange, locale = 'en', id, required, disabled, placeholder, maxLength = 24, countryCode: controlledCountryCode, onCountryChange, invalid, describedBy, className = '' }: InternationalPhoneInputProps) {
  const [internalCountryCode, setInternalCountryCode] = useState(() => countryFromPhone(value).code)
  const countryCode = controlledCountryCode ?? internalCountryCode
  const selectedCountry = countryByCode(countryCode)

  useEffect(() => {
    if (controlledCountryCode || !value.trim().startsWith('+')) return
    setInternalCountryCode(countryFromPhone(value).code)
  }, [controlledCountryCode, value])

  const selectCountry = (nextCode: string) => {
    const nextCountry = countryByCode(nextCode)
    const local = nationalPhone(value, selectedCountry.dialCode)
    if (controlledCountryCode === undefined) setInternalCountryCode(nextCountry.code)
    onCountryChange?.(nextCountry.code)
    onChange(internationalPhone(nextCountry.dialCode, local))
  }

  return <span className={`international-phone-field ${className}`.trim()}>
    <CountrySelect
      variant="phone"
      value={selectedCountry.code}
      onChange={selectCountry}
      locale={locale}
      disabled={disabled}
      label={locale === 'ar' ? `الدولة وكود الاتصال: ${selectedCountry.nameAr} (${selectedCountry.dialCode})` : `Country and calling code: ${selectedCountry.name} (${selectedCountry.dialCode})`}
    />
    <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" dir="ltr" required={required} disabled={disabled} value={nationalPhone(value, selectedCountry.dialCode)} onChange={(event) => onChange(internationalPhone(selectedCountry.dialCode, stripTrunkZero(selectedCountry.code, event.target.value)))} placeholder={placeholder ?? (locale === 'ar' ? 'رقم الهاتف' : 'Phone number')} maxLength={maxLength} aria-invalid={invalid} aria-describedby={describedBy} />
  </span>
}
