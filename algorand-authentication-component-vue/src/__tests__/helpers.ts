import { vi } from 'vitest'

export const TESTNET_GENESIS_HASH = 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI='

/** Stubs `fetch` with an algod `/v2/transactions/params` response. */
export function stubAlgodParams() {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            'consensus-version': 'future',
            fee: 0,
            'genesis-hash': TESTNET_GENESIS_HASH,
            'genesis-id': 'testnet-v1.0',
            'last-round': 1000,
            'min-fee': 1000
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )
  )
}
