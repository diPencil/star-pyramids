import { NavigationProvider } from '@/components/navigation-context'
import { publishedNavigation } from '@/lib/server/navigation'
import { Analytics } from '@vercel/analytics/next'
import { Alexandria, Montserrat } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import Script from 'next/script'
import { BrandFavicon } from '@/components/brand-favicon'
import { InitialLocaleProvider } from '@/components/locale'
import { EnquiryHistoryTracking } from '@/components/enquiry-history-tracking'
import { getServerLocale, getHtmlLang, getOgLocale } from '@/lib/server/locale'
import { getSiteUrl } from '@/lib/seo'
import { readPresentationStates, readPublishedPage } from '@/lib/server/page-sections'
import { PresentationProvider } from '@/components/presentation-content-context'
import { getSetting } from '@/lib/server/settings'
import { getGlobalSeo } from '@/lib/server/global-seo'
import { readPublishedAppearance } from '@/lib/server/website-appearance'
import { PublicAppearance } from '@/components/public-appearance'
import { getTrackingSettings } from '@/lib/server/tracking'
import {
  buildGtmIntegrationSnippet,
  isTrackingExcludedPath,
  isValidGtmContainerId,
} from '@/lib/tracking'

// Optimize font loading: preload critical weights, use display: swap
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
  preload: true, // Preload Montserrat as it's used site-wide
  fallback: ['system-ui', 'Arial', 'sans-serif'],
})

const alexandria = Alexandria({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-alexandria',
  display: 'swap',
  preload: false, // Arabic only loads when dir=rtl (lazy)
  fallback: ['system-ui', 'Arial', 'sans-serif'],
})

import './globals.css'
import './mobile-shell.css'

const SITE_NAME = 'STAR PYRAMIDS'
const SITE_DESCRIPTION = 'Discover ancient wonders, warm hospitality, and unforgettable journeys across Egypt.'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const ogLocale = getOgLocale(locale)
  const siteUrl = await getSiteUrl()
  const favicon = await getSetting('site.favicon').catch(() => null)
  const defaultSeoTitle = await getSetting('site.seoTitle').catch(() => null)
  const globalSeo = await getGlobalSeo(locale).catch(() => ({} as Metadata))

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: defaultSeoTitle || `${SITE_NAME} | Discover Egypt`,
      template: `%s | ${SITE_NAME}`,
    },
    description: globalSeo.description || SITE_DESCRIPTION,
    ...(globalSeo.verification ? { verification: globalSeo.verification } : {}),
    keywords: ['Egypt tours', 'Nile cruises', 'Cairo day tours', 'Egypt travel', 'pyramids', 'luxor', 'aswan', 'shore excursions'],
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    openGraph: {
      type: 'website',
      locale: ogLocale,
      url: siteUrl,
      siteName: SITE_NAME,
      title: `${SITE_NAME} | Discover Egypt`,
      description: SITE_DESCRIPTION,
      ...globalSeo.openGraph,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE_NAME} | Discover Egypt`,
      description: SITE_DESCRIPTION,
      ...globalSeo.twitter,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: siteUrl,
      languages: {
        en: siteUrl,
        'x-default': siteUrl,
      },
    },
    icons: {
      icon: [
        {
          url: favicon || '/favicon.png',
        },
      ],
      apple: favicon || '/favicon.png',
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getServerLocale()
  const htmlLang = getHtmlLang(locale)
  const requestHeaders = await headers()
  const tracking = await getTrackingSettings()
  const currentPath = requestHeaders.get('x-sp-path') || '/'
  const gtmContainerId =
    tracking.enabled && !isTrackingExcludedPath(currentPath) && isValidGtmContainerId(tracking.containerId)
      ? tracking.containerId
      : ''

  return (
    <html lang={htmlLang} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {gtmContainerId && (
          <Script id="gtm-loader" strategy="beforeInteractive">
            {buildGtmIntegrationSnippet(gtmContainerId)}
          </Script>
        )}
        {/* Preconnect to Google Fonts for faster font loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Preload hero image for LCP optimization */}
        <link rel="preload" as="image" href="/egypt-hero.png" />
      </head>
      <body className={`${montserrat.variable} ${alexandria.variable} antialiased`}>
        {gtmContainerId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmContainerId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
              title="Google Tag Manager"
            />
          </noscript>
        )}
        <BrandFavicon />
        <EnquiryHistoryTracking />
        <NavigationProvider initial={await publishedNavigation().catch(() => ({ revision: -1, primaryLocale: 'en' as const, items: [] }))}><InitialLocaleProvider locale={locale}><PresentationProvider states={{ ...await readPresentationStates(), faq: await readPublishedPage('faq') }}><PublicAppearance tokens={await readPublishedAppearance()}>{children}</PublicAppearance></PresentationProvider></InitialLocaleProvider></NavigationProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
