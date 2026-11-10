'use client'

import { useEffect, useMemo, useState } from "react";
import { countries, defaultCountry } from "@/data/countries";
import { useInquiries, readImpersonation, type ImpersonatedCustomer } from "@/lib/admin-store";
import { useCustomerProfile, type CustomerProfile } from "@/lib/account/customer-account";
import { useAuthenticatedUser } from "@/components/authenticated-user";


export function useImpersonated() {
  const [impersonated, setImpersonated] = useState<ImpersonatedCustomer | null>(null)
  useEffect(() => {
    const sync = () => setImpersonated(readImpersonation())
    sync()
    window.addEventListener('sp-impersonate', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('sp-impersonate', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return impersonated
}

export function useVisibleInquiries() {
  const impersonated = useImpersonated()
  const inquiries = useInquiries()
  return useMemo(() => {
    if (!impersonated) return inquiries
    return inquiries.filter((inquiry) => inquiry.name.toLowerCase() === impersonated.name.toLowerCase())
  }, [impersonated, inquiries])
}

function useAccountProfile(): CustomerProfile {
  const user = useAuthenticatedUser()
  const stored = useCustomerProfile()
  // Memoized: consumers sync this value into local form state via
  // `useEffect(..., [current])`. A fresh object identity on every render
  // retriggered those effects endlessly ("Maximum update depth exceeded"),
  // which broke client-side navigation out of profile/settings pages.
  // `user` (context) and `stored` (useState) are both referentially stable.
  return useMemo(() => {
    const emailMatches = stored.email.trim().toLowerCase() === user.email.trim().toLowerCase()
    const selectedCountry = countries.find((country) => country.code === user.countryCode) ?? defaultCountry
    const emailName = user.email.split('@')[0] || 'traveler'
    const firstName = user.firstName || emailName
    const lastName = user.lastName || ''
    return {
      ...stored,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      username: user.username || emailName.replace(/[^A-Za-z0-9_]/g, '_'),
      email: user.email,
      country: selectedCountry.code,
      dialCode: selectedCountry.dialCode,
      phone: user.phone || '',
      avatar: emailMatches ? stored.avatar : '',
    }
  }, [user, stored])
}

export { useAccountProfile }
