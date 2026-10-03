import nacl from 'tweetnacl'
import algosdk from 'algosdk'
import { Buffer } from 'buffer'
import type { StdSignDataResponse } from '@txnlab/use-wallet-vue'

const sha256 = async (bytes: Uint8Array): Promise<Uint8Array> =>
  new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource))

/**
 * Bytes that ARC-60 signs (AUTH scope): `SHA-256(data) || SHA-256(authenticatorData)`, where `data`
 * is the decoded payload and `authenticatorData` is `SHA-256(domain)`.
 */
export const arc60Message = async (
  data: string,
  authenticatorData: Uint8Array
): Promise<Uint8Array> => {
  const dataHash = await sha256(new Uint8Array(Buffer.from(data, 'base64')))
  const authHash = await sha256(authenticatorData)
  const message = new Uint8Array(dataHash.length + authHash.length)
  message.set(dataHash)
  message.set(authHash, dataHash.length)
  return message
}

/** Builds the `StdSignData` fields for `data` (base64) the same way use-wallet adapters do. */
export const createStdSignData = async (data: string, signer: Uint8Array) => {
  const domain = globalThis.location.host
  const authenticatorData = await sha256(new TextEncoder().encode(domain))
  return { data, signer, domain, authenticatorData }
}

/** ARC-60 signature of `data` (base64) with an ARC-76 / local account. */
export const signArc60 = async (
  data: string,
  account: algosdk.Account
): Promise<StdSignDataResponse> => {
  const std = await createStdSignData(
    data,
    algosdk.decodeAddress(account.addr.toString()).publicKey
  )
  const message = await arc60Message(std.data, std.authenticatorData)
  return { ...std, signature: nacl.sign.detached(message, account.sk) }
}

/** Verifies an ARC-60 response (from a wallet or from `signArc60`). */
export const verifyArc60 = async (
  response: Pick<StdSignDataResponse, 'data' | 'signer' | 'authenticatorData' | 'signature'>
): Promise<boolean> => {
  const message = await arc60Message(response.data, response.authenticatorData)
  return nacl.sign.detached.verify(message, response.signature, response.signer)
}
