'use client'

import { useState, useEffect, useRef } from 'react'
import { usePrivy, useLogin } from '@privy-io/react-auth'
import LoginScreen from '@/components/LoginScreen'
import GameHUD from '@/components/GameHUD'
import GameOver from '@/components/GameOver'
import GameContainer from '@/components/GameContainer'
import Joystick, { type JoystickVector } from '@/components/Joystick'

export default function Home() {
  // `ready` flips to true once Privy finishes loading its SDK. Until
  // then, `login()` is a no-op and `authenticated`/`user` are stale, so
  // we MUST gate the UI on it — otherwise pressing ENLIST too early
  // does nothing and the wallet never connects.
  const { ready, authenticated, user, logout } = usePrivy()
  const [loginError, setLoginError] = useState<string | null>(null)

  // useLogin gives us explicit success/error callbacks so we can detect
  // the "connected but didn't sign SIWE" case (which is the most common
  // reason the wallet appears connected but the user never advances
  // past the login screen) and tell the user what to do about it.
  const { login } = useLogin({
    onComplete: ({ user }) => {
      console.log('[v0] Privy login complete:', user.id)
      setLoginError(null)
    },
    onError: (error) => {
      console.log('[v0] Privy login error:', error)
      // Common values: 'exited_auth_flow', 'user_rejected_signature',
      // 'generic_connect_wallet_error'. Map these to friendly text.
      const msg = String(error)
      if (/rejected|denied|exited|cancel/i.test(msg)) {
        setLoginError(
          'Sign-in cancelled. Your wallet connected, but you need to APPROVE the signature request to enter the game.',
        )
      } else {
        setLoginError(`Sign-in failed: ${msg}`)
      }
    },
  })
  const [gameState, setGameState] = useState({
    kills: 0,
    difficulty: 0,
    gameOver: false,
    isPaused: false,
  })
  const [mounted, setMounted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const movementRef = useRef<JoystickVector>({ x: 0, y: 0 })

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync fullscreen state with the browser's actual fullscreen element so
  // the wrapper expands/contracts whether fullscreen was triggered by a
  // button or escaped via the Esc key.
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const handleKill = async (newKillCount: number) => {
    setGameState(prev => ({
      ...prev,
      kills: newKillCount,
      difficulty: Math.floor(newKillCount / 5), // Increase difficulty every 5 kills
    }))

    // Trigger every 5th kill (every NFT mint)
    if (newKillCount % 5 === 0) {
      console.log('[v0] Triggering NFT mint for kill #' + newKillCount)
      // NFT minting will be handled in GameHUD
    }

    // Game over at 100 kills
    if (newKillCount >= 100) {
      setGameState(prev => ({ ...prev, gameOver: true }))
    }
  }

  const handleGameOver = () => {
    setGameState(prev => ({ ...prev, gameOver: true }))
  }

  const resetGame = () => {
    setGameState({
      kills: 0,
      difficulty: 0,
      gameOver: false,
      isPaused: false,
    })
  }

  if (!mounted) return null

  // Block UI until Privy SDK is ready — otherwise the login button does
  // nothing because `login()` is queued behind SDK initialization.
  if (!ready) {
    return (
      <div className="w-full h-screen bg-[#12100e] flex items-center justify-center">
        <p
          className="text-[#a3b83d] text-sm tracking-[0.4em]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          ESTABLISHING UPLINK...
        </p>
      </div>
    )
  }

  if (!authenticated || !user) {
    return <LoginScreen onLogin={login} error={loginError} />
  }

  const walletAddress = user.wallet?.address || ''

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black overflow-hidden">
      {/* In fullscreen, drop the mobile-portrait max-w so the game fills
          the entire screen on tablets/desktops. */}
      <div
        className={`relative w-full h-full mx-auto bg-black ${
          isFullscreen ? '' : 'max-w-md'
        }`}
      >
        {/* Game Canvas - fills entire container */}
        <div className="absolute inset-0">
          <GameContainer
            gameState={gameState}
            onKill={handleKill}
            onGameOver={handleGameOver}
            movementRef={movementRef}
          />
        </div>

        {/* HUD Overlay */}
        {!gameState.gameOver && (
          <GameHUD
            kills={gameState.kills}
            difficulty={gameState.difficulty}
            walletAddress={walletAddress}
            onLogout={logout}
            isPaused={gameState.isPaused}
          />
        )}

        {/* Movement Joystick (bottom-left) */}
        {!gameState.gameOver && <Joystick movementRef={movementRef} />}

        {/* Game Over Screen */}
        {gameState.gameOver && (
          <GameOver
            score={gameState.kills}
            walletAddress={walletAddress}
            onPlayAgain={resetGame}
            onLogout={logout}
          />
        )}
      </div>
    </div>
  )
}
