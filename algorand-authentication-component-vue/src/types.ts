export type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Reactive state shared between `<AlgorandAuthentication>` and `useAVMAuthentication()`. */
interface IAuthenticationStore {
  /** The sign-in screen is requested (set by `authenticate()`). */
  inAuthentication: boolean
  /** The user has produced a valid ARC-14 header. */
  isAuthenticated: boolean
  /** `SigTx <base64>` value for the `Authorization` HTTP header. */
  arc14Header: string
  /** Wallet id used to sign in (`pera`, `biatec`, ...) or `arc76`. */
  wallet: string
  /** Authenticated Algorand address. */
  account: string
  /** Incremented on every login / logout so consumers can watch for changes. */
  count: number
  arc76email: string
  /** @deprecated kept for 1.x compatibility, unused in 3.x. */
  m: string
  /** @deprecated unused in 3.x - passwords are kept in component state, never in the store. */
  password: string
  /** @deprecated see `password`. */
  password2: string
  name: string
  emailIsValid: boolean
  inRegistration: boolean
  inRegistrationToSign: boolean
  /** Encoded unsigned transactions waiting for the ARC-76 password. */
  usignedTxs: Uint8Array[]
  /** Base64 payload waiting for the ARC-76 password (ARC-60 data signing); empty for transactions. */
  dataToSign: string
  /** The ARC-76 password dialog is open. */
  inArc76Signature: boolean
  /** A wallet is currently asked to sign. */
  inWalletSignature: boolean
  signaturePromise: null | Deferred<Uint8Array[]>
}

interface Account {
  walletId: string
  name: string
  address: string
  chain: string
  active: boolean
  dateConnected: number
  dateLastActive?: number
}

interface INotification {
  severity: 'error' | 'success' | 'info' | 'warn' | undefined
  message: string
}

export type { IAuthenticationStore, Account, INotification }
