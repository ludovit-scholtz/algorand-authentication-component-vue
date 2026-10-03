import algosdk from 'algosdk'
import {
  ScopeType,
  useWallet,
  type StdSignDataResponse,
  type StdSignMetadata
} from '@txnlab/use-wallet-vue'
import { authStore, resetAuthStore } from '../store/authStore'
import { createDeferred } from '../types'
import { createStdSignData } from './arc60'
import type { IAuthenticationStore } from '../types'

export type TransactionSigner = (
  txnGroup: algosdk.Transaction[],
  indexesToSign: number[]
) => Promise<Uint8Array[]>

export interface IAVMAuthentication {
  authStore: IAuthenticationStore
  /** Opens the sign-in screen. */
  authenticate: () => void
  /** Clears the session and disconnects the wallet that was used to sign in. */
  logout: () => Promise<void>
  /**
   * Signs a transaction group with the wallet (or ARC-76 account) the user signed in with.
   * `transactionSigner` defaults to the use-wallet signer.
   */
  sign: (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[],
    transactionSigner?: TransactionSigner
  ) => Promise<Uint8Array[]>
  /**
   * ARC-60 arbitrary data signing. `data` is base64. Wallets sign through use-wallet's `signData`
   * (the wallet must support it, check `canSignData`); ARC-76 accounts sign after a password prompt.
   */
  signData: (data: string, metadata?: StdSignMetadata) => Promise<StdSignDataResponse>
  /** Whether the current session can sign arbitrary data. */
  canSignData: () => boolean
}

const authenticate = () => {
  authStore.inAuthentication = true
}

export const useAVMAuthentication = (): IAVMAuthentication => {
  // use-wallet resolves its manager through provide/inject, so this only works inside
  // setup() of an app that installed WalletManagerPlugin.
  let walletApi: ReturnType<typeof useWallet> | undefined
  try {
    walletApi = useWallet()
  } catch {
    walletApi = undefined
  }

  const logout = async () => {
    const wallet = walletApi?.activeWallet.value
    if (authStore.wallet !== 'arc76' && wallet) {
      try {
        await wallet.disconnect()
      } catch (e) {
        console.warn('Wallet disconnect failed', e)
      }
    }
    authStore.signaturePromise?.reject(new Error('Logged out'))
    authStore.count++
    resetAuthStore()
  }

  const sign = async (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[],
    transactionSigner?: TransactionSigner
  ): Promise<Uint8Array[]> => {
    if (authStore.wallet === 'arc76') {
      if (authStore.signaturePromise) {
        throw new Error('Another signing request is already waiting for the ARC-76 password')
      }
      authStore.dataToSign = ''
      authStore.usignedTxs = txnGroup.map((txn) => algosdk.encodeUnsignedTransaction(txn))
      authStore.signaturePromise = createDeferred<Uint8Array[]>()
      authStore.inArc76Signature = true
      try {
        return await authStore.signaturePromise.promise
      } finally {
        authStore.signaturePromise = null
        authStore.inArc76Signature = false
      }
    }
    const signer = transactionSigner ?? walletApi?.transactionSigner
    if (!signer) {
      throw new Error('No transaction signer available - is WalletManagerPlugin installed?')
    }
    authStore.inWalletSignature = true
    try {
      return await signer(txnGroup, indexesToSign)
    } finally {
      authStore.inWalletSignature = false
    }
  }

  const signData = async (
    data: string,
    metadata: StdSignMetadata = { scope: ScopeType.AUTH, encoding: 'base64' }
  ): Promise<StdSignDataResponse> => {
    if (authStore.wallet === 'arc76') {
      if (authStore.signaturePromise) {
        throw new Error('Another signing request is already waiting for the ARC-76 password')
      }
      authStore.dataToSign = data
      authStore.usignedTxs = []
      authStore.signaturePromise = createDeferred<Uint8Array[]>()
      authStore.inArc76Signature = true
      try {
        const [signature] = await authStore.signaturePromise.promise
        const signer = algosdk.decodeAddress(authStore.account).publicKey
        return { ...(await createStdSignData(data, signer)), signature }
      } finally {
        authStore.signaturePromise = null
        authStore.inArc76Signature = false
        authStore.dataToSign = ''
      }
    }
    if (!walletApi) {
      throw new Error('No wallet available - is WalletManagerPlugin installed?')
    }
    if (!walletApi.activeWallet.value?.canSignData) {
      throw new Error('The connected wallet does not support signing arbitrary data (ARC-60)')
    }
    authStore.inWalletSignature = true
    try {
      return await walletApi.signData(data, metadata)
    } finally {
      authStore.inWalletSignature = false
    }
  }

  const canSignData = () =>
    authStore.wallet === 'arc76' || !!walletApi?.activeWallet.value?.canSignData

  return { authStore, authenticate, logout, sign, signData, canSignData }
}
