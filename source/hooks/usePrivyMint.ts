'use client'

import { useCallback, useMemo } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import {
  createWalletClient,
  custom,
  encodeFunctionData,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'
import { Attribution } from 'ox/erc8021'
import { NFT_CONTRACT_ADDRESS } from './useMintingWallet'

// Base Builder Code attribution (ERC-8021). Same code as the minter path so
// on-chain analytics credit this app for both flows.
const BUILDER_CODE = 'bc_dh0rqw67'
const DATA_SUFFIX = Attribution.toDataSuffix({ codes: [BUILDER_CODE] }) as Hex

// Generous gas limit — same rationale as the minter path.
const MINT_GAS_LIMIT = 3_000_000n

/**
 * Mints an NFT directly from the user's connected Privy wallet (mint-to-self,
 * the same path Rabby/MetaMask take when they call the contract). For
 * embedded Privy wallets that have been configured for in-app signing this
 * happens silently with no popup; for external wallets like Coinbase the
 * user will see their wallet's native confirmation prompt — but no extra
 * Privy modal is shown.
 *
 * Tries multiple common mint signatures so it works against contracts that
 * expose `mint()`, `mint(address)`, `mint(address,uint256)` or `safeMint`.
 */
export function usePrivyMint() {
  const { authenticated } = usePrivy()
  const { wallets } = useWallets()

  // Pick the first connected wallet — Privy lists embedded wallets first
  // when they exist, otherwise the externally connected wallet (Coinbase,
  // MetaMask, etc.).
  const wallet = useMemo(() => wallets[0], [wallets])

  const isAvailable = Boolean(authenticated && wallet)

  const mint = useCallback(async (): Promise<{
    success: boolean
    hash?: string
    error?: string
  }> => {
    if (!wallet) return { success: false, error: 'No wallet connected' }

    try {
      // Make sure we're on Base before sending. Some wallets silently send
      // on the wrong network if we don't switch.
      try {
        await wallet.switchChain(base.id)
      } catch (e) {
        console.log('[v0] Privy switchChain failed (continuing anyway):', e)
      }

      const provider = await wallet.getEthereumProvider()
      const account = wallet.address as `0x${string}`

      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: custom(provider),
      })

      // Variants to try, in preference order. mint() with no args is the
      // most common ERC-721 free-claim signature and matches what Rabby is
      // calling successfully — so we try it first for the Privy path.
      const variants: Array<{
        name: string
        abi: any
        functionName: string
        args: any[]
      }> = [
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
          name: 'mint(address)',
          abi: [{
            name: 'mint',
            type: 'function',
            stateMutability: 'payable',
            inputs: [{ name: 'to', type: 'address' }],
            outputs: [],
          }],
          functionName: 'mint',
          args: [account],
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
          args: [account, 1n],
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
          args: [account],
        },
      ]

      let lastError: any = null
      for (const v of variants) {
        try {
          // Encode the calldata ourselves and append the Base Builder Code
          // suffix. We use sendTransaction (not writeContract) so we have
          // full control over the data field.
          const baseData = encodeFunctionData({
            abi: v.abi,
            functionName: v.functionName,
            args: v.args,
          })
          const dataWithSuffix =
            (baseData + DATA_SUFFIX.slice(2)) as `0x${string}`

          const hash = await walletClient.sendTransaction({
            to: NFT_CONTRACT_ADDRESS as `0x${string}`,
            data: dataWithSuffix,
            gas: MINT_GAS_LIMIT,
          })

          console.log(`[v0] Privy mint succeeded with ${v.name}:`, hash)
          return { success: true, hash }
        } catch (err: any) {
          const msg = err?.shortMessage || err?.message || ''
          console.log(`[v0] Privy mint variant ${v.name} failed:`, msg)
          // If the user explicitly rejected, stop trying more variants.
          if (
            err?.code === 4001 ||
            /reject|denied|cancel/i.test(msg)
          ) {
            return { success: false, error: 'User rejected transaction' }
          }
          lastError = err
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
      console.error('[v0] Privy mint error:', err)
      return {
        success: false,
        error: err?.shortMessage || err?.message || 'Mint failed',
      }
    }
  }, [wallet])

  return { mint, isAvailable, address: wallet?.address }
}
