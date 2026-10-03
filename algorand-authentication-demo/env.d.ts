/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** WalletConnect Cloud project id (https://cloud.reown.com) used by the Biatec wallet. */
  readonly VITE_WC_PROJECT_ID?: string
  /** `true` adds the use-wallet mnemonic adapter (testnet only) - used by the Playwright suite. */
  readonly VITE_E2E_MNEMONIC_WALLET?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
