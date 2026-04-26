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
        // Keep wallet as the primary path (it was working originally)
        // but list email/google as fallback methods that Privy offers
        // on the same modal. NOTE: each method here MUST also be
        // enabled in the Privy dashboard (dashboard.privy.io →
        // Login methods) — if a method is listed here but disabled
        // there, Privy can throw "Could not log in" without details.
        loginMethods: ['wallet', 'email', 'google'],
        appearance: {
          theme: 'dark',
          accentColor: '#a3b83d',
          showWalletLoginFirst: true,
        },
        // Auto-create an embedded wallet for users who sign in via
        // email/google so they always end up with a usable address.
        // The installed Privy SDK requires the nested
        // `embeddedWallets.ethereum.createOnLogin` shape.
        // `showWalletUIs: false` is the critical bit for the game:
        // it makes EVERY transaction sent from the embedded wallet
        // silent — no Privy modal, no per-tx confirmation prompt —
        // which is what allows the kill-to-mint flow to feel
        // instantaneous and run entirely in the background.
        // (External wallets like MetaMask/Coinbase still show their
        // own native confirmation; that's a wallet security feature
        // and cannot be bypassed by Privy.)
        embeddedWallets: {
          showWalletUIs: false,
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        // `defaultChain` tells Privy which network to spin embedded
        // wallets up on. We intentionally do NOT pass `supportedChains`
        // — restricting it to only Base prevents users whose external
        // wallet is on a different chain from completing sign-in,
        // which is the regression that broke wallet login. The mint
        // code switches to Base at transaction time, so allowing any
        // chain here is safe.
        defaultChain: base,
      }}
    >
      {children}
    </PrivyProvider>
  )
}
