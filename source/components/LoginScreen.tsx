'use client'

import { useState, useRef, useEffect } from 'react'
import { Crosshair, Skull, Target, Settings } from 'lucide-react'
import MinterSettings from '@/components/MinterSettings'

interface LoginScreenProps {
  onLogin: () => void
  error?: string | null
}

const displayFont = { fontFamily: 'var(--font-display)' }
const bodyFont = { fontFamily: 'var(--font-body)' }

export default function LoginScreen({ onLogin, error }: LoginScreenProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleLogin = async () => {
    setIsLoading(true)
    try {
      await onLogin()
    } catch (err) {
      console.log('[v0] Login error:', err)
    }
    // If the user closes the Privy modal without authenticating,
    // `login()` resolves but the page stays on the login screen.
    // Without this fallback, the button stays stuck on "CONNECTING..."
    // and the user can't try again. Re-enable after a short delay so
    // the modal-close path doesn't trap them.
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setIsLoading(false), 1500)
  }

  return (
    <div className="w-full h-screen bg-[#12100e] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Flat warning stripes — no gradients */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#7a1515]" />
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#7a1515]" />
      <div className="absolute top-2 left-0 right-0 h-px bg-[#a35124]/60" />
      <div className="absolute bottom-2 left-0 right-0 h-px bg-[#a35124]/60" />

      {/* Title */}
      <div className="text-center mb-10 relative">
        <p
          className="text-[11px] text-[#a35124] tracking-[0.5em] mb-2"
          style={displayFont}
        >
          — OUTBREAK PROTOCOL —
        </p>
        <h1
          className="text-5xl text-[#d6ccb2] mb-1 tracking-[0.08em] leading-none"
          style={displayFont}
        >
          ZOMBIE
        </h1>
        <h1
          className="text-5xl text-[#7a1515] mb-4 tracking-[0.08em] leading-none"
          style={displayFont}
        >
          HUNTERS
        </h1>
        <p
          className="text-sm text-[#a3b83d] tracking-[0.2em]"
          style={displayFont}
        >
          AIM · SHOOT · EARN
        </p>
      </div>

      {/* Feature panel — flat stencil card */}
      <div className="border-2 border-[#4a3f38] bg-[#14100e] p-6 mb-10 max-w-xs w-full relative">
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#a3b83d]" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#a3b83d]" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#a3b83d]" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#a3b83d]" />

        <div className="space-y-5 text-sm">
          <div className="flex items-start gap-3">
            <Crosshair className="w-5 h-5 text-[#a35124] shrink-0 mt-0.5" />
            <div>
              <p
                className="text-[#d6ccb2] tracking-[0.1em]"
                style={displayFont}
              >
                EVERY HEADSHOT COUNTS
              </p>
              <p
                className="text-[#8a8270] text-xs mt-0.5"
                style={bodyFont}
              >
                Each kill mints a dog tag NFT on Base.
              </p>
            </div>
          </div>

          <div className="h-px bg-[#4a3f38]" />

          <div className="flex items-start gap-3">
            <Skull className="w-5 h-5 text-[#7a1515] shrink-0 mt-0.5" />
            <div>
              <p
                className="text-[#d6ccb2] tracking-[0.1em]"
                style={displayFont}
              >
                ENDLESS WAVES
              </p>
              <p
                className="text-[#8a8270] text-xs mt-0.5"
                style={bodyFont}
              >
                The dead get faster. So do you — or else.
              </p>
            </div>
          </div>

          <div className="h-px bg-[#4a3f38]" />

          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-[#a3b83d] shrink-0 mt-0.5" />
            <div>
              <p
                className="text-[#d6ccb2] tracking-[0.1em]"
                style={displayFont}
              >
                CLAIM YOUR TROPHIES
              </p>
              <p
                className="text-[#8a8270] text-xs mt-0.5"
                style={bodyFont}
              >
                Collect every tag. Prove you survived.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Surface auth failures (most often: user dismissed the SIWE
          signature prompt after the wallet connected) so they know
          they need to APPROVE the signature, not just connect. */}
      {error && (
        <div
          className="border-2 border-[#7a1515] bg-[#3d0808] px-4 py-3 mb-4 max-w-xs w-full"
          role="alert"
        >
          <p
            className="text-[#d6ccb2] text-[10px] tracking-[0.3em] mb-1"
            style={displayFont}
          >
            SIGN-IN INCOMPLETE
          </p>
          <p
            className="text-[#d6ccb2] text-xs leading-relaxed"
            style={bodyFont}
          >
            {error}
          </p>
        </div>
      )}

      {/* Enlist button — flat stencil style, no gradient */}
      <button
        onClick={handleLogin}
        disabled={isLoading}
        className="w-56 py-4 px-8 border-2 border-[#a3b83d] bg-[#14100e] text-[#a3b83d] hover:bg-[#a3b83d] hover:text-[#14100e] disabled:opacity-50 disabled:cursor-not-allowed text-lg tracking-[0.25em] transition-colors mb-3"
        style={displayFont}
      >
        {isLoading ? 'CONNECTING...' : 'ENLIST'}
      </button>

      {/* Dashboard — opens the minter settings modal so the player can
          choose between embedded wallet (silent), connected wallet
          (signs each tx), or pasted private key (silent). The choice
          persists in localStorage and is applied next time they mint. */}
      <button
        onClick={() => setSettingsOpen(true)}
        className="w-56 py-3 px-8 border border-[#4a3f38] bg-transparent text-[#8a8270] hover:text-[#d6ccb2] hover:border-[#d6ccb2] text-xs tracking-[0.25em] transition-colors mb-6 flex items-center justify-center gap-2"
        style={displayFont}
      >
        <Settings className="w-3.5 h-3.5" aria-hidden="true" />
        DASHBOARD
      </button>

      {/* Footer */}
      <p
        className="text-center text-[#8a8270] text-[11px] max-w-xs tracking-wider leading-relaxed"
        style={bodyFont}
      >
        Connect your Web3 wallet to join the fight. Email and Google sign-in
        are also available — a wallet will be created for you automatically.
      </p>

      <MinterSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}
