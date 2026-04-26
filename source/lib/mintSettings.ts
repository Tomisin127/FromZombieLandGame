// Persistent player choice for which wallet should sign and pay gas
// for every NFT mint. Stored in localStorage so it survives reloads
// without requiring a backend.
//
// - "embedded": the Privy embedded wallet auto-created on login.
//   Mints are SILENT (no popup) but the player must fund this wallet
//   with a small amount of Base ETH.
//
// - "connected": the player's primary wallet (e.g. MetaMask if they
//   linked one, otherwise the embedded wallet). External wallets ALWAYS
//   show their native confirmation popup per their own security rules
//   — we cannot suppress that. Useful for players who want to mint
//   from the same wallet they signed in with.
//
// - "custom": a private key the player pasted on the dashboard.
//   Mints are SILENT and gas is paid by the address derived from that
//   key. Use a burner wallet — the key is stored in localStorage.

export type MintMode = 'embedded' | 'connected' | 'custom'

export interface MintSettings {
  mode: MintMode
  privateKey?: `0x${string}`
}

const STORAGE_KEY = 'zh.mintSettings.v1'

const defaultSettings: MintSettings = { mode: 'embedded' }

export function loadMintSettings(): MintSettings {
  if (typeof window === 'undefined') return defaultSettings
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw) as MintSettings
    // Validate the saved shape and degrade gracefully if it's stale.
    if (parsed.mode !== 'embedded' && parsed.mode !== 'connected' && parsed.mode !== 'custom') {
      return defaultSettings
    }
    if (parsed.mode === 'custom' && !isValidPrivateKey(parsed.privateKey)) {
      // No usable key saved — fall back so the game keeps working.
      return { mode: 'embedded' }
    }
    return parsed
  } catch {
    return defaultSettings
  }
}

export function saveMintSettings(settings: MintSettings): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {
    console.log('[v0] Failed to persist mint settings:', e)
  }
}

export function clearMintSettings(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export function isValidPrivateKey(value: unknown): value is `0x${string}` {
  return (
    typeof value === 'string' &&
    /^0x[0-9a-fA-F]{64}$/.test(value)
  )
}

// Normalize a raw user-pasted key — accept "0x..." or bare hex, trim
// whitespace, and lowercase the hex chars.
export function normalizePrivateKey(raw: string): `0x${string}` | null {
  const trimmed = raw.trim().toLowerCase()
  const withPrefix = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
  if (isValidPrivateKey(withPrefix)) return withPrefix as `0x${string}`
  return null
}
