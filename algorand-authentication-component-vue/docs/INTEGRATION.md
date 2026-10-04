# Integration guide

How to add Algorand sign-in to a Vue 3 app with `algorand-authentication-component-vue` v2 — written for
developers **and** for AI coding agents. Every snippet is taken from the working
[demo app](https://github.com/ludovit-scholtz/algorand-authentication-component-vue/tree/main/algorand-authentication-demo)
(live: <https://algorand-authentication-demo-seven.vercel.app>), which is covered by Playwright tests.

> **AI agents:** read this file top to bottom, then follow the machine-oriented playbook in
> [`skill/algorand-authentication-integration/SKILL.md`](../skill/algorand-authentication-integration/SKILL.md)
> (context-gathering questions, verification checklist, troubleshooting table). Do not use APIs that are not
> written in these two files — v1.x / use-wallet 4 / PrimeVue snippets are wrong for v2.

Contents: [1. Pick a mode](#1-pick-a-mode) · [2. Install and register wallets](#2-install-and-register-wallets) ·
[3. Protected app](#3-protected-app) · [4. Public page with a Login button](#4-public-page-with-a-login-button) ·
[5. Call your API](#5-call-your-api-with-the-arc-14-header) · [6. Verify on the backend](#6-verify-the-header-on-your-backend) ·
[7. Sign transactions and data](#7-sign-transactions-and-data) · [8. Localization and theming](#8-localization-and-theming) ·
[9. Test your integration](#9-test-your-integration) · [10. Troubleshooting](#10-troubleshooting) · [11. Checklist](#11-checklist)

## 1. Pick a mode

| You want…                                                   | Mode                     | Switch                                                                                  |
| ----------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| The whole app (or a section) behind a login                 | **Protected**            | `<AlgorandAuthentication authorizedOnlyAccess>` — the sign-in screen replaces the slot  |
| A normal page for everybody with a *Login* button; extra content or features once signed in | **Public page** | no `authorizedOnlyAccess`; a button calls `auth.authenticate()`; the slot reacts to `auth.authStore.isAuthenticated` |

You can mix them: wrap everything in one `<AlgorandAuthentication>` without `authorizedOnlyAccess` and use
`isAuthenticated` (or the `<RequireAuth>` helper below) to protect individual pages. The demo has a *Mode*
switch (`?mode=public` / `?mode=protected`) that shows both on the same page.

## 2. Install and register wallets

```bash
pnpm add algorand-authentication-component-vue @txnlab/use-wallet-vue algosdk vue
# one package per wallet you offer
pnpm add @txnlab/use-wallet-pera @txnlab/use-wallet-defly biatec-wallet-use-wallet-client
```

```ts
// main.ts
import 'algorand-authentication-component-vue/style.css'          // required, once
import { Buffer } from 'buffer'
import { createApp } from 'vue'
import { WalletManagerPlugin } from '@txnlab/use-wallet-vue'
import { biatec } from 'biatec-wallet-use-wallet-client'
import { pera } from '@txnlab/use-wallet-pera'
import { defly } from '@txnlab/use-wallet-defly'
import App from './App.vue'

Object.assign(window, { Buffer, process: { env: {}, version: '' } }) // Pera/Defly/WalletConnect SDKs

createApp(App)
  .use(WalletManagerPlugin, {
    wallets: [
      biatec({ projectId: import.meta.env.VITE_WC_PROJECT_ID, locale: navigator.language }),
      pera(),
      defly()
    ],
    defaultNetwork: 'mainnet'
  })
  .mount('#app')
```

- `WalletManagerPlugin` must be installed before any component calls `useWallet()` / `useAVMAuthentication()`.
- Vite needs `define: { global: 'globalThis' }` for the WalletConnect-based wallets.
- ARC-76 (email + password) accounts work without any wallet package, but need HTTPS or `localhost`
  (`crypto.subtle`).
- Get a WalletConnect `projectId` (free) at <https://cloud.reown.com>; keep it in an env var.

## 3. Protected app

```vue
<!-- App.vue -->
<script setup lang="ts">
import { AlgorandAuthentication, useAVMAuthentication } from 'algorand-authentication-component-vue'
const auth = useAVMAuthentication()
</script>

<template>
  <AlgorandAuthentication arc14Realm="MyApp" authorizedOnlyAccess>
    <!-- rendered only after sign-in -->
    <header>
      {{ auth.authStore.account }} · {{ auth.authStore.wallet }}
      <button @click="auth.logout()">Log out</button>
    </header>
    <RouterView />
  </AlgorandAuthentication>
</template>
```

Until the user signs in, only the two-panel sign-in screen (email + password | wallets) is shown; the slot is
not rendered, so no protected component runs.

## 4. Public page with a Login button

The page renders for everybody. Guests see the public content and a **Login** button; the button opens the
sign-in screen; when the user finishes signing in, the screen closes and the same slot now shows the member
content. This is the `?mode=public` page of the demo.

```vue
<script setup lang="ts">
import { AlgorandAuthentication, useAVMAuthentication } from 'algorand-authentication-component-vue'
const auth = useAVMAuthentication()
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-6)}`
</script>

<template>
  <!-- no authorizedOnlyAccess: the slot is visible until authenticate() is called -->
  <AlgorandAuthentication arc14Realm="MyApp">
    <header>
      <template v-if="auth.authStore.isAuthenticated">
        <span>{{ short(auth.authStore.account) }}</span>
        <button @click="auth.logout()">Log out</button>
      </template>
      <template v-else>
        <span>Guest</span>
        <button @click="auth.authenticate()">Log in</button>   <!-- opens the sign-in screen -->
      </template>
    </header>

    <!-- content that changes with the authentication state -->
    <section v-if="!auth.authStore.isAuthenticated">
      <h1>Welcome! This page is public</h1>
      <p>Log in to unlock your account area.</p>
      <button @click="auth.authenticate()">Log in</button>
    </section>
    <section v-else>
      <h1>Welcome back</h1>
      <MemberArea />
    </section>
  </AlgorandAuthentication>
</template>
```

Behavior to rely on (all covered by the demo's Playwright tests):

- `auth.authenticate()` shows the sign-in screen; its **Go back** button hides it again without signing in.
- A successful sign-in sets `isAuthenticated = true` and closes the screen — you do not need to do anything.
- `await auth.logout()` disconnects the wallet, clears the session and brings the guest view back.
- The component emits `authenticated` (`{ account, wallet, arc14Header }`) if you prefer events over reactivity.
- Page reload: the ARC-14 header is not persisted; a restored wallet session shows a one-click
  *Sign in with \<wallet\>* in the sign-in screen.

**Protecting single routes in a public app** — a tiny wrapper:

```vue
<!-- RequireAuth.vue -->
<script setup lang="ts">
import { useAVMAuthentication } from 'algorand-authentication-component-vue'
const auth = useAVMAuthentication()
</script>
<template>
  <slot v-if="auth.authStore.isAuthenticated" />
  <div v-else>
    <p>Please log in to continue.</p>
    <button @click="auth.authenticate()">Log in</button>
  </div>
</template>
```

Use it as `<RequireAuth><AccountPage /></RequireAuth>` inside the `<AlgorandAuthentication>` slot. Route guards
that run outside `setup()` cannot reach the session, so guard in components (and on the server, see §6).

## 5. Call your API with the ARC-14 header

After sign-in `auth.authStore.arc14Header` is `SigTx <base64>` — send it as `Authorization`:

```ts
// useApi.ts
import { useAVMAuthentication } from 'algorand-authentication-component-vue'

export function useApi() {
  const auth = useAVMAuthentication() // call inside setup()
  return async (path: string, init: RequestInit = {}) => {
    const res = await fetch(path, {
      ...init,
      headers: { ...init.headers, Authorization: auth.authStore.arc14Header }
    })
    if (res.status === 401) {           // header expired (~50 min) or rejected
      await auth.logout()
      auth.authenticate()               // ask the user to sign in again
    }
    return res
  }
}
```

React to logins/logouts with `watch(() => auth.authStore.count, …)` (it increments on every login and logout).

## 6. Verify the header on your backend

The header is a base64 msgpack **signed** zero-amount self payment, never sent to the network. On every
request: decode it, require `amount = 0`, `fee = 0`, `sender == receiver`, note exactly `<realm>#ARC14` for
**your** realm, a valid Ed25519 signature over `"TX" + unsigned msgpack` (by `sgnr` if rekeyed), and the
current round inside `firstValid … lastValid`. `sender` is the authenticated address.
Node/TypeScript implementation: [README → Verifying the header on your backend](../README.md#verifying-the-header-on-your-backend).
Any Algorand SDK (decode signed transaction) works for other languages — the checks are identical.

## 7. Sign transactions and data

```ts
const auth = useAVMAuthentication()

// transactions — wallets show their approval screen, ARC-76 accounts a password dialog
const [signed] = await auth.sign([txn], [0])

// raw data (ARC-60) — data is base64
if (auth.canSignData()) {
  const res = await auth.signData(btoa('Sign in to MyApp'))   // { signer, domain, authenticatorData, signature }
  await verifyArc60(res)                                      // true
}
```

Both reject when the user cancels or the wallet fails — wrap them in `try/catch`; the session stays valid.
Biatec Wallet only accepts ARC-60 requests from a port-less host (`https://app.example`, not `localhost:5173`).

## 8. Localization and theming

```vue
<AlgorandAuthentication arc14Realm="MyApp" :locale="appLocale" :messages="{ signIn: 'Welcome' }" />
```

14 languages (`af cs de en es hu it ko nl pl ru sk tr zh`); default is the browser language, English fallback.
Pass the same locale to `biatec({ projectId, locale })` for Biatec's own dialog (`af cs en es hu it nl ru sk tr`;
others fall back to English there; it reads the locale once at startup). Theme with CSS variables:

```css
.aa-root { --aa-primary: #7c3aed; --aa-primary-hover: #6d28d9; --aa-radius: 0.75rem; }
```

Or pass `cover-image="/bg.jpg"`. Full variable list: [README → Styling](../README.md#styling).

## 9. Test your integration

The demo's [`e2e/`](https://github.com/ludovit-scholtz/algorand-authentication-component-vue/tree/main/algorand-authentication-demo/e2e)
folder is a ready-to-copy Playwright suite. Patterns that work:

- Stub algod: `page.route('**/v2/transactions/params', route => route.fulfill({ json: { 'genesis-hash': '…', 'genesis-id': 'testnet-v1.0', 'last-round': 5000000, fee: 0, 'min-fee': 1000, 'consensus-version': 'future' } }))`.
- Derive the expected ARC-76 address independently: `pbkdf2Sync(init, salt, 999999, 32, 'sha256')` with
  `init = ARC-0076-${email}-${password}-0-PBKDF2-999999` and `salt = ARC-0076-${email}-0-PBKDF2-999999`, then
  `algosdk.mnemonicFromSeed` → address.
- Wallet flows without a phone: `@txnlab/use-wallet-mnemonic` on testnet.
- Stable selectors: `data-testid` `aa-screen`, `aa-title`, `aa-wallet-<id>`, `aa-wallet-error`, `aa-form-error`,
  `aa-session`, `aa-sign-dialog`, `aa-sign-error`; field ids `#e` (email), `#p` (password), `#p2` (confirmation),
  `#aa-sign-password`; the screen carries `lang="<locale>"`.
- Real wallet: `e2e/biatec-live.spec.ts` pairs the demo with <https://wallet.biatec.io> end to end.

## 10. Troubleshooting

| Symptom                                                 | Cause / fix                                                                                  |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Unstyled sign-in screen                                 | `import 'algorand-authentication-component-vue/style.css'` is missing.                       |
| `useWallet` / injection errors, or `sign()` never ends  | `WalletManagerPlugin` not installed, composable called outside `setup()`, or the component is not mounted (ARC-76 dialogs live inside it). |
| Login button does nothing in public mode                | The button must call `auth.authenticate()` and sit inside (or alongside) a mounted `<AlgorandAuthentication>`. |
| Screen shows although the page should be public         | `authorizedOnlyAccess` is set.                                                               |
| No wallets listed                                       | Wallet packages not passed to the plugin, `wallets` prop filters them out, or none supports the active network. |
| `Buffer is not defined`                                 | Add the globals from §2 and `define: { global: 'globalThis' }`.                              |
| `Crypto API in browser is not available`                | ARC-76 on a non-HTTPS origin.                                                                |
| Backend rejects the header                              | Realm mismatch, header older than ~1000 rounds, or the `"TX"` prefix is missing when verifying. |
| Biatec data signing fails                               | Page host has a port (`localhost:5173`); use a port-less host.                               |

## 11. Checklist

- [ ] Style import, `WalletManagerPlugin` with the wallets you want, WalletConnect project id from env
- [ ] `<AlgorandAuthentication arc14Realm="…">` around the UI (with or without `authorizedOnlyAccess`)
- [ ] Login button → `auth.authenticate()`; logout → `await auth.logout()`
- [ ] API calls send `Authorization: auth.authStore.arc14Header`; 401 → logout + authenticate
- [ ] Backend verifies realm, signature and validity window
- [ ] `locale` set if your app is localized; same locale passed to `biatec()`
- [ ] Playwright test covering sign-in, content switch and logout
