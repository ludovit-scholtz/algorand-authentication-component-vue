# algorand-authentication-component-vue

[![npm](https://img.shields.io/npm/v/algorand-authentication-component-vue?label=npm)](https://www.npmjs.com/package/algorand-authentication-component-vue)
[![CI](https://github.com/ludovit-scholtz/algorand-authentication-component-vue/actions/workflows/ci.yml/badge.svg)](https://github.com/ludovit-scholtz/algorand-authentication-component-vue/actions/workflows/ci.yml)

**Sign-in for Algorand / AVM apps in Vue 3.** One component gives your users two ways to authenticate — any
[`@txnlab/use-wallet`](https://github.com/TxnLab/use-wallet) 5 wallet (Biatec, Pera, Defly, Exodus, Kibisis, Lute, …) or
an **ARC-76** account derived from an email and a password — and hands your app a signed **ARC-14**
`Authorization` header that your backend can verify without any shared secret.

|                 |                                                                                                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📦 **npm**      | <https://www.npmjs.com/package/algorand-authentication-component-vue>                                                                                                                                                                  |
| 📖 **npm docs** | the package README on the npm page above, and the shipped files: <https://unpkg.com/browse/algorand-authentication-component-vue/>                                                                                                     |
| 🧭 **Guides**   | [Integration guide](algorand-authentication-component-vue/docs/INTEGRATION.md) · [AI agent playbook](algorand-authentication-component-vue/docs/AI_INTEGRATION.md) · [Migration](algorand-authentication-component-vue/docs/MIGRATION.md) · [Changelog](algorand-authentication-component-vue/CHANGELOG.md) |
| ▶️ **Live demo** | <https://algorand-authentication-demo-seven.vercel.app>                                                                                                                                                                                |

> **Version note.** The npm releases up to `2.0.6` are the older line built on use-wallet 4 and PrimeVue. The
> code in this repository (use-wallet 5, no PrimeVue/Tailwind, ARC-60 data signing, 14 languages) is the next
> major line — see the [changelog](algorand-authentication-component-vue/CHANGELOG.md) and
> [migration guide](algorand-authentication-component-vue/docs/MIGRATION.md), and check the version on npm before installing.

## Why use it

- **Passwordless backends.** The user signs a zero-fee self payment (`<realm>#ARC14`); your API verifies the
  Ed25519 signature, the realm and the validity window. No sessions to steal, no passwords to store, no
  secret shared with the frontend.
- **Wallets and email/password in one screen.** Crypto-native users connect a wallet; everyone else signs in
  with an ARC-76 account that is derived in the browser (PBKDF2) — the same account in every ARC-76 app,
  nothing stored anywhere.
- **Built on use-wallet 5.** Whatever wallets you register are offered automatically, including
  [Biatec Wallet](https://wallet.biatec.io) through WalletConnect and Liquid Auth.
- **More than login.** The same session signs **transactions** (`auth.sign`) and **raw data** (ARC-60,
  `auth.signData`), with the right UI for each account type (wallet approval or password dialog).
- **Two usage modes.** A _protected app_ (sign-in screen until authenticated) or a _public page_ with a Login
  button whose content changes once the user is signed in — see the live demo's mode switch.
- **Production-ready UI.** Responsive, accessible (labels, focus handling, keyboard), themeable with CSS
  variables, **14 languages** (af cs de en es hu it ko nl pl ru sk tr zh), no PrimeVue/Tailwind required.
- **Tested end to end.** Unit tests plus Playwright suites for ARC-76, wallets, localization and a live round
  trip with Biatec Wallet.
- **AI-friendly.** A written integration guide, an agent playbook (`SKILL.md`) and `llms.txt` ship with the
  package so coding agents can integrate it correctly.

## Quick start

```bash
npm i algorand-authentication-component-vue @txnlab/use-wallet-vue algosdk vue
# plus the wallets you want to offer, e.g.
npm i @txnlab/use-wallet-pera @txnlab/use-wallet-defly biatec-wallet-use-wallet-client
```

**1. Register the wallets once** (`main.ts`):

```ts
import 'algorand-authentication-component-vue/style.css'
import { createApp } from 'vue'
import { WalletManagerPlugin } from '@txnlab/use-wallet-vue'
import { biatec } from 'biatec-wallet-use-wallet-client'
import { pera } from '@txnlab/use-wallet-pera'
import App from './App.vue'

createApp(App)
  .use(WalletManagerPlugin, {
    wallets: [biatec({ projectId: import.meta.env.VITE_WC_PROJECT_ID }), pera()],
    defaultNetwork: 'mainnet'
  })
  .mount('#app')
```

**2a. Protect the whole app** (`App.vue`) — the sign-in screen replaces the content until the user signs in:

```vue
<script setup lang="ts">
import { AlgorandAuthentication, useAVMAuthentication } from 'algorand-authentication-component-vue'
const auth = useAVMAuthentication()
</script>

<template>
  <AlgorandAuthentication arc14Realm="MyApp" authorizedOnlyAccess>
    <p>Signed in as {{ auth.authStore.account }}</p>
    <button @click="auth.logout()">Log out</button>
  </AlgorandAuthentication>
</template>
```

**2b. …or a public page with a Login button** — drop `authorizedOnlyAccess` and switch the content on
`isAuthenticated`:

```vue
<AlgorandAuthentication arc14Realm="MyApp">
  <button v-if="!auth.authStore.isAuthenticated" @click="auth.authenticate()">Log in</button>
  <button v-else @click="auth.logout()">Log out</button>

  <PublicTeaser v-if="!auth.authStore.isAuthenticated" />
  <MemberArea v-else />
</AlgorandAuthentication>
```

**3. Call your API** with the signed header and verify it on the server:

```ts
fetch('/api/me', { headers: { Authorization: auth.authStore.arc14Header } }) // "SigTx <base64>"
```

The backend checks the decoded transaction (zero payment to self, note `MyApp#ARC14`, valid signature, current
round inside the validity window). A ready-made Node implementation is in the
[package README](algorand-authentication-component-vue/README.md#verifying-the-header-on-your-backend).

**Sign things** with the same session:

```ts
const [signed] = await auth.sign([txn], [0]) // transactions (wallet approval or password dialog)
const proof = await auth.signData(btoa('Sign in to MyApp')) // raw data (ARC-60)
```

Next: the [integration guide](algorand-authentication-component-vue/docs/INTEGRATION.md) covers both modes in
depth, localization, theming, testing and troubleshooting. Using an AI coding agent? Point it at
[`docs/AI_INTEGRATION.md`](algorand-authentication-component-vue/docs/AI_INTEGRATION.md).

## Repository

| Package                                                                          | What it is                                                                                                                 |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [`algorand-authentication-component-vue`](algorand-authentication-component-vue) | The npm package — component, composable, helpers, docs ([package README](algorand-authentication-component-vue/README.md)) |
| [`algorand-authentication-demo`](algorand-authentication-demo)                   | Demo app and Playwright end-to-end tests, including the live Biatec Wallet integration                                     |

```bash
pnpm install
pnpm build        # component: type-check + library + declarations
pnpm test         # component unit tests
pnpm demo         # demo dev server (needs a built component)
pnpm test:e2e     # Playwright (installs: pnpm --filter algorand-authentication-demo exec playwright install chromium)
```

Requires Node ≥ 20.19 and pnpm.
