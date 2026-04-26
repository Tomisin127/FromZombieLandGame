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

        const to = recipientAddress as `0x${string}`

        // Try multiple common mint signatures, in preference order. We try
        // the user's configured function name first (default `mint`) with
        // an `address` arg, then fall back to other shapes. This matches
        // the Privy path and lets the wallet recover if the contract uses
        // a different signature than the configured one.
        const variants: Array<{
          name: string
          abi: any
          functionName: string
          args: any[]
        }> = [
          {
            name: `${mintFunction}(address)`,
            abi: [{
              name: mintFunction,
              type: 'function',
              stateMutability: 'payable',
              inputs: [{ name: 'to', type: 'address' }],
              outputs: [],
            }],
            functionName: mintFunction,
            args: [to],
          },
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
            args: [],
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
            args: [1n],
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
            args: [to, 1n],
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
            args: [to],
          },
        ]

        let lastError: any = null
        for (const v of variants) {
          try {
            // Estimate gas dynamically. Hard-coding a huge gas ceiling
            // (e.g. 3M) makes viem reject the tx with
            // "total cost (gas * gas fee + value) of e..." whenever the
            // wallet's balance is below worst-case gas, even though the
            // mint itself only needs ~150–300k gas. Estimating instead
            // lets the tx through on a small balance.
            let gas: bigint
            try {
              gas = await publicClient.estimateContractGas({
                account,
                address: NFT_CONTRACT_ADDRESS as `0x${string}`,
                abi: v.abi,
                functionName: v.functionName,
                args: v.args,
              })
              // 30% safety buffer
              gas = (gas * 130n) / 100n
            } catch (estErr: any) {
              // If estimation reverts, this variant is wrong for this
              // contract — skip to the next one without burning gas.
              console.log(`[v0] Estimate failed for ${v.name}:`, estErr?.shortMessage || estErr?.message)
              lastError = estErr
              continue
            }

            const hash = await walletClient.writeContract({
              address: NFT_CONTRACT_ADDRESS as `0x${string}`,
              abi: v.abi,
              functionName: v.functionName,
              args: v.args,
              gas,
            })

            console.log(`[v0] Mint succeeded with ${v.name}:`, hash)
            // Refresh balance in background
            refreshBalance()
            return { success: true, hash }
          } catch (err: any) {
            const msg = err?.shortMessage || err?.message || ''
            console.log(`[v0] Mint variant ${v.name} send failed:`, msg)
            lastError = err
            // If the wallet truly can't cover gas, no other variant will
            // help — bail out with a clearer message.
            if (/insufficient funds|total cost/i.test(msg)) {
              return {
                success: false,
                error: 'Insufficient ETH in minting wallet — fund it on Base to continue tagging.',
              }
            }
          }
        }

        return {
          success: false,
          error:
            lastError?.shortMessage ||
            lastError?.message ||
            'All mint variants failed',
        }
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
