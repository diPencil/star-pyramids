import { Analytics } from '@vercel/analytics/next'
import { Alexandria, Montserrat } from 'next/font/google'
import type { Metadata, Viewport } from 'next'

const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat', display: 'swap' })
const alexandria = Alexandria({ subsets: ['arabic'], weight: ['400', '500', '600', '700', '800'], variable: '--font-alexandria', display: 'swap' })
import './globals.css'

export const metadata: Metadata = {
  title: 'STAR PYRAMIDS | Discover Egypt',
description: 'Discover ancient wonders, warm hospitality, and unforgettable journeys across Egypt.',
  icons: {
    icon: [
      {
        url: '/favicon.png',
        type: 'image/png',
      },
    ],
    apple: '/favicon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${montserrat.variable} ${alexandria.variable} antialiased`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
