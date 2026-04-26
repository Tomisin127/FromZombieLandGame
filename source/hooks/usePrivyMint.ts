'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePrivy, useWallets, useSendTransaction } from '@privy-io/react-auth'
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  formatEther,
  http,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { Attribution } from 'ox/erc8021'
import { NFT_CONTRACT_ADDRESS, BUILDER_CODE } from '@/lib/contract'
import { loadMintSettings, type MintMode, type MintSettings } from '@/lib/mintSettings'

// ERC-8021 attribution suffix appended to every mint's calldata.
const DATA_SUFFIX = Attribution.toDataSuffix({ codes: [BUILDER_CODE] }) as Hex

// Static public client for gas estimation / nonce / fee data on Base.
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
})

// Mint ABI variants the contract might expose. Tried in order; the
// first one whose `estimateContractGas` succeeds is used.
type MintVariant = {
  name: string
  abi: any
  functionName: string
  buildArgs: (account: `0x${string}`) => any[]
}

const VARIANTS: MintVariant[] = [
  {
    name: 'mint()',
    abi: [{
      name: 'mint',
      type: 'function',
      stateMutability: 'payable',
      inputs: [],
      outputs: [],
    }],
    functionName: 'mint',
    buildArgs: () => [],
  },
  {
    name: 'mint(address)',
    abi: [{
      name: 'mint',
      type: 'function',
      stateMutability: 'payable',
      inputs: [{ name: 'to', type: 'address' }],
      outputs: [],
    }],
    functionName: 'mint',
    buildArgs: (a) => [a],
  },
  {
    name: 'mint(uint256)',
    abi: [{
      name: 'mint',
      type: 'function',
      stateMutability: 'payable',
      inputs: [{ name: 'quantity', type: 'uint256' }],
      outputs: [],
    }],
    functionName: 'mint',
    buildArgs: () => [1n],
  },
  {
    name: 'mint(address,uint256)',
    abi: [{
      name: 'mint',
      type: 'function',
      stateMutability: 'payable',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'quantity', type: 'uint256' },
      ],
      outputs: [],
    }],
    functionName: 'mint',
    buildArgs: (a) => [a, 1n],
  },
  {
    name: 'safeMint(address)',
    abi: [{
      name: 'safeMint',
      type: 'function',
      stateMutability: 'payable',
      inputs: [{ name: 'to', type: 'address' }],
      outputs: [],
    }],
    functionName: 'safeMint',
    buildArgs: (a) => [a],
  },
]

const STORAGE_KEY = 'zh.mintSettings.v1'

/**
 * Mints an NFT for every kill. The signing wallet & gas source is
 * chosen by the player on the dashboard (see lib/mintSettings.ts):
 *
 *   - "embedded": Privy embedded wallet — silent, no popup. Player
 *     funds the embedded wallet's address with a tiny amount of Base
 *     ETH for gas.
 *   - "connected": player's primary external wallet. Will pop up a
 *     native confirmation per transaction (cannot be suppressed).
 *   - "custom": pasted private key. Silent. Gas paid by the address
 *     derived from that key.
 *
 * Gas is dynamically estimated per variant and never sponsored — the
 * chosen wallet pays its own gas.
 */
export function usePrivyMint() {
  const { authenticated } = usePrivy()
  const { wallets } = useWallets()
  const { sendTransaction: privySendTransaction } = useSendTransaction()

  // Reload settings whenever localStorage is updated by another tab or
  // by the dashboard modal saving in the same tab.
  const [settings, setSettings] = useState<MintSettings>(() => loadMintSettings())
  useEffect(() => {
    if (typeof window === 'undefined') return
    // localStorage `storage` event only fires for OTHER tabs. We poll
    // lightly in this tab so saving from MinterSettings is picked up
    // without prop drilling. The interval is cheap (every 2s).
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSettings(loadMintSettings())
    }
    window.addEventListener('storage', onStorage)
    const id = setInterval(() => {
      setSettings((prev) => {
        const next = loadMintSettings()
        if (
          prev.mode === next.mode &&
          prev.privateKey === next.privateKey
        ) {
          return prev
        }
        return next
      })
    }, 2000)
    return () => {
      window.removeEventListener('storage', onStorage)
      clearInterval(id)
    }
  }, [])

  // The Privy embedded wallet (always present once
  // `createOnLogin:'all-users'` runs).
  const embeddedWallet = useMemo(
    () => wallets.find((w) => w.walletClientType === 'privy'),
    [wallets],
  )
  // The user's primary external wallet, if they linked one. May be the
  // same as embedded if they signed in with email/google.
  const externalWallet = useMemo(
    () => wallets.find((w) => w.walletClientType !== 'privy'),
    [wallets],
  )

  // Pre-compute the custom-key account so we can show its address and
  // balance in the HUD without re-deriving on every render.
  const customAccount = useMemo(() => {
    if (settings.mode !== 'custom' || !settings.privateKey) return null
    try {
      return privateKeyToAccount(settings.privateKey)
    } catch {
      return null
    }
  }, [settings])

  // Resolve which address will actually sign and pay gas, based on
  // the chosen mode. Falls back gracefully when a chosen wallet isn't
  // available (e.g. user picked "connected" but didn't link an
  // external wallet — we use embedded so the game keeps working).
  const { activeMode, activeAddress } = useMemo<{
    activeMode: MintMode
    activeAddress: `0x${string}` | undefined
  }>(() => {
    if (settings.mode === 'custom' && customAccount) {
      return { activeMode: 'custom', activeAddress: customAccount.address }
    }
    if (settings.mode === 'connected' && externalWallet) {
      return {
        activeMode: 'connected',
        activeAddress: externalWallet.address as `0x${string}`,
      }
    }
    return {
      activeMode: 'embedded',
      activeAddress: embeddedWallet?.address as `0x${string}` | undefined,
    }
  }, [settings, customAccount, externalWallet, embeddedWallet])

  const isAvailable = Boolean(authenticated && activeAddress)

  // Live ETH balance of the ACTIVE wallet so the HUD can warn the
  // player to fund whichever wallet is going to pay gas next.
  const [balance, setBalance] = useState<string>('0')
  const [balanceWei, setBalanceWei] = useState<bigint>(0n)

  const refreshBalance = useCallback(async () => {
    if (!activeAddress) return
    try {
      const wei = await publicClient.getBalance({ address: activeAddress })
      setBalanceWei(wei)
      setBalance(parseFloat(formatEther(wei)).toFixed(5))
    } catch (e) {
      console.log('[v0] Balance fetch failed:', e)
    }
  }, [activeAddress])

  useEffect(() => {
    if (!activeAddress) {
      setBalance('0')
      setBalanceWei(0n)
      return
    }
    refreshBalance()
    const id = setInterval(refreshBalance, 15000)
    return () => clearInterval(id)
  }, [activeAddress, refreshBalance])

  const mint = useCallback(async (): Promise<{
    success: boolean
    hash?: string
    error?: string
  }> => {
    if (!activeAddress) {
      return { success: false, error: 'No wallet available to mint' }
    }

    try {
      // Pre-estimate gas with each ABI variant. The first one that
      // estimates cleanly is used.
      let chosen: { variant: MintVariant; gas: bigint } | null = null
      let lastError: any = null

      for (const v of VARIANTS) {
        try {
          const gasRaw = await publicClient.estimateContractGas({
            account: activeAddress,
            address: NFT_CONTRACT_ADDRESS as `0x${string}`,
            abi: v.abi,
            functionName: v.functionName,
            args: v.buildArgs(activeAddress),
          })
          const gas = (gasRaw * 130n) / 100n // 30% safety buffer
          chosen = { variant: v, gas }
          break
        } catch (err: any) {
          const msg = err?.shortMessage || err?.message || ''
          if (/insufficient funds|total cost/i.test(msg)) {
            return {
              success: false,
              error:
                'Not enough ETH on Base in the active wallet to cover gas. Top it up and the next kill will mint.',
            }
          }
          console.log(`[v0] Mint estimate failed for ${v.name}:`, msg)
          lastError = err
        }
      }

      if (!chosen) {
        return {
          success: false,
          error:
            lastError?.shortMessage ||
            lastError?.message ||
            'Could not estimate gas for any mint variant',
        }
      }

      // Build calldata + ERC-8021 builder-code suffix.
      const baseData = encodeFunctionData({
        abi: chosen.variant.abi,
        functionName: chosen.variant.functionName,
        args: chosen.variant.buildArgs(activeAddress),
      })
      const data = (baseData + DATA_SUFFIX.slice(2)) as `0x${string}`

      // ----- Branch by mode -----
      if (activeMode === 'custom' && customAccount) {
        // Silent: viem walletClient backed by the pasted private key.
        // Pays gas from customAccount.address. No external popup.
        const walletClient = createWalletClient({
          account: customAccount,
          chain: base,
          transport: http(),
        })
        const hash = await walletClient.sendTransaction({
          to: NFT_CONTRACT_ADDRESS as `0x${string}`,
          data,
          gas: chosen.gas,
        })
        console.log(
          `[v0] Custom-key silent mint ok with ${chosen.variant.name}:`,
          hash,
        )
        refreshBalance()
        return { success: true, hash }
      }

      if (activeMode === 'connected' && externalWallet) {
        // External wallet path. The wallet's native confirmation popup
        // WILL appear — there's no SDK trick that can suppress it
        // (security feature of the wallet itself).
        try {
          await externalWallet.switchChain(base.id)
        } catch (e) {
          console.log('[v0] switchChain failed (continuing):', e)
        }
        const provider = await externalWallet.getEthereumProvider()
        const walletClient = createWalletClient({
          account: externalWallet.address as `0x${string}`,
          chain: base,
          transport: custom(provider),
        })
        const hash = await walletClient.sendTransaction({
          to: NFT_CONTRACT_ADDRESS as `0x${string}`,
          data,
          gas: chosen.gas,
        })
        console.log(
          `[v0] Connected wallet mint ok with ${chosen.variant.name}:`,
          hash,
        )
        refreshBalance()
        return { success: true, hash }
      }

      // Default: silent embedded-wallet path via Privy.
      if (!embeddedWallet) {
        return {
          success: false,
          error: 'No embedded wallet provisioned yet — try again in a moment.',
        }
      }
      const result = await privySendTransaction(
        {
          to: NFT_CONTRACT_ADDRESS,
          data,
          chainId: base.id,
          gasLimit: chosen.gas,
        },
        {
          // Per-call override; also needs the provider-level config
          // `embeddedWallets.showWalletUIs:false` to fully suppress UI.
          uiOptions: { showWalletUIs: false } as any,
        },
      )
      console.log(
        `[v0] Embedded silent mint ok with ${chosen.variant.name}:`,
        result.hash,
      )
      refreshBalance()
      return { success: true, hash: result.hash }
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Mint failed'
      console.error('[v0] Mint error:', msg, err)
      if (err?.code === 4001 || /reject|denied|cancel/i.test(msg)) {
        return { success: false, error: 'Transaction rejected' }
      }
      if (/insufficient funds|total cost/i.test(msg)) {
        return {
          success: false,
          error:
            'Not enough ETH on Base in the active wallet to cover gas. Top it up and the next kill will mint.',
        }
      }
      return { success: false, error: msg }
    }
  }, [
    activeAddress,
    activeMode,
    customAccount,
    externalWallet,
    embeddedWallet,
    privySendTransaction,
    refreshBalance,
  ])

  return {
    mint,
    isAvailable,
    activeMode,
    activeAddress,
    embeddedAddress: embeddedWallet?.address,
    externalAddress: externalWallet?.address,
    customAddress: customAccount?.address,
    balance,
    balanceWei,
    refreshBalance,
  }
}
