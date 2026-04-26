'use client'

import { useEffect, useRef, useState } from 'react'
import { usePrivyMint } from '@/hooks/usePrivyMint'

interface GameHUDProps {
  kills: number
  difficulty: number
  walletAddress: string
  onLogout: () => void
  isPaused?: boolean
}

interface MintNotice {
  id: number
  status: 'pending' | 'success' | 'failed'
  kill: number
  hash?: string
  error?: string
}

const displayFont = { fontFamily: 'var(--font-display)' }
const bodyFont = { fontFamily: 'var(--font-body)' }

export default function GameHUD({
  kills,
  difficulty,
  walletAddress,
  onLogout,
}: GameHUDProps) {
  // Mint always runs through the user's Privy embedded wallet — even
  // if they signed in by connecting MetaMask, Privy provisions a
  // separate embedded wallet (createOnLogin:'all-users') that can sign
  // silently with no popup. `embeddedAddress` is where the player
  // funds gas; `balance` is the live ETH balance on Base.
  const { mint, isAvailable, embeddedAddress, balance, balanceWei } =
    usePrivyMint()
  const [nftsMinted, setNftsMinted] = useState(0)
  const [notices, setNotices] = useState<MintNotice[]>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const processedKillsRef = useRef<Set<number>>(new Set())
  const noticeCounterRef = useRef(0)

  // Track browser fullscreen state so the toggle button label stays
  // accurate when the user presses Esc to exit.
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.()
      } else {
        await document.exitFullscreen?.()
      }
    } catch (e) {
      console.log('[v0] Fullscreen toggle failed:', e)
    }
  }

  // Trigger a silent mint on every kill the player gets.
  useEffect(() => {
    if (
      kills > 0 &&
      !processedKillsRef.current.has(kills) &&
      isAvailable
    ) {
      processedKillsRef.current.add(kills)
      triggerMint(kills)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kills, isAvailable])

  const triggerMint = async (killNum: number) => {
    const noticeId = ++noticeCounterRef.current
    const pendingNotice: MintNotice = {
      id: noticeId,
      status: 'pending',
      kill: killNum,
    }
    setNotices((prev) => [...prev, pendingNotice])

    const result = await mint()

    setNotices((prev) =>
      prev.map((n) =>
        n.id === noticeId
          ? {
              ...n,
              status: result.success ? 'success' : 'failed',
              hash: result.hash,
              error: result.error,
            }
          : n,
      ),
    )

    if (result.success) {
      setNftsMinted((prev) => prev + 1)
    }

    setTimeout(() => {
      setNotices((prev) => prev.filter((n) => n.id !== noticeId))
    }, 4500)
  }

  const wave = Math.floor(difficulty / 2) + 1
  const pendingCount = notices.filter((n) => n.status === 'pending').length

  return (
    <>
      {/* Crosshair — blood red tactical reticle */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-2 border-[#7a1515] rounded-full opacity-80" />
          <div
            className="absolute inset-3 border border-[#d6ccb2] rounded-full"
            style={{ opacity: 0.55 }}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-[#7a1515]" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-[2px] bg-[#7a1515]" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-[2px] bg-[#7a1515]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-3 bg-[#7a1515]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[2px] h-3 bg-[#7a1515]" />
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 text-[#d6ccb2]">
        {/* Top HUD */}
        <div className="flex justify-between items-start gap-2 pointer-events-auto">
          <div className="flex flex-col gap-2">
            {/* Wallet Info */}
            <div
              className="border border-[#4a3f38] bg-[#14100e]/85 px-3 py-2"
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 92% 100%, 0 100%)' }}
            >
              <p
                className="text-[10px] text-[#a3b83d] leading-none mb-1 tracking-[0.25em]"
                style={displayFont}
              >
                SURVIVOR
              </p>
              <p
                className="text-xs text-[#d6ccb2]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </p>
            </div>

            {/* Minter — the silent embedded Privy wallet that signs
                every mint and pays gas. The player needs to fund THIS
                address (a few cents of Base ETH) for tagging to work.
                Tap-to-copy so they can quickly send funds to it. */}
            {embeddedAddress && (
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(embeddedAddress)
                }}
                className="border border-[#a3b83d]/50 bg-[#14100e]/85 px-3 py-2 text-left hover:bg-[#1a1614] transition-colors"
                style={{
                  clipPath:
                    'polygon(0 0, 100% 0, 100% 70%, 92% 100%, 0 100%)',
                }}
                aria-label="Copy minter wallet address"
              >
                <p
                  className="text-[10px] leading-none mb-1 tracking-[0.25em] text-[#a3b83d]"
                  style={displayFont}
                >
                  MINTER · TAP TO COPY
                </p>
                <p
                  className="text-xs text-[#d6ccb2]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {embeddedAddress.slice(0, 6)}...{embeddedAddress.slice(-4)}
                </p>
                <p
                  className="text-[10px] mt-1 tracking-[0.2em]"
                  style={{
                    ...displayFont,
                    color: balanceWei === 0n ? '#7a1515' : '#a3b83d',
                  }}
                >
                  {balance} ETH {balanceWei === 0n ? '· LOW FUEL' : ''}
                </p>
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 items-end">
            <button
              onClick={onLogout}
              className="border-2 border-[#7a1515] bg-[#3d0808] hover:bg-[#7a1515] px-4 py-2 text-sm text-[#d6ccb2] tracking-[0.2em] transition-colors"
              style={displayFont}
            >
              BAIL OUT
            </button>
            <button
              onClick={toggleFullscreen}
              className="border border-[#4a3f38] bg-[#14100e]/85 px-3 py-2 text-xs text-[#d6ccb2] tracking-[0.2em] hover:bg-[#2a231f] flex items-center gap-2"
              style={displayFont}
              aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            >
              {isFullscreen ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  aria-hidden="true"
                >
                  <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  aria-hidden="true"
                >
                  <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
                </svg>
              )}
              {isFullscreen ? 'EXIT FS' : 'FULLSCREEN'}
            </button>
          </div>
        </div>

        {/* Bottom HUD — pushed right so it never overlaps the joystick zone */}
        <div className="flex justify-end items-end pointer-events-auto gap-2 pr-1">
          <div className="border border-[#4a3f38] bg-[#14100e]/85 px-3 py-2 text-right min-w-[72px]">
            <p
              className="text-[9px] mb-1 tracking-[0.3em] text-[#a35124]"
              style={displayFont}
            >
              WAVE
            </p>
            <p
              className="text-2xl text-[#a35124] leading-none"
              style={displayFont}
            >
              {wave}
            </p>
          </div>

          <div className="border border-[#4a3f38] bg-[#14100e]/85 px-3 py-2 text-right min-w-[72px]">
            <p
              className="text-[9px] mb-1 tracking-[0.3em] text-[#7a1515]"
              style={displayFont}
            >
              KILLS
            </p>
            <p
              className="text-2xl text-[#d6ccb2] leading-none"
              style={displayFont}
            >
              {kills}
            </p>
          </div>

          <div className="border border-[#a3b83d]/50 bg-[#14100e]/85 px-3 py-2 text-right min-w-[72px]">
            <p
              className="text-[9px] mb-1 tracking-[0.3em] text-[#a3b83d]"
              style={displayFont}
            >
              TAGS
            </p>
            <p
              className="text-2xl text-[#a3b83d] leading-none"
              style={displayFont}
            >
              {nftsMinted}
            </p>
          </div>
        </div>
      </div>

      {/* Mint Notifications — pending / success / failed shown next to
          the kill so the player sees tagging happen in real time. */}
      <div className="absolute top-28 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col gap-2 z-30 items-center">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className={`px-4 py-2 border-2 shadow-lg transition-all max-w-[280px] ${
              notice.status === 'pending'
                ? 'bg-[#2a231f] border-[#a35124]'
                : notice.status === 'success'
                  ? 'bg-[#14100e] border-[#a3b83d]'
                  : 'bg-[#3d0808] border-[#7a1515]'
            }`}
          >
            {notice.status === 'pending' && (
              <p
                className="text-xs text-[#d6ccb2] animate-pulse tracking-[0.15em]"
                style={displayFont}
              >
                TAGGING KILL #{notice.kill}...
              </p>
            )}
            {notice.status === 'success' && (
              <>
                <p
                  className="text-xs text-[#a3b83d] tracking-[0.15em]"
                  style={displayFont}
                >
                  TAG CONFIRMED · KILL #{notice.kill}
                </p>
                {notice.hash && (
                  <a
                    href={`https://basescan.org/tx/${notice.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[#8a8270] mt-0.5 underline pointer-events-auto block"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {notice.hash.slice(0, 10)}...{notice.hash.slice(-6)}
                  </a>
                )}
              </>
            )}
            {notice.status === 'failed' && (
              <>
                <p
                  className="text-xs text-[#d6ccb2] tracking-[0.15em]"
                  style={displayFont}
                >
                  TAG LOST · KILL #{notice.kill}
                </p>
                <p
                  className="text-[10px] text-[#d6ccb2]/80 mt-0.5 leading-snug"
                  style={bodyFont}
                >
                  {notice.error}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Pending badge */}
      {pendingCount > 0 && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#a35124] border border-[#d6ccb2]/40 px-3 py-1 pointer-events-none"
          style={displayFont}
        >
          <p className="text-[10px] text-[#14100e] tracking-[0.2em]">
            {pendingCount} TAG{pendingCount > 1 ? 'S' : ''} PENDING
          </p>
        </div>
      )}
    </>
  )
}
