'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePrivy, useWallets, useSendTransaction } from '@privy-io/react-auth'
import {
  createPublicClient,
  encodeFunctionData,
  formatEther,
  http,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'
import { Attribution } from 'ox/erc8021'
import { NFT_CONTRACT_ADDRESS, BUILDER_CODE } from '@/lib/contract'

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
    // Most common free-claim signature; matches what wallets like Rabby
    // call successfully on this contract.
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

/**
 * Mints an NFT directly from the user's connected Privy wallet, mint-to-self.
 * Gas is paid by the connected wallet (no sponsorship).
 *
 * - For Privy embedded wallets, transactions are silent: we use Privy's
 *   `useSendTransaction` while `embeddedWallets.showWalletUIs: false` is set
 *   on the provider, so no confirmation modal appears.
 * - For external wallets (MetaMask, Coinbase, Rabby, etc.) the wallet's own
 *   confirmation popup will appear because external wallets always require
 *   it for security reasons — that's a wallet-level behavior, not Privy.
 *
 * Gas is estimated dynamically per variant with a 30% buffer; we never hard
 * code a 3M ceiling, which previously caused viem to throw
 * "total cost (gas * gas fee + value) of e..." (the "TAG LOST" error)
 * when the wallet's balance was below worst-case gas.
 */
export function usePrivyMint() {
  const { authenticated } = usePrivy()
  const { wallets } = useWallets()
  const { sendTransaction: privySendTransaction } = useSendTransaction()

  // ALWAYS pick the Privy embedded wallet, regardless of whether the
  // user also connected an external one. Embedded wallets can sign
  // silently (with `showWalletUIs:false`), external wallets cannot.
  // `createOnLogin:'all-users'` in layout-client guarantees this
  // exists for every signed-in player.
  const embeddedWallet = useMemo(
    () => wallets.find((w) => w.walletClientType === 'privy'),
    [wallets],
  )
  // The user's primary identity (might be external if they connected
  // MetaMask), used only for display in the HUD.
  const primaryWallet = useMemo(() => wallets[0], [wallets])

  const isAvailable = Boolean(authenticated && embeddedWallet)

  // Track ETH balance of the embedded wallet so the HUD can warn the
  // user when it's empty (gas comes from this wallet, no sponsorship).
  const [balance, setBalance] = useState<string>('0')
  const [balanceWei, setBalanceWei] = useState<bigint>(0n)

  const refreshBalance = useCallback(async () => {
    if (!embeddedWallet) return
    try {
      const wei = await publicClient.getBalance({
        address: embeddedWallet.address as `0x${string}`,
      })
      setBalanceWei(wei)
      setBalance(parseFloat(formatEther(wei)).toFixed(5))
    } catch (e) {
      console.log('[v0] Balance fetch failed:', e)
    }
  }, [embeddedWallet])

  // Poll balance lightly so the HUD funding warning clears once the
  // user tops up the embedded wallet.
  useEffect(() => {
    if (!embeddedWallet) return
    refreshBalance()
    const id = setInterval(refreshBalance, 15000)
    return () => clearInterval(id)
  }, [embeddedWallet, refreshBalance])

  const mint = useCallback(async (): Promise<{
    success: boolean
    hash?: string
    error?: string
  }> => {
    if (!embeddedWallet) {
      return { success: false, error: 'No embedded wallet provisioned yet' }
    }

    const account = embeddedWallet.address as `0x${string}`

    try {
      // Pre-estimate gas with each variant. The first one that estimates
      // cleanly is the right ABI shape for this contract; we then pick
      // its calldata for the actual send.
      let chosen: { variant: MintVariant; gas: bigint } | null = null
      let lastError: any = null

      for (const v of VARIANTS) {
        try {
          const gasRaw = await publicClient.estimateContractGas({
            account,
            address: NFT_CONTRACT_ADDRESS as `0x${string}`,
            abi: v.abi,
            functionName: v.functionName,
            args: v.buildArgs(account),
          })
          const gas = (gasRaw * 130n) / 100n // 30% safety buffer
          chosen = { variant: v, gas }
          break
        } catch (err: any) {
          // Variant doesn't match this contract OR the wallet truly
          // can't cover gas. The latter we surface immediately so we
          // don't waste time on every variant.
          const msg = err?.shortMessage || err?.message || ''
          if (/insufficient funds|total cost/i.test(msg)) {
            return {
              success: false,
              error:
                'Not enough ETH on Base in your wallet to cover gas. Add a small amount of Base ETH and the next kill will mint.',
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
        args: chosen.variant.buildArgs(account),
      })
      const data = (baseData + DATA_SUFFIX.slice(2)) as `0x${string}`

      // ALWAYS the silent embedded-wallet path. We never call the
      // external wallet's `sendTransaction` because that would force a
      // user-facing confirmation popup that wallet apps cannot suppress.
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
        `[v0] Silent embedded mint ok with ${chosen.variant.name}:`,
        result.hash,
      )
      // Refresh balance in the background so the HUD warning clears.
      refreshBalance()
      return { success: true, hash: result.hash }
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Mint failed'
      console.error('[v0] Mint error:', msg, err)
      // Map a few common error shapes to clearer player-facing copy.
      if (err?.code === 4001 || /reject|denied|cancel/i.test(msg)) {
        return { success: false, error: 'Transaction rejected' }
      }
      if (/insufficient funds|total cost/i.test(msg)) {
        return {
          success: false,
          error:
            'Not enough ETH on Base in your wallet to cover gas. Add a small amount of Base ETH and the next kill will mint.',
        }
      }
      return { success: false, error: msg }
    }
  }, [embeddedWallet, privySendTransaction, refreshBalance])

  return {
    mint,
    isAvailable,
    // The wallet that actually signs and pays gas (always embedded).
    embeddedAddress: embeddedWallet?.address,
    // The user-facing identity address (might be external wallet).
    address: primaryWallet?.address,
    balance,
    balanceWei,
    refreshBalance,
  }
}
