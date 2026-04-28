import type { Metadata, Viewport } from 'next'
import { Black_Ops_One, Special_Elite, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import RootLayoutClient from './layout-client'

// Display font — military/stencil, evokes apocalypse warning signs
const blackOps = Black_Ops_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
})
// Body font — worn typewriter, gritty survivor-journal feel
const specialElite = Special_Elite({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-body',
})
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

// Public URL of the deployed app. Set NEXT_PUBLIC_URL in your Vercel project
// (e.g. https://your-app.vercel.app or your custom domain). Falls back to the
// Vercel-provided production URL during build.
const ROOT_URL =
  process.env.NEXT_PUBLIC_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(ROOT_URL),
  title: 'Zombie FPS Game',
  description: 'Play and earn with blockchain FPS gameplay',
  generator: 'v0.app',
  openGraph: {
    title: 'Zombie FPS Game',
    description: 'Play and earn with blockchain FPS gameplay',
    url: ROOT_URL,
    siteName: 'Zombie FPS Game',
    images: [{ url: `${ROOT_URL}/hero.png`, width: 1200, height: 630 }],
    type: 'website',
  },
  other: {
    // Base App ID — dashboard.base.org reads this exact meta tag to verify
    // ownership and register the app. Per the April 2026 Base migration,
    // this is the ONLY tag base.dev needs from the site itself; the legacy
    // fc:miniapp / farcaster.json manifest are no longer used.
    'base:app_id': '69ea74e2269d5b14147c9057',
  },
  // All icon paths point to assets that actually exist in /public.
  // base.dev's scraper attempts to load these — when they 404 it reports
  // "web resource must have metadata", because from its perspective the
  // app card has no usable icon/preview to render.
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`bg-[#12100e] ${blackOps.variable} ${specialElite.variable} ${geistMono.variable}`}
    >
      <head>
        {/*
          base.dev / dashboard.base.org reads this exact meta tag to verify
          ownership of the app. We intentionally render it as a literal JSX
          tag in <head> (in addition to also declaring it via the Metadata
          API in `metadata.other` above) so it is GUARANTEED to appear in
          the initial server-rendered HTML before any next/font, viewport,
          or analytics tags. base.dev's scraper has been observed to miss
          tags that are synthesized later in the head, so this belt-and-
          suspenders placement is the most reliable fix for the
          "web resource must have metadata" error.
        */}
        <meta name="base:app_id" content="69ea74e2269d5b14147c9057" />
      </head>
      <body className="font-sans antialiased bg-[#12100e] text-[#d6ccb2]">
        <RootLayoutClient>
          {children}
        </RootLayoutClient>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
