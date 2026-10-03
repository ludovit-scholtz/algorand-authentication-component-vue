import algosdk from 'algosdk'

/** PBKDF2 round count defined by ARC-76. Do not change it - it determines the derived account. */
const ARC76_ITERATIONS = 999999
const encoder = new TextEncoder()

/**
 * Derives the ARC-76 account for an email + password pair. Runs PBKDF2-SHA256 through the
 * browser's Web Crypto API (about half a second on a modern device).
 */
export const deriveArc76Account = async (
  email: string,
  password: string
): Promise<algosdk.Account> => {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error('Crypto API in browser is not available')
  }
  const init = `ARC-0076-${email}-${password}-0-PBKDF2-${ARC76_ITERATIONS}`
  const salt = `ARC-0076-${email}-0-PBKDF2-${ARC76_ITERATIONS}`
  const key = await subtle.importKey('raw', encoder.encode(init), 'PBKDF2', false, [
    'deriveBits',
    'deriveKey'
  ])
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: ARC76_ITERATIONS },
    key,
    256
  )
  const mnemonic = algosdk.mnemonicFromSeed(new Uint8Array(bits))
  return algosdk.mnemonicToSecretKey(mnemonic)
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isValidEmail = (email: string): boolean => EMAIL_REGEX.test(email)
export const ARC76_MIN_PASSWORD_LENGTH = 16
