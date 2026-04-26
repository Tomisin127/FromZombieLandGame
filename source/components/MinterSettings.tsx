'use client'

import { useEffect, useState } from 'react'
import { privateKeyToAccount } from 'viem/accounts'
import {
  loadMintSettings,
  saveMintSettings,
  normalizePrivateKey,
  type MintMode,
  type MintSettings,
} from '@/lib/mintSettings'

interface MinterSettingsProps {
  open: boolean
  onClose: () => void
  onSaved?: (settings: MintSettings) => void
}

const displayFont = { fontFamily: 'var(--font-display)' }
const bodyFont = { fontFamily: 'var(--font-body)' }
const monoFont = { fontFamily: 'var(--font-mono)' }

export default function MinterSettings({ open, onClose, onSaved }: MinterSettingsProps) {
  const [mode, setMode] = useState<MintMode>('embedded')
  const [keyInput, setKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [derivedAddress, setDerivedAddress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  // Load whatever's currently saved when the modal opens so the form
  // reflects the active configuration.
  useEffect(() => {
    if (!open) return
    const current = loadMintSettings()
    setMode(current.mode)
    setKeyInput(current.privateKey ?? '')
    setError(null)
    setSavedFlash(false)
  }, [open])

  // Live-derive the address from the pasted key so the player can
  // verify they pasted the correct one before saving (and so they know
  // which address to fund).
  useEffect(() => {
    if (!keyInput.trim()) {
      setDerivedAddress(null)
      return
    }
    const normalized = normalizePrivateKey(keyInput)
    if (!normalized) {
      setDerivedAddress(null)
      return
    }
    try {
      setDerivedAddress(privateKeyToAccount(normalized).address)
    } catch {
      setDerivedAddress(null)
    }
  }, [keyInput])

  if (!open) return null

  const handleSave = () => {
    setError(null)
    let next: MintSettings
    if (mode === 'custom') {
      const normalized = normalizePrivateKey(keyInput)
      if (!normalized) {
        setError(
          'That does not look like a valid private key. Paste a 64-character hex string (with or without 0x prefix).',
        )
        return
      }
      next = { mode: 'custom', privateKey: normalized }
    } else {
      next = { mode }
    }
    saveMintSettings(next)
    setSavedFlash(true)
    onSaved?.(next)
    setTimeout(() => {
      setSavedFlash(false)
      onClose()
    }, 700)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#12100e]/90 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="minter-settings-title"
    >
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto border-2 border-[#4a3f38] bg-[#14100e] p-5">
        {/* Stencil corner brackets */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#a3b83d]" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#a3b83d]" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#a3b83d]" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#a3b83d]" />

        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p
              className="text-[10px] text-[#a35124] tracking-[0.4em] mb-1"
              style={displayFont}
            >
              {'— DASHBOARD —'}
            </p>
            <h2
              id="minter-settings-title"
              className="text-2xl text-[#d6ccb2] tracking-[0.1em] leading-none"
              style={displayFont}
            >
              MINTER SETTINGS
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="border border-[#4a3f38] text-[#8a8270] hover:text-[#d6ccb2] hover:border-[#d6ccb2] w-8 h-8 flex items-center justify-center text-lg leading-none"
          >
            {'×'}
          </button>
        </div>

        <p className="text-[#8a8270] text-xs leading-relaxed mb-5" style={bodyFont}>
          {
            'Choose which wallet signs and pays gas for every kill\u2019s NFT mint. Gas is always paid by the chosen wallet \u2014 there is no sponsorship.'
          }
        </p>

        <fieldset className="flex flex-col gap-3 mb-5">
          <legend className="sr-only">Mint mode</legend>

          <ModeOption
            id="mode-embedded"
            checked={mode === 'embedded'}
            onChange={() => setMode('embedded')}
            title="EMBEDDED WALLET"
            badge="SILENT"
            badgeTone="good"
            description={'Use the auto-created Privy wallet. Mints are completely silent \u2014 no popups. Fund it with a small amount of Base ETH for gas.'}
          />

          <ModeOption
            id="mode-connected"
            checked={mode === 'connected'}
            onChange={() => setMode('connected')}
            title="CONNECTED WALLET"
            badge="SIGNS EACH TX"
            badgeTone="warn"
            description="Mint from the wallet you signed in with (e.g. MetaMask). It will pop up to confirm every kill. Pays gas from that wallet."
          />

          <ModeOption
            id="mode-custom"
            checked={mode === 'custom'}
            onChange={() => setMode('custom')}
            title="MINTER PRIVATE KEY"
            badge="SILENT"
            badgeTone="good"
            description={'Paste a burner wallet\u2019s private key. Mints are silent and gas is paid by that address. Stored only in this browser.'}
          />
        </fieldset>

        {/* Custom-key input shows only when that mode is selected */}
        {mode === 'custom' && (
          <div className="border border-[#4a3f38] bg-[#1a1614] p-3 mb-5">
            <label
              htmlFor="minter-key"
              className="block text-[10px] text-[#a3b83d] tracking-[0.3em] mb-2"
              style={displayFont}
            >
              PRIVATE KEY
            </label>
            <div className="flex gap-2">
              <input
                id="minter-key"
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={'0x\u2026 (64 hex chars)'}
                spellCheck={false}
                autoComplete="off"
                className="flex-1 min-w-0 bg-[#12100e] border border-[#4a3f38] focus:border-[#a3b83d] outline-none px-2 py-2 text-xs text-[#d6ccb2]"
                style={monoFont}
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="border border-[#4a3f38] text-[#8a8270] hover:text-[#d6ccb2] hover:border-[#d6ccb2] px-2 text-[10px] tracking-[0.2em]"
                style={displayFont}
              >
                {showKey ? 'HIDE' : 'SHOW'}
              </button>
            </div>
            {derivedAddress && (
              <p className="text-[11px] text-[#a3b83d] mt-2 break-all" style={monoFont}>
                Address: {derivedAddress}
              </p>
            )}
            <p className="text-[10px] text-[#a35124] mt-2 leading-snug" style={bodyFont}>
              Use a dedicated burner wallet. The key is saved in localStorage, not on a
              server, but anyone with access to this browser could read it.
            </p>
          </div>
        )}

        {error && (
          <div
            className="border-2 border-[#7a1515] bg-[#3d0808] px-3 py-2 mb-4"
            role="alert"
          >
            <p className="text-[#d6ccb2] text-xs leading-relaxed" style={bodyFont}>
              {error}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-[#4a3f38] bg-[#14100e] text-[#8a8270] hover:text-[#d6ccb2] hover:border-[#d6ccb2] py-3 text-sm tracking-[0.2em]"
            style={displayFont}
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            className="flex-1 border-2 border-[#a3b83d] bg-[#14100e] text-[#a3b83d] hover:bg-[#a3b83d] hover:text-[#14100e] py-3 text-sm tracking-[0.2em]"
            style={displayFont}
          >
            {savedFlash ? 'SAVED' : 'SAVE'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModeOption({
  id,
  checked,
  onChange,
  title,
  badge,
  badgeTone,
  description,
}: {
  id: string
  checked: boolean
  onChange: () => void
  title: string
  badge: string
  badgeTone: 'good' | 'warn'
  description: string
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
        checked
          ? 'border-[#a3b83d] bg-[#1a1614]'
          : 'border-[#4a3f38] bg-[#14100e] hover:bg-[#1a1614]'
      }`}
    >
      <input
        id={id}
        type="radio"
        name="mint-mode"
        checked={checked}
        onChange={onChange}
        className="mt-1 accent-[#a3b83d]"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p
            className="text-xs text-[#d6ccb2] tracking-[0.15em]"
            style={displayFont}
          >
            {title}
          </p>
          <span
            className={`text-[9px] tracking-[0.2em] px-2 py-0.5 ${
              badgeTone === 'good'
                ? 'border border-[#a3b83d]/60 text-[#a3b83d]'
                : 'border border-[#a35124]/60 text-[#a35124]'
            }`}
            style={displayFont}
          >
            {badge}
          </span>
        </div>
        <p className="text-[11px] text-[#8a8270] leading-relaxed" style={bodyFont}>
          {description}
        </p>
      </div>
    </label>
  )
}
