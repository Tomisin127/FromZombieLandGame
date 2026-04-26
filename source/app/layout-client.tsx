'use client'

import { ReactNode } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'
import { base } from 'viem/chains'

const displayFont = { fontFamily: 'var(--font-display)' }
const bodyFont = { fontFamily: 'var(--font-body)' }

export default function RootLayoutClient({
  children,
}: {
  children: ReactNode
}) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  // If no app ID, render an explicit setup screen instead of silently
  // dropping the provider. Without this, any child that calls
  // `usePrivy()` would throw because there's no PrivyProvider in the
  // tree, which is exactly the failure mode that prevents the wallet
  // from connecting.
  if (!appId) {
    return (
      <div className="w-full h-screen bg-[#12100e] flex flex-col items-center justify-center px-6 text-center">
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#7a1515]" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#7a1515]" />

        <p
          className="text-[11px] text-[#a35124] tracking-[0.5em] mb-2"
          style={displayFont}
        >
          — SETUP REQUIRED —
        </p>
        <h1
          className="text-3xl text-[#d6ccb2] mb-1 tracking-[0.08em]"
          style={displayFont}
        >
          WALLET OFFLINE
        </h1>
        <h2
          className="text-3xl text-[#7a1515] mb-6 tracking-[0.08em]"
          style={displayFont}
        >
          NO RADIO LINK
        </h2>

        <div className="border-2 border-[#4a3f38] bg-[#14100e] p-5 max-w-md w-full text-left">
          <p
            className="text-[#d6ccb2] text-sm mb-3 tracking-[0.1em]"
            style={displayFont}
          >
            MISSING ENV VAR
          </p>
          <p
            className="text-[#8a8270] text-xs leading-relaxed mb-4"
            style={bodyFont}
          >
            The wallet connection can&apos;t initialize because
            <code className="text-[#a3b83d] mx-1">NEXT_PUBLIC_PRIVY_APP_ID</code>
            is not set on this deployment.
          </p>
          <p
            className="text-[#8a8270] text-xs leading-relaxed"
            style={bodyFont}
          >
            Add it in your project&apos;s environment variables (top-right
            settings menu &rarr; Vars), then redeploy. You can grab a Privy
            App ID from <span className="text-[#a3b83d]">dashboard.privy.io</span>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#a3b83d',
          showWalletLoginFirst: true,
        },
        // Auto-create an embedded wallet for users who sign in without
        // one so they always end up authenticated with a usable address.
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        // Match the chain we mint on so signed transactions don't get
        // rejected for being on the wrong network.
        defaultChain: base,
        supportedChains: [base],
      }}
    >
      {children}
    </PrivyProvider>
  )
}
