import 'algorand-authentication-component-vue/style.css'
import './assets/main.css'

import { Buffer } from 'buffer'
import { createApp } from 'vue'
import {
  NetworkConfigBuilder,
  WalletManagerPlugin,
  type WalletAdapterConfig
} from '@txnlab/use-wallet-vue'
import { biatec, BIATEC_EXTRA_NETWORKS } from 'biatec-wallet-use-wallet-client'
import { defly } from '@txnlab/use-wallet-defly'
import { exodus } from '@txnlab/use-wallet-exodus'
import { kibisis } from '@txnlab/use-wallet-kibisis'
import { lute } from '@txnlab/use-wallet-lute'
import { mnemonic } from '@txnlab/use-wallet-mnemonic'
import { pera } from '@txnlab/use-wallet-pera'

import App from './App.vue'

// Wallet SDKs (Pera, Defly, WalletConnect) still expect these Node-style globals.
const globals = window as unknown as Record<string, unknown>
globals.Buffer = Buffer
globals.process = { env: {}, version: '' }

// WalletConnect Cloud project id - create your own at https://cloud.reown.com
const projectId = import.meta.env.VITE_WC_PROJECT_ID ?? 'fcfde0713d43baa0d23be0773c80a72b'

const networks = new NetworkConfigBuilder()
  .addNetwork('voimain', BIATEC_EXTRA_NETWORKS.voimain)
  .addNetwork('aramidmain', BIATEC_EXTRA_NETWORKS.aramidmain)
  .build()

const wallets: WalletAdapterConfig[] = [
  biatec({
    projectId,
    metadata: {
      name: 'Algorand Authentication Demo',
      description: 'ARC-14 authentication with use-wallet 5 and ARC-76 accounts',
      url: window.location.origin,
      icons: []
    }
  }),
  pera(),
  defly(),
  exodus(),
  kibisis(),
  lute()
]

// Testnet-only adapter that signs with a throw-away key. Enabled by the Playwright suite so the
// wallet sign-in path can be tested end to end without a phone or a browser extension.
if (import.meta.env.VITE_E2E_MNEMONIC_WALLET === 'true') {
  wallets.push(
    mnemonic({
      promptForMnemonic: async () => window.localStorage.getItem('e2e-mnemonic')
    })
  )
}

createApp(App)
  .use(WalletManagerPlugin, {
    wallets,
    networks,
    defaultNetwork: 'testnet'
  })
  .mount('#app')
