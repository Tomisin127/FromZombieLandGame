'use client'

interface GameOverProps {
  score: number
  walletAddress: string
  onPlayAgain: () => void
  onLogout: () => void
}

const displayFont = { fontFamily: 'var(--font-display)' }
const bodyFont = { fontFamily: 'var(--font-body)' }

export default function GameOver({
  score,
  walletAddress,
  onPlayAgain,
  onLogout,
}: GameOverProps) {
  const nftsMinted = Math.floor(score / 5)

  return (
    <div className="absolute inset-0 bg-[#12100e]/95 backdrop-blur flex flex-col items-center justify-center p-4 z-50">
      {/* Blood drip border strip */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-[#7a1515]" />
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-[#7a1515]" />

      <div className="text-center max-w-sm w-full">
        {/* Title */}
        <h1
          className="text-[56px] text-[#7a1515] mb-1 tracking-[0.1em] leading-none"
          style={displayFont}
        >
          YOU DIED
        </h1>
        <p
          className="text-xs text-[#8a8270] tracking-[0.3em] mb-6"
          style={displayFont}
        >
          — THE HORDE WON THIS ROUND —
        </p>

        {/* Stats block — flat panel with stencil accents */}
        <div className="border-2 border-[#7a1515] bg-[#14100e] p-6 space-y-5 relative">
          {/* Stencil corner tags */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#a3b83d]" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#a3b83d]" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#a3b83d]" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#a3b83d]" />

          {/* Kills */}
          <div>
            <p
              className="text-[11px] text-[#a35124] mb-1 tracking-[0.3em]"
              style={displayFont}
            >
              CONFIRMED KILLS
            </p>
            <p
              className="text-[64px] text-[#d6ccb2] leading-none"
              style={displayFont}
            >
              {score}
            </p>
          </div>

          <div className="h-px bg-[#4a3f38]" />

          {/* NFTs */}
          <div>
            <p
              className="text-[11px] text-[#a3b83d] mb-1 tracking-[0.3em]"
              style={displayFont}
            >
              TAGS MINTED
            </p>
            <p
              className="text-[52px] text-[#a3b83d] leading-none"
              style={displayFont}
            >
              {nftsMinted}
            </p>
            <p
              className="text-[11px] text-[#8a8270] mt-2"
              style={bodyFont}
            >
              Stashed in your Base wallet — dog tags of the fallen.
            </p>
          </div>

          <div className="h-px bg-[#4a3f38]" />

          {/* Wallet */}
          <div>
            <p
              className="text-[11px] text-[#8a8270] mb-1 tracking-[0.3em]"
              style={displayFont}
            >
              SURVIVOR ID
            </p>
            <p
              className="text-[11px] text-[#d6ccb2] break-all"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {walletAddress}
            </p>
          </div>
        </div>

        {/* Buttons — flat, military */}
        <div className="flex flex-col gap-3 w-full mt-6">
          <button
            onClick={onPlayAgain}
            className="w-full py-4 px-6 border-2 border-[#a3b83d] bg-[#14100e] text-[#a3b83d] hover:bg-[#a3b83d] hover:text-[#14100e] text-lg tracking-[0.2em] transition-colors"
            style={displayFont}
          >
            BACK INTO THE FIGHT
          </button>

          <button
            onClick={onLogout}
            className="w-full py-3 px-6 border border-[#4a3f38] bg-transparent text-[#8a8270] hover:text-[#d6ccb2] hover:border-[#d6ccb2] text-sm tracking-[0.2em] transition-colors"
            style={displayFont}
          >
            ABANDON SURVIVOR
          </button>
        </div>
      </div>
    </div>
  )
}
