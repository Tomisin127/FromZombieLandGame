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

// Base App / Farcaster embed metadata. dashboard.base.org reads this tag
// when you submit your URL — without it you get "web resource must have metadata".
const miniappEmbed = {
  version: '1',
  imageUrl: `${ROOT_URL}/hero.png`,
  button: {
    title: 'Play Zombie FPS',
    action: {
      type: 'launch_miniapp',
      name: 'Zombie FPS Game',
      url: ROOT_URL,
      splashImageUrl: `${ROOT_URL}/splash.png`,
      splashBackgroundColor: '#12100e',
    },
  },
}

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
    // Base App ID — base.dev reads this to identify the app. Without it you
    // get "App ID not found in meta tag" when submitting on dashboard.base.org.
    'base:app_id': '69ea74e2269d5b14147c9057',
    // Farcaster / Base App in-feed embed (current spec)
    'fc:miniapp': JSON.stringify(miniappEmbed),
    // Backwards-compat: older clients still read fc:frame
    'fc:frame': JSON.stringify(miniappEmbed),
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
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
      <body className="font-sans antialiased bg-[#12100e] text-[#d6ccb2]">
        <RootLayoutClient>
          {children}
        </RootLayoutClient>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
