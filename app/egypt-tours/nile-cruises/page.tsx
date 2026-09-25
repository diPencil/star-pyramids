import type { Metadata } from 'next'
import { NileCruisesPage } from '@/components/nile-cruises-page'

export const metadata: Metadata = {
  title: 'Nile Cruises | STAR PYRAMIDS',
  description: 'Sail between ancient Egyptian temples with comfort, service, and unforgettable Nile views. Choose from standard, deluxe, superior, and luxury cruise options.',
}

export default function Page() {
  return <NileCruisesPage />
}
