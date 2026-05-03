// Local nonce manager for the custom-private-key mint path.
//
// When a player kills several zombies in quick succession, the hook
// fires multiple `sendTransaction` calls back-to-back. Without a
// managed nonce, viem auto-fetches the nonce via `getTransactionCount`
// for each call — and because none of the just-sent txs are mined yet,
// they all see the same on-chain nonce and conflict with:
//   "Nonce provided for the transaction is lower than the current
//    nonce of the account."
//
// This module fixes that by:
//   1. Maintaining an in-memory "next nonce" counter per address.
//   2. Serializing send operations per address through a promise queue
//      so each call gets a strictly increasing nonce.
//   3. Resetting the counter on nonce-related errors so the next call
//      re-syncs against the chain.

import type { PublicClient } from 'viem'

const nextNonceByAddress = new Map<string, number>()
const queueByAddress = new Map<string, Promise<unknown>>()

/**
 * Run `send(nonce)` with a managed, monotonically increasing nonce
 * for the given address. Sends are serialized per address so rapid
 * fire-bursts don't collide.
 */
export async function withManagedNonce<T>(
  address: `0x${string}`,
  publicClient: PublicClient,
  send: (nonce: number) => Promise<T>,
): Promise<T> {
  const key = address.toLowerCase()
  const prev = queueByAddress.get(key) ?? Promise.resolve()

  const run = async (): Promise<T> => {
    let nonce = nextNonceByAddress.get(key)
    if (nonce === undefined) {
      // First send (or post-error reset). Use the "pending" tag so we
      // also count txs that are already in the mempool but not mined.
      nonce = await publicClient.getTransactionCount({
        address,
        blockTag: 'pending',
      })
    }
    try {
      const result = await send(nonce)
      // Only advance the counter once the broadcast succeeded.
      nextNonceByAddress.set(key, nonce + 1)
      return result
    } catch (err: any) {
      const msg = (err?.shortMessage || err?.message || '').toLowerCase()
      // Nonce desync — drop our cache so the next call refetches from
      // chain. Covers "nonce too low", "nonce too high",
      // "already known", and replacement underpriced cases.
      if (
        /nonce|already known|replacement transaction underpriced/.test(msg)
      ) {
        nextNonceByAddress.delete(key)
      }
      throw err
    }
  }

  // Chain onto the previous send so this address's sends are serial.
  // We swallow the previous error here (it's already been surfaced to
  // its own caller) so a single failure doesn't poison the queue.
  const next = prev.then(run, run)
  queueByAddress.set(
    key,
    next.catch(() => undefined),
  )
  return next
}

/** Force a re-sync from chain on the next send for this address. */
export function resetManagedNonce(address: `0x${string}`) {
  nextNonceByAddress.delete(address.toLowerCase())
}
