# Algorand authentication demo

Reference app for [`algorand-authentication-component-vue`](../algorand-authentication-component-vue) v2 —
Vue 3, `@txnlab/use-wallet-vue` 5, the Biatec wallet adapter
([`biatec-wallet-use-wallet-client`](https://www.npmjs.com/package/biatec-wallet-use-wallet-client)) next to
Pera, Defly, Exodus, Kibisis and Lute, and ARC-76 email + password accounts. No PrimeVue; Tailwind is used only
by the demo page itself.

```bash
pnpm install          # at the repository root (pnpm workspace)
pnpm build            # builds the component library first, then:
pnpm --filter algorand-authentication-demo dev
```

Open <http://localhost:5173> (the component must be built first: `pnpm build` at the root). Set `VITE_WC_PROJECT_ID` (see `.env.example`) to use your own
WalletConnect Cloud project id; the committed fallback is meant for local demos only.

What to look at:

- [`src/main.ts`](src/main.ts) — wallet registration for use-wallet 5, extra networks (Voi, Aramid), Node globals
  required by the wallet SDKs.
- [`src/App.vue`](src/App.vue) — `<AlgorandAuthentication>` with `authorizedOnlyAccess`, reading the session
  through `useAVMAuthentication()`, signing a transaction (`auth.sign`), signing raw ARC-60 data (`auth.signData`) with client-side verification, logout, switching the network.

## End-to-end tests (Playwright)

```bash
pnpm exec playwright install chromium
pnpm test:e2e            # everything below
pnpm test:e2e:offline    # no internet needed (desktop + mobile viewport)
pnpm test:e2e:live       # only the real Biatec Wallet integration
```

The Playwright config builds the demo with `VITE_E2E_MNEMONIC_WALLET=true` and serves it on port 4173.

| Spec                                          | Covers                                                                                                                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`e2e/component.spec.ts`](e2e/component.spec.ts) | Sign-in screen and wallet list, form validation, password reveal, registration, axe accessibility scan, ARC-76 login with an independently derived address and cryptographically verified ARC-14 header, password dialog (wrong password, cancel, Escape), optional authentication, wallet sign-in through use-wallet 5 (testnet mnemonic adapter), wallet errors, network-dependent wallet list. Runs on a desktop and a mobile viewport with a stubbed algod. |
| [`e2e/biatec-live.spec.ts`](e2e/biatec-live.spec.ts) | **Live Biatec Wallet**: creates a throw-away wallet on <https://wallet.biatec.io>, pairs it with the demo via the WalletConnect URI of the built-in dialog, approves the ARC-14 request (checks the realm shown in the wallet and the returned header), signs a transaction, signs raw ARC-60 data (verified independently in Node), logs out and checks the wallet session disappears; plus the “user rejects in the wallet” path. |

The live spec serves the demo as `https://demo.biatec-e2e.test` through a Playwright route, because Biatec Wallet only accepts ARC-60 requests whose domain equals the page's port-less hostname.

The live spec needs internet access (wallet.biatec.io, the WalletConnect relay, an algod node) and creates
only empty, unfunded accounts in the browser profile of the test run. If wallet.biatec.io changes its UI the
selectors in the helper functions at the top of the spec are the only place to adapt.
