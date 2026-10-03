import { createHash, createPublicKey, pbkdf2Sync, verify } from 'node:crypto'
import { expect, type Page } from '@playwright/test'
import algosdk from 'algosdk'

export const ARC76_EMAIL = 'e2e.user@example.com'
export const ARC76_PASSWORD = 'correct-horse-battery-staple-42'

/** Independent (Node crypto) re-implementation of the ARC-76 derivation used to verify the UI. */
export function arc76Account(email: string, password: string): algosdk.Account {
  const init = `ARC-0076-${email}-${password}-0-PBKDF2-999999`
  const salt = `ARC-0076-${email}-0-PBKDF2-999999`
  const seed = pbkdf2Sync(Buffer.from(init), Buffer.from(salt), 999999, 32, 'sha256')
  return algosdk.mnemonicToSecretKey(algosdk.mnemonicFromSeed(new Uint8Array(seed)))
}

const GENESIS_HASHES: Record<string, string> = {
  'testnet-v1.0': 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
  'mainnet-v1.0': 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8='
}

/** Answers `GET /v2/transactions/params` of any algod so the offline tests never hit a node. */
export async function mockAlgod(page: Page, genesisId = 'testnet-v1.0') {
  await page.route('**/v2/transactions/params', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        'consensus-version': 'future',
        fee: 0,
        'genesis-hash': GENESIS_HASHES[genesisId],
        'genesis-id': genesisId,
        'last-round': 5_000_000,
        'min-fee': 1000
      })
    })
  )
}

/** Decodes `SigTx <base64>` and returns the signed transaction. */
export function decodeHeader(header: string): algosdk.SignedTransaction {
  expect(header.startsWith('SigTx ')).toBe(true)
  return algosdk.decodeSignedTransaction(Buffer.from(header.slice('SigTx '.length), 'base64'))
}

/** Asserts that `header` is an ARC-14 header for `address` and `realm` with a valid signature. */
export function expectValidArc14Header(header: string, address: string, realm: string) {
  const signed = decodeHeader(header)
  const txn = signed.txn
  expect(txn.sender.toString()).toBe(address)
  expect(txn.payment?.receiver.toString()).toBe(address)
  expect(txn.payment?.amount).toBe(0n)
  expect(txn.fee).toBe(0n)
  expect(new TextDecoder().decode(txn.note)).toBe(`${realm}#ARC14`)
  // the Ed25519 signature must verify against the sender's public key
  const publicKey = createPublicKey({
    key: Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'),
      Buffer.from(algosdk.decodeAddress(address).publicKey)
    ]),
    format: 'der',
    type: 'spki'
  })
  const message = Buffer.concat([
    Buffer.from('TX'),
    Buffer.from(algosdk.encodeUnsignedTransaction(txn))
  ])
  expect(signed.sig).toBeDefined()
  expect(verify(null, message, publicKey, Buffer.from(signed.sig!))).toBe(true)
}

/** Fills the ARC-76 form on the sign-in screen and submits it. */
export async function signInWithArc76(page: Page, email = ARC76_EMAIL, password = ARC76_PASSWORD) {
  await page.locator('#e').fill(email)
  await page.locator('#p').fill(password)
  await page.getByRole('button', { name: 'Continue' }).click()
}

/** Independently verifies an ARC-60 signature: Ed25519 over SHA-256(data) || SHA-256(authenticatorData = SHA-256(domain)). */
export function verifyArc60Signature(args: {
  address: string
  dataBase64: string
  domain: string
  signatureBase64: string
}): boolean {
  const publicKey = createPublicKey({
    key: Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'),
      Buffer.from(algosdk.decodeAddress(args.address).publicKey)
    ]),
    format: 'der',
    type: 'spki'
  })
  const message = Buffer.concat([
    createHash('sha256').update(Buffer.from(args.dataBase64, 'base64')).digest(),
    createHash('sha256').update(createHash('sha256').update(args.domain).digest()).digest()
  ])
  return verify(null, message, publicKey, Buffer.from(args.signatureBase64, 'base64'))
}
