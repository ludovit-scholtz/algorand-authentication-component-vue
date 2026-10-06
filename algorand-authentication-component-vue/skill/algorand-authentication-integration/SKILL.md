---
name: algorand-authentication-integration
description: Add Algorand / AVM sign-in (ARC-14 wallet signatures via @txnlab/use-wallet 5, or ARC-76 email + password accounts) to a Vue 3 app with algorand-authentication-component-vue v2. Use when asked to add Algorand login, wallet connect + authentication, an `Authorization: SigTx` header, ARC-14 / ARC-76 auth, or to migrate algorand-authentication-component-vue 1.x to 2.x.
---

# Integrate algorand-authentication-component-vue (v3)

You are adding a sign-in screen and a signed-in session to a **Vue 3** app using
`algorand-authentication-component-vue@3` (<https://github.com/ludovit-scholtz/algorand-authentication-component-vue>).
Read `docs/INTEGRATION.md` of the package first (it contains the protected-app and public-page patterns with full code). Follow the steps in order, do not skip the verification section, and do not improvise APIs that are
not written here — v1.x, use-wallet 3/4 and PrimeVue-era snippets you may remember are **wrong** for v3.

Portable: works as a Claude Code skill, a Cursor/Windsurf rule, Copilot instructions, or plain reading.

## What you get (so you pick the right tool)

- `<AlgorandAuthentication>` — full-screen two-panel sign-in (email/password | wallet list) that replaces
  its slot until the user is authenticated (`authorizedOnlyAccess`), plus an ARC-76 password dialog for signing.
- `useAVMAuthentication()` — reactive `authStore` (`isAuthenticated`, `account`, `wallet`, `arc14Header`, …),
  `authenticate()`, `logout()`, `sign()` (transactions), `signData()` (ARC-60 raw data), `canSignData()`.
- Result of a sign-in: `authStore.arc14Header` = `SigTx <base64>`; send it as the HTTP `Authorization`
  header; the backend verifies it (step 7). No cookies, no secrets, no passwords leave the browser.

Not for: React/Svelte (Vue 3 only), apps on `@txnlab/use-wallet` ≤ 4 (propose migrating to v5 first and
confirm with the user), or apps that only need "connect wallet" without authentication (use use-wallet directly).

## 0. Gather context

1. **Package manager** — `pnpm-lock.yaml` / `yarn.lock` / `package-lock.json` / `bun.lock`; use the one that exists.
2. **Vue 3 + bundler** — check `vue` ≥ 3.5 in `package.json`; Vite is assumed (Nuxt: see Step 8).
3. **Existing wallet code** — grep for `@txnlab/use-wallet`, `WalletManager`, `WalletManagerPlugin`,
   `algorand-authentication-component-vue`, `primevue`. If `use-wallet` v4 or `WalletId.PERA` enums exist,
   this is a migration: read `docs/MIGRATION.md` of the package and stop to confirm scope with the user.
4. **Which wallets** the user wants. Default suggestion: Biatec, Pera, Defly, Exodus, Kibisis, Lute.
5. **Network** — `mainnet` for production, `testnet` while developing. Voi/Aramid are available via
   `BIATEC_EXTRA_NETWORKS` (see the demo).
6. **WalletConnect project id** (needed by Biatec/WalletConnect wallets): look for an existing
   `VITE_WC_PROJECT_ID` / similar; otherwise tell the user to create one free at <https://cloud.reown.com> —
   you cannot invent it. Read it from an env var, never hardcode it, add it to `.env.example`.
7. **Backend** — does an API exist that must accept the header? Note its language for Step 7.
8. **Realm** — short unique app name, e.g. `MyApp`. It is written into the signed note (`MyApp#ARC14`) and the
   backend must check the same string. Ask the user if unclear; default to the product name.

## 1. Install

```bash
<pm> add algorand-authentication-component-vue @txnlab/use-wallet-vue algosdk
# one package per wallet the user picked:
<pm> add @txnlab/use-wallet-pera @txnlab/use-wallet-defly @txnlab/use-wallet-exodus \
         @txnlab/use-wallet-kibisis @txnlab/use-wallet-lute biatec-wallet-use-wallet-client
```

`vue`, `@txnlab/use-wallet-vue` (^5) and `algosdk` (^3.5) are **peer dependencies** — install them explicitly.
Do **not** install PrimeVue or Tailwind for this component; v3 needs neither.

## 2. Register wallets (`main.ts`)

```ts
import 'algorand-authentication-component-vue/style.css'   // REQUIRED, once
import { Buffer } from 'buffer'
import { createApp } from 'vue'
import { WalletManagerPlugin } from '@txnlab/use-wallet-vue'
import { biatec } from 'biatec-wallet-use-wallet-client'
import { pera } from '@txnlab/use-wallet-pera'
import { defly } from '@txnlab/use-wallet-defly'
import { exodus } from '@txnlab/use-wallet-exodus'
import { kibisis } from '@txnlab/use-wallet-kibisis'
import { lute } from '@txnlab/use-wallet-lute'
import App from './App.vue'

// Pera / Defly / WalletConnect SDKs expect Node globals in the browser
Object.assign(window, { Buffer, process: { env: {}, version: '' } })

createApp(App)
  .use(WalletManagerPlugin, {
    wallets: [
      biatec({ projectId: import.meta.env.VITE_WC_PROJECT_ID, metadata: { name: 'MyApp', description: 'MyApp', url: window.location.origin, icons: [] } }),
      pera(), defly(), exodus(), kibisis(), lute()
    ],
    defaultNetwork: 'mainnet'
  })
  .mount('#app')
```

Rules:

- The wallet config is an **object passed to the plugin** (`wallets: [factory(), …]`). v4's
  `WalletId.PERA` enum and `{ id: WalletId.X, options }` entries do **not** exist in v5.
- `WalletManagerPlugin` must be installed **before** any component calls `useWallet()` /
  `useAVMAuthentication()`.
- Vite: add `define: { global: 'globalThis' }` to `vite.config.ts` and install `buffer` if the build complains.
- Optional extra networks: `new NetworkConfigBuilder().addNetwork('voimain', BIATEC_EXTRA_NETWORKS.voimain).build()` →
  `networks` option (exports from `@txnlab/use-wallet-vue` and `biatec-wallet-use-wallet-client`).
- Testnet-only dev wallet: `@txnlab/use-wallet-mnemonic` (`mnemonic({ promptForMnemonic })`); never ship it to production.

## 3. Wrap the protected UI

```vue
<script setup lang="ts">
import { AlgorandAuthentication, useAVMAuthentication, type INotification } from 'algorand-authentication-component-vue'

const auth = useAVMAuthentication()

function onNotification(n: INotification) {
  // show in the project's existing toast/snackbar system; n.severity is 'error' | 'success' | 'info' | 'warn'
}
</script>

<template>
  <AlgorandAuthentication arc14Realm="MyApp" authorizedOnlyAccess @onNotification="onNotification">
    <!-- everything here renders only after sign-in -->
    <RouterView />
  </AlgorandAuthentication>
</template>
```

Choose the mode:

| Need                                              | Use                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Whole app behind login                            | `authorizedOnlyAccess` on a wrapper around the root content.                                           |
| Public pages + optional login                     | No `authorizedOnlyAccess`; a "Log in" button calls `auth.authenticate()`; the screen closes itself on success; its "Go back" button cancels. |
| Only some wallets                                 | `:wallets="['biatec','pera']"` (use-wallet wallet ids).                                                |
| Custom algod instead of the active network's      | `algodHost`, `algodPort`, `algodToken`.                                                                |
| Brand look                                        | Override `--aa-*` CSS variables on `.aa-root` or pass `coverImage`; see README "Styling".              |
| Dark mode                                         | Automatic (`theme="auto"`: OS + host `.dark`/`data-theme="dark"`); force with `theme="light"\|"dark"`.   |

Props: `arc14Realm` (required), `authorizedOnlyAccess`, `wallets`, `algodHost`, `algodPort`, `algodToken`, `coverImage`, `locale`, `messages`, `theme`.
Events: `onNotification`, `authenticated`. There is **no** `onStateChange`, `useDemoMnemonics` or `class` prop in v2
(attributes like `class` fall through to the screen root).

### Localization

Built in for `af cs de en es hu it ko nl pl ru sk tr zh` (the languages of Biatec Wallet + Biatec DEX).
Default = browser language, English fallback. To follow the app's own language pass `:locale="appLocale"`;
override single strings with `:messages="{ signIn: '…' }"`. Biatec's connect dialog is configured separately:
`biatec({ projectId, locale: appLocale })` (supports `af cs en es hu it nl ru sk tr`, others show English) and reads
the locale once at startup, so changing language at runtime needs a reload for that dialog. Do not translate the
component by hand and do not hardcode English strings next to it.

## 4. Use the session

```ts
const auth = useAVMAuthentication()   // call inside setup() only
auth.authStore.isAuthenticated        // boolean
auth.authStore.account                // address
auth.authStore.wallet                 // 'arc76' | 'biatec' | 'pera' | …
auth.authStore.arc14Header            // 'SigTx …' for the Authorization header
await auth.logout()                   // async: disconnects the wallet, clears the store
```

Attach the header to the project's HTTP layer (fetch/axios interceptor), and when `authStore.count` changes
(`watch(() => auth.authStore.count, …)`) refresh whatever depends on the user. The header is **not persisted**:
after a full page reload the user signs in again (a restored wallet session shows a one-click
"Sign in with <wallet>" button). The header expires with the transaction validity window (~1000 rounds, ≈ 50 min on
mainnet); handle `401` by calling `auth.logout()` then `auth.authenticate()`.

## 5. Sign transactions

```ts
const algod = useWallet().algodClient.value         // from '@txnlab/use-wallet-vue'
const suggestedParams = await algod.getTransactionParams().do()
const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: auth.authStore.account, receiver, amount, suggestedParams })
try {
  const [signed] = await auth.sign([txn], [0])       // works for wallets AND ARC-76 accounts
  await algod.sendRawTransaction(signed).do()
} catch (e) { /* user cancelled or wallet rejected: show e.message, session stays valid */ }
```

- Always use `auth.sign(...)` (not `useWallet().transactionSigner` directly) so ARC-76 users get the password dialog.
- Raw data (ARC-60): `const res = await auth.signData(btoa(message))` → `{ signer, domain, authenticatorData, signature }`;
  check `auth.canSignData()` first (wallets must support it; ARC-76 accounts always do). The signed bytes are
  `SHA-256(data) || SHA-256(authenticatorData)`; `verifyArc60(res)` checks it client-side. Biatec Wallet rejects it when
  `location.host` contains a port (e.g. `localhost:5173`) — test on a port-less host.
- `indexesToSign` lists the group positions owned by the signed-in account.
- ARC-76 users re-enter their password for every signing request; cancelling rejects with
  `Signing cancelled by user`.

## 6. ARC-76 notes (email + password accounts)

- Account = PBKDF2-SHA256(999 999 rounds) of email + password, identical in every ARC-76 app. Min. password length is **16**.
- Needs `crypto.subtle` → HTTPS or `localhost`. Plain `http://` hosts fail with "Crypto API in browser is not available".
- There is no server component and no password reset; losing the password loses the account.

## 7. Backend verification (do not skip — the header is useless unless verified)

Per request: decode `SigTx` (base64 → msgpack signed transaction), require a payment with amount 0, fee 0,
sender == receiver, note exactly `<realm>#ARC14` (**your realm**), a valid Ed25519 signature over `"TX" + unsigned
msgpack` by the sender (or `sgnr` if rekeyed), and the current round inside `firstValid..lastValid`. The sender is
the authenticated address. Ready-made Node/TypeScript code: package README → "Verifying the header on your backend".
Other languages: any Algorand SDK (`decode signed transaction`) + the same checks. Reject everything else.

## 8. Framework notes

- **Nuxt**: render `<AlgorandAuthentication>` client-only (`<ClientOnly>`), install `WalletManagerPlugin` in a
  `plugins/wallet.client.ts`, import the CSS in `nuxt.config.ts` (`css: ['algorand-authentication-component-vue/style.css']`).
- **Vue Router**: keep the router outside or inside the component — both work; a route guard is optional because the
  component already hides the slot. Guard API routes on the backend, not in the browser.
- **SSR/Vitest**: `useWallet()` needs the plugin; in unit tests mock `@txnlab/use-wallet-vue` or install the plugin.
- **Pinia**: do not copy `authStore` into Pinia; read the reactive store directly (`toRefs` if destructuring).

## 9. Verify before you say "done"

1. `<pm> run build` / type-check passes (no `primevue` import left, no v4 `WalletId` usage).
2. Start the dev server; the sign-in screen shows email form + the chosen wallets with logos.
3. Sign in with an ARC-76 test account (any email + 16+ char password) → slot renders, `arc14Header` starts with `SigTx `.
4. If a backend exists: call it with that header → 200; with a wrong realm / altered header → 401.
5. Click logout → sign-in screen returns; for a wallet login the wallet shows as disconnected.
6. Add a Playwright test (optional but recommended). Patterns that work, from the package's own suite
   (`algorand-authentication-demo/e2e`): stub algod with
   `page.route('**/v2/transactions/params', …)`; derive the expected ARC-76 address with Node's `pbkdf2Sync(init, salt, 999999, 32, 'sha256')`;
   use `@txnlab/use-wallet-mnemonic` (testnet) for deterministic wallet tests; select by `data-testid`
   (`aa-screen`, `aa-title`, `aa-wallet-<id>`, `aa-wallet-error`, `aa-form-error`, `aa-sign-dialog`, `aa-sign-error`,
   `aa-session`) or by the field ids `#e`, `#p`, `#p2`.

## Troubleshooting

| Symptom                                                         | Cause / fix                                                                                              |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Unstyled sign-in screen                                         | `import 'algorand-authentication-component-vue/style.css'` is missing.                                   |
| `Cannot read … of undefined` / `useWallet` injection warnings   | `WalletManagerPlugin` not installed, or the composable is called outside `setup()`.                      |
| No wallets listed                                               | Wallet packages not passed to the plugin, `wallets` prop filters them out, or the wallet does not support the active network (e.g. mnemonic on mainnet). |
| `Buffer is not defined` / `process is not defined` at connect   | Add the globals from Step 2 and `define: { global: 'globalThis' }`.                                      |
| Biatec dialog never shows a QR / connect fails                  | Missing or invalid `projectId`; blocked WalletConnect relay (`wss://relay.walletconnect.com`).           |
| `Crypto API in browser is not available`                        | ARC-76 on non-HTTPS origin.                                                                              |
| `Password is invalid` while signing                             | Different email/password than the one used to sign in; ARC-76 accounts are derived, not stored.         |
| Backend rejects the header                                      | Realm mismatch, header older than ~1000 rounds, or the backend skipped the `"TX"` prefix when verifying. |
| `sign()` never resolves                                         | The component is not mounted anywhere, so no password dialog exists for ARC-76 signing.                  |
| 1.x / 2.0.x code: `onStateChange`, `useDemoMnemonics`, `wallets=['pera','myalgo']` | Removed/changed — see `docs/MIGRATION.md`.                                                  |
