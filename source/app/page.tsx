'use client'

import { useState, useEffect, useRef } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import LoginScreen from '@/components/LoginScreen'
import GameHUD from '@/components/GameHUD'
import GameOver from '@/components/GameOver'
import GameContainer from '@/components/GameContainer'
import Joystick, { type JoystickVector } from '@/components/Joystick'

export default function Home() {
  const { user, login, logout } = usePrivy()
  const [gameState, setGameState] = useState({
    kills: 0,
    difficulty: 0,
    gameOver: false,
    isPaused: false,
  })
  const [isLoading, setIsLoading] = useState(false)
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

  if (!user) {
    return <LoginScreen onLogin={login} />
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
