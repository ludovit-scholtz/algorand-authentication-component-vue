import { describe, expect, it } from 'vitest'
import algosdk from 'algosdk'
import arc14, { arc14Header } from '../scripts/arc14'
import { deriveArc76Account, isValidEmail } from '../scripts/arc76'
import { TESTNET_GENESIS_HASH } from './helpers'

describe('arc76', () => {
  it('derives a stable, per-email account', async () => {
    const a = await deriveArc76Account('test@example.com', 'a-very-long-password-123')
    const b = await deriveArc76Account('test@example.com', 'a-very-long-password-123')
    expect(a.addr.toString()).toBe(b.addr.toString())
    expect(algosdk.isValidAddress(a.addr.toString())).toBe(true)
    const other = await deriveArc76Account('other@example.com', 'a-very-long-password-123')
    expect(other.addr.toString()).not.toBe(a.addr.toString())
  }, 30_000)

  it('validates e-mails', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('a b@c.d')).toBe(false)
  })
})

describe('arc14', () => {
  const account = algosdk.generateAccount()
  const suggestedParams: algosdk.SuggestedParams = {
    fee: 1000,
    minFee: 1000,
    flatFee: false,
    firstValid: 1000,
    lastValid: 2000,
    genesisID: 'testnet-v1.0',
    genesisHash: new Uint8Array(Buffer.from(TESTNET_GENESIS_HASH, 'base64'))
  }

  it('builds a zero-fee self payment with the realm note', () => {
    const txn = arc14('Auth', account.addr.toString(), suggestedParams)
    expect(txn.fee).toBe(0n)
    expect(txn.payment?.amount).toBe(0n)
    expect(txn.sender.toString()).toBe(account.addr.toString())
    expect(txn.payment?.receiver.toString()).toBe(account.addr.toString())
    expect(new TextDecoder().decode(txn.note)).toBe('Auth#ARC14')
  })

  it('formats the SigTx authorization header', () => {
    const txn = arc14('r', account.addr.toString(), suggestedParams)
    const header = arc14Header(txn.signTxn(account.sk))
    expect(header.startsWith('SigTx ')).toBe(true)
    const decoded = algosdk.decodeSignedTransaction(Buffer.from(header.slice(6), 'base64'))
    expect(decoded.txn.sender.toString()).toBe(account.addr.toString())
  })
})
