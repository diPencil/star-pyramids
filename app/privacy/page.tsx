import type { Metadata } from 'next'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/privacy')

  return {
    title: 'Privacy Policy',
    description: 'STAR PYRAMIDS privacy policy. Learn how we collect, use, and protect your personal information when you book Egypt tours and travel services.',
    alternates: { canonical: `${siteUrl}/privacy`, languages: hreflang },
  }
}

export default function Page() {
  return <div className="privacy-page"><h1>Privacy Policy</h1><p>STAR PYRAMIDS privacy policy. Learn how we collect, use, and protect your personal information when you book Egypt tours and travel services.</p></div>
}