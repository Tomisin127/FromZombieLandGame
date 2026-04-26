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

export const metadata: Metadata = {
  title: 'Zombie FPS Game',
  description: 'Play and earn with blockchain FPS gameplay',
  generator: 'v0.app',
  // Base Mini App attribution — links this app to its Base app id so
  // mints made from the game count toward the Base app's stats.
  other: {
    'base:app_id': '69ea74e2269d5b14147c9057',
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
