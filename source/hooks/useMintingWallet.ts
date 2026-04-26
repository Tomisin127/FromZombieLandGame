'use client'

import { useCallback, useEffect, useState } from 'react'
import { createWalletClient, createPublicClient, http, formatEther, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { Attribution } from 'ox/erc8021'

export const NFT_CONTRACT_ADDRESS = '0x6A6d006d782D624B6f511c6dfBF6eD60a8078dB1'

const STORAGE_KEY = 'zombie-fps-minting-key'

// Base Builder Code attribution (ERC-8021).
// Appended to every mint's calldata so this app gets credited for the volume.
// Registered at base.dev → Settings → Builder Code.
const BUILDER_CODE = 'bc_dh0rqw67'
const DATA_SUFFIX = Attribution.toDataSuffix({ codes: [BUILDER_CODE] })

// Gas limit used for every mint — some NFT contracts on Base require headroom
// for metadata/royalty/ERC-4906 updates, so we bump this well above a typical
// mint's baseline to avoid out-of-gas failures.
const MINT_GAS_LIMIT = 3_000_000n

// Public client to read chain data
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
})

export function useMintingWallet() {
  const [privateKey, setPrivateKey] = useState<Hex | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [balance, setBalance] = useState<string>('0')
  const [isLoaded, setIsLoaded] = useState(false)
  const [mintFunction, setMintFunction] = useState<string>('mint') // default function name

  // Load saved key on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && saved.startsWith('0x') && saved.length === 66) {
        const account = privateKeyToAccount(saved as Hex)
        setPrivateKey(saved as Hex)
        setAddress(account.address)
      }
      const savedFn = localStorage.getItem(STORAGE_KEY + '-fn')
      if (savedFn) setMintFunction(savedFn)
    } catch (e) {
      console.error('[v0] Failed to load saved wallet', e)
    }
    setIsLoaded(true)
  }, [])

  // Fetch balance
  const refreshBalance = useCallback(async () => {
    if (!address) return
    try {
      const bal = await publicClient.getBalance({ address: address as `0x${string}` })
      setBalance(formatEther(bal))
    } catch (e) {
      console.error('[v0] Failed to fetch balance', e)
    }
  }, [address])

  useEffect(() => {
    if (address) refreshBalance()
  }, [address, refreshBalance])

  const importWallet = useCallback((key: string) => {
    const cleanKey = key.trim().startsWith('0x') ? key.trim() : `0x${key.trim()}`
    if (cleanKey.length !== 66) {
      throw new Error('Invalid private key. Must be 64 hex characters.')
    }
    const account = privateKeyToAccount(cleanKey as Hex)
    localStorage.setItem(STORAGE_KEY, cleanKey)
    setPrivateKey(cleanKey as Hex)
    setAddress(account.address)
  }, [])

  const removeWallet = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setPrivateKey(null)
    setAddress(null)
    setBalance('0')
  }, [])

  const updateMintFunction = useCallback((fn: string) => {
    localStorage.setItem(STORAGE_KEY + '-fn', fn)
    setMintFunction(fn)
  }, [])

  // Silent mint to recipient wallet
  const mintTo = useCallback(
    async (recipientAddress: string): Promise<{ success: boolean; hash?: string; error?: string }> => {
      if (!privateKey) {
        return { success: false, error: 'No minting wallet configured' }
      }

      try {
        const account = privateKeyToAccount(privateKey)
        // Attach Base Builder Code at the client level so every transaction
        // from this wallet automatically carries the attribution suffix.
        const walletClient = createWalletClient({
          account,
          chain: base,
          transport: http(),
          // ERC-8021 data suffix — viem appends this to every tx's calldata
          dataSuffix: DATA_SUFFIX,
        })

        // Try mint(address to) first with the configured function name
        let hash: `0x${string}`
        try {
          hash = await walletClient.writeContract({
            address: NFT_CONTRACT_ADDRESS as `0x${string}`,
            abi: [
              {
                name: mintFunction,
                type: 'function',
                stateMutability: 'payable',
                inputs: [{ name: 'to', type: 'address' }],
                outputs: [{ name: '', type: 'uint256' }],
              },
            ],
            functionName: mintFunction,
            args: [recipientAddress as `0x${string}`],
            gas: MINT_GAS_LIMIT,
          })
        } catch (firstErr: any) {
          // Try with quantity 1 (mint(address, uint256))
          console.log('[v0] First mint attempt failed, trying with quantity', firstErr?.shortMessage || firstErr?.message)
          hash = await walletClient.writeContract({
            address: NFT_CONTRACT_ADDRESS as `0x${string}`,
            abi: [
              {
                name: 'mint',
                type: 'function',
                stateMutability: 'payable',
                inputs: [
                  { name: 'to', type: 'address' },
                  { name: 'quantity', type: 'uint256' },
                ],
                outputs: [],
              },
            ],
            functionName: 'mint',
            args: [recipientAddress as `0x${string}`, 1n],
            gas: MINT_GAS_LIMIT,
          })
        }

        console.log('[v0] Mint transaction sent:', hash)
        // Refresh balance in background
        refreshBalance()

        return { success: true, hash }
      } catch (err: any) {
        console.error('[v0] Mint failed:', err)
        return {
          success: false,
          error: err?.shortMessage || err?.message || 'Mint failed',
        }
      }
    },
    [privateKey, mintFunction, refreshBalance],
  )

  return {
    address,
    balance,
    isConfigured: !!privateKey,
    isLoaded,
    mintFunction,
    importWallet,
    removeWallet,
    refreshBalance,
    updateMintFunction,
    mintTo,
  }
}
