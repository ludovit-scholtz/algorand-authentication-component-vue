import algosdk from 'algosdk'
import { Buffer } from 'buffer'

/**
 * ARC-14 authentication transaction: a zero-fee, zero-amount self payment whose note is
 * `<realm>#ARC14`. It is never submitted to the network - the signed bytes are sent to
 * your backend as `Authorization: SigTx <base64>`.
 */
const arc14 = (realm: string, signerAddr: string, params: algosdk.SuggestedParams) => {
  return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: signerAddr,
    receiver: signerAddr,
    amount: 0,
    note: new Uint8Array(Buffer.from(realm + '#ARC14')),
    suggestedParams: { ...params, fee: 0, flatFee: true }
  })
}

/** Formats a signed ARC-14 transaction as an HTTP `Authorization` header value. */
export const arc14Header = (signedTransaction: Uint8Array): string =>
  `SigTx ${Buffer.from(signedTransaction).toString('base64')}`

export default arc14
