'use client'

import { useState } from 'react'
import { useMintingWallet, NFT_CONTRACT_ADDRESS } from '@/hooks/useMintingWallet'

interface Props {
  open: boolean
  onClose: () => void
  privyWalletAddress: string
}

export default function MintingDashboard({ open, onClose, privyWalletAddress }: Props) {
  const {
    address,
    balance,
    isConfigured,
    mintFunction,
    importWallet,
    removeWallet,
    refreshBalance,
    updateMintFunction,
  } = useMintingWallet()

  const [keyInput, setKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!open) return null

  const handleImport = () => {
    setError('')
    setSuccess('')
    try {
      importWallet(keyInput)
      setKeyInput('')
      setSuccess('Minting wallet imported successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError(e?.message || 'Failed to import wallet')
    }
  }

  const handleRemove = () => {
    if (confirm('Remove minting wallet? Your private key will be cleared from this device.')) {
      removeWallet()
      setSuccess('Wallet removed')
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  const lowBalance = parseFloat(balance) < 0.001

  return (
    <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-50 overflow-y-auto pointer-events-auto">
      <div className="min-h-full p-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-2">
          <h2 className="text-2xl font-black text-orange-500">MINT WALLET</h2>
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 rounded-full w-10 h-10 flex items-center justify-center text-white text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Status Badge */}
        <div
          className={`rounded-xl p-4 mb-4 border-2 ${
            isConfigured
              ? 'bg-green-900/30 border-green-600'
              : 'bg-yellow-900/30 border-yellow-600'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <div
              className={`w-3 h-3 rounded-full ${
                isConfigured ? 'bg-green-500' : 'bg-yellow-500'
              } animate-pulse`}
            />
            <p className="text-sm font-bold text-white">
              {isConfigured ? 'MINTER READY' : 'MINTER NOT CONFIGURED'}
            </p>
          </div>
          <p className="text-xs text-gray-300">
            {isConfigured
              ? 'Silent minting enabled. NFTs will mint to your Privy wallet.'
              : 'Import a funded wallet below to enable NFT minting on kills.'}
          </p>
        </div>

        {/* Receiver Info */}
        <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800">
          <p className="text-xs text-gray-400 mb-2">NFT RECIPIENT (YOUR PRIVY WALLET)</p>
          <p className="text-xs font-mono text-white break-all">{privyWalletAddress}</p>
        </div>

        {/* Contract Info */}
        <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800">
          <p className="text-xs text-gray-400 mb-2">NFT CONTRACT (BASE)</p>
          <p className="text-xs font-mono text-white break-all mb-2">{NFT_CONTRACT_ADDRESS}</p>
          <a
            href={`https://basescan.org/address/${NFT_CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-orange-400 underline"
          >
            View on BaseScan
          </a>
        </div>

        {/* Minting Wallet */}
        {isConfigured && address ? (
          <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-orange-600/50">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-gray-400">MINTING WALLET</p>
              <button
                onClick={refreshBalance}
                className="text-xs text-orange-400 underline"
              >
                Refresh
              </button>
            </div>
            <p className="text-xs font-mono text-white break-all mb-3">{address}</p>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-400 mb-1">BALANCE</p>
                <p
                  className={`text-lg font-black ${
                    lowBalance ? 'text-red-400' : 'text-green-400'
                  }`}
                >
                  {parseFloat(balance).toFixed(5)} ETH
                </p>
              </div>
              {lowBalance && (
                <p className="text-xs text-red-400 font-bold">LOW BALANCE</p>
              )}
            </div>
            {lowBalance && (
              <p className="text-xs text-gray-400 mt-2">
                Send Base ETH to this address to pay for mint gas fees.
              </p>
            )}

            {/* Mint function selector */}
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-400 mb-2">MINT FUNCTION NAME</p>
              <select
                value={mintFunction}
                onChange={(e) => updateMintFunction(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="mint">mint(address)</option>
                <option value="safeMint">safeMint(address)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Change if your contract uses a different mint function name.
              </p>
            </div>

            <button
              onClick={handleRemove}
              className="w-full mt-4 py-2 bg-red-900/50 hover:bg-red-900 border border-red-700 rounded-lg text-sm font-bold text-white"
            >
              Remove Wallet
            </button>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800">
            <p className="text-sm font-bold text-white mb-3">IMPORT MINTING WALLET</p>
            <p className="text-xs text-gray-400 mb-3">
              Paste the private key of a funded Base wallet. This wallet will pay gas to mint NFTs to your Privy wallet after every kill.
            </p>

            <div className="relative mb-3">
              <input
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="0x..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 pr-16 text-sm text-white font-mono"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-orange-400 px-2 py-1"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>

            <button
              onClick={handleImport}
              disabled={!keyInput.trim()}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 rounded-lg text-sm font-black text-white transition-all"
            >
              IMPORT WALLET
            </button>
          </div>
        )}

        {/* Feedback */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4 text-sm text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-900/50 border border-green-700 rounded-lg p-3 mb-4 text-sm text-green-200">
            {success}
          </div>
        )}

        {/* Security warning */}
        <div className="bg-gray-900 rounded-xl p-4 border border-yellow-700/50">
          <p className="text-xs font-bold text-yellow-400 mb-2">SECURITY NOTICE</p>
          <ul className="text-xs text-gray-300 space-y-1 list-disc pl-4">
            <li>Private key is stored only on this device (localStorage).</li>
            <li>It is never sent to any server.</li>
            <li>Use a disposable wallet with small balance only.</li>
            <li>Clear your browser data to remove the key.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
