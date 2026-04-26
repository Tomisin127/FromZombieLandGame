'use client'

import { ReactNode } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'

export default function RootLayoutClient({
  children,
}: {
  children: ReactNode
}) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  // If no app ID, render children without Privy provider (fallback for build time)
  if (!appId) {
    return <>{children}</>
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#ff6b00',
        },
      }}
    >
      {children}
    </PrivyProvider>
  )
}
