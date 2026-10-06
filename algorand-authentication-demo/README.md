# Algorand authentication demo

**Live: <https://algorand-authentication-demo-seven.vercel.app>**

Reference app for [`algorand-authentication-component-vue`](../algorand-authentication-component-vue) v3 —
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

The demo **starts on the public page** and has a **Mode** switch (`?mode=public` default, `?mode=protected`): public shows a page with a Login button, a locked members area and a *Guest* chip, and the content (and header chip) changes once the user is authenticated; protected shows only the sign-in screen until the user signs in. See [`docs/INTEGRATION.md`](../algorand-authentication-component-vue/docs/INTEGRATION.md).

What to look at:

- [`src/main.ts`](src/main.ts) — wallet registration for use-wallet 5, extra networks (Voi, Aramid), Node globals
  required by the wallet SDKs.
- [`src/App.vue`](src/App.vue) — `<AlgorandAuthentication>` with `authorizedOnlyAccess`, reading the session
  through `useAVMAuthentication()`, signing a transaction (`auth.sign`), signing raw ARC-60 data (`auth.signData`) with client-side verification, logout, switching the network, and a language picker (`?lang=xx`, remembered, defaults to the browser language) covering all 14 languages of Biatec Wallet and Biatec DEX. [`src/i18n.ts`](src/i18n.ts) / [`src/messages.ts`](src/messages.ts) hold the demo page strings; the component ships its own.

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
| [`e2e/public-page.spec.ts`](e2e/public-page.spec.ts) | **Public page vs protected app**: guest view without a sign-in screen, Login buttons open it and *Go back* closes it, content/header chip change after sign-in and after logout, mode switch and `?mode`, combination with `?lang`, no horizontal overflow on a phone. |
| [`e2e/locales.spec.ts`](e2e/locales.spec.ts) | **Localization**: catalog completeness and placeholders, and for each of the 14 languages the sign-in screen, validation, registration, password toggle, the signed-in demo, transaction and data signing dialogs with errors, toasts and logout; language picker, `?lang`, remembered language, browser-language detection per locale, unsupported-language fallback, no horizontal overflow with long translations. |
| [`e2e/biatec-live.spec.ts`](e2e/biatec-live.spec.ts) | **Live Biatec Wallet**: creates a throw-away wallet on <https://wallet.biatec.io>, pairs it with the demo via the WalletConnect URI of the built-in dialog, approves the ARC-14 request (checks the realm shown in the wallet and the returned header), signs a transaction, signs raw ARC-60 data (verified independently in Node), logs out and checks the wallet session disappears; plus the “user rejects in the wallet” path and the language of Biatec's connect dialog for all 14 languages (the four DEX-only ones fall back to English). |

The live spec serves the demo as `https://demo.biatec-e2e.test` through a Playwright route, because Biatec Wallet only accepts ARC-60 requests whose domain equals the page's port-less hostname.

The live spec needs internet access (wallet.biatec.io, the WalletConnect relay, an algod node) and creates
only empty, unfunded accounts in the browser profile of the test run. If wallet.biatec.io changes its UI the
selectors in the helper functions at the top of the spec are the only place to adapt.
