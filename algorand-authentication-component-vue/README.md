# algorand-authentication-component-vue

Vue 3 sign-in component for Algorand / AVM apps. Users authenticate with **ARC-14** by signing a
zero-fee self payment — either with any [`@txnlab/use-wallet`](https://github.com/TxnLab/use-wallet)
**v5** wallet (Biatec, Pera, Defly, Exodus, Kibisis, Lute, …) or with an **ARC-76** account derived
from an email address and a password. Your backend receives a standard `Authorization: SigTx …`
header it can verify without any shared secret.

- **v3** — requires use-wallet 5, has **no PrimeVue / Tailwind dependency** (self-contained CSS), ships
  TypeScript types, and an [AI integration guide](docs/AI_INTEGRATION.md).
- **[Integration guide](https://github.com/ludovit-scholtz/algorand-authentication-component-vue/blob/main/algorand-authentication-component-vue/docs/INTEGRATION.md)** — protected app *and* public page with a Login button, API calls, backend verification, signing, tests; written for developers and AI agents.
- Upgrading from 1.x or 2.0.x? Read [docs/MIGRATION.md](docs/MIGRATION.md) (5 minutes).
- **Live demo: <https://algorand-authentication-demo-seven.vercel.app>** (ARC-76 sign-in, wallets incl. Biatec, transaction + raw data signing, 14 languages) · demo source:
  [`algorand-authentication-demo`](https://github.com/ludovit-scholtz/algorand-authentication-component-vue/tree/main/algorand-authentication-demo)

## Install

```bash
pnpm add algorand-authentication-component-vue @txnlab/use-wallet-vue algosdk vue
# plus the wallets you want to offer, e.g.
pnpm add @txnlab/use-wallet-pera @txnlab/use-wallet-defly biatec-wallet-use-wallet-client
```

Peer dependencies: `vue ^3.5`, `@txnlab/use-wallet-vue ^5`, `algosdk ^3.5` (plus a small `tweetnacl` dependency for ARC-60).

## Quick start

> Two usage modes — a **protected app** (`authorizedOnlyAccess`) and a **public page with a Login button** whose content
> changes once the user is signed in (below, and step by step in the
> [integration guide](https://github.com/ludovit-scholtz/algorand-authentication-component-vue/blob/main/algorand-authentication-component-vue/docs/INTEGRATION.md#4-public-page-with-a-login-button)).

`main.ts` — register the wallets once and import the component's stylesheet:

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

`App.vue` — wrap the content that needs a signed-in user:

```vue
<script setup lang="ts">
import { AlgorandAuthentication, useAVMAuthentication } from 'algorand-authentication-component-vue'

const auth = useAVMAuthentication()

async function callApi() {
  const res = await fetch('/api/me', { headers: { Authorization: auth.authStore.arc14Header } })
  return res.json()
}
</script>

<template>
  <AlgorandAuthentication arc14Realm="MyApp" authorizedOnlyAccess>
    <p>Signed in as {{ auth.authStore.account }} ({{ auth.authStore.wallet }})</p>
    <button @click="callApi">Call API</button>
    <button @click="auth.logout()">Log out</button>
  </AlgorandAuthentication>
</template>
```

With `authorizedOnlyAccess` the sign-in screen replaces the slot until the user is authenticated.
Without it the slot is always rendered and you open the sign-in screen yourself with
`auth.authenticate()`.

**Public page with a Login button** — the content changes with `isAuthenticated`:

```vue
<AlgorandAuthentication arc14Realm="MyApp">
  <button v-if="!auth.authStore.isAuthenticated" @click="auth.authenticate()">Log in</button>
  <button v-else @click="auth.logout()">Log out</button>

  <PublicTeaser v-if="!auth.authStore.isAuthenticated" />
  <MemberArea v-else />
</AlgorandAuthentication>
```

## `<AlgorandAuthentication>`

| Prop                   | Type                 | Default                | Description                                                                                        |
| ---------------------- | -------------------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| `arc14Realm`           | `string`             | **required**           | Realm written to the ARC-14 note: `<realm>#ARC14`. Your backend checks it.                         |
| `authorizedOnlyAccess` | `boolean`            | `false`                | Show the sign-in screen instead of the slot until `isAuthenticated`.                               |
| `wallets`              | `string[]`           | `[]` (all)             | Wallet ids to offer (`'biatec'`, `'pera'`, …). Empty = every wallet available on the active network. |
| `algodHost`            | `string`             | active use-wallet node | Custom algod used to fetch transaction parameters.                                                 |
| `algodPort`            | `number \| string`   | `''`                   | Port of the custom algod.                                                                          |
| `algodToken`           | `string`             | `''`                   | Token of the custom algod.                                                                         |
| `coverImage`           | `string`             | gradient               | Background image URL for the sign-in screen.                                                       |
| `locale`               | `string`             | browser language       | Language tag (`sk`, `de-AT`, …). See [Localization](#localization).                                |
| `messages`             | `Partial<AuthMessages>` | –                   | Override single UI strings of the active language.                                                 |
| `theme`                | `'auto' \| 'light' \| 'dark'` | `auto`      | Colour scheme. `auto` follows the OS and the host page; see [Light and dark mode](#light-and-dark-mode). |

Any other attribute (e.g. `class`) is applied to the sign-in screen root element.

| Event            | Payload                                          | When                                      |
| ---------------- | ------------------------------------------------ | ----------------------------------------- |
| `onNotification` | `{ severity: 'error' \| 'success' \| 'info' \| 'warn'; message: string }` | Wallet or derivation errors. Show them in your toast system. |
| `authenticated`  | `{ account: string; wallet: string; arc14Header: string }` | The user finished signing in.             |

The default slot is rendered when the sign-in screen is not shown. While an ARC-76 account signs a
transaction the component shows a password dialog on top of the slot.

## `useAVMAuthentication()`

Call it inside `setup()` of a component under `WalletManagerPlugin`.

```ts
const { authStore, authenticate, logout, sign, signData, canSignData } = useAVMAuthentication()
```

| Member              | Description                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `authStore`         | Reactive state, see below.                                                                              |
| `authenticate()`    | Opens the sign-in screen (`authStore.inAuthentication = true`).                                         |
| `logout()`          | Async. Disconnects the wallet used to sign in, clears the store, bumps `authStore.count`.               |
| `sign(txns, idx, signer?)` | Signs a group with the wallet **or** the ARC-76 account the user signed in with. `signer` defaults to use-wallet's `transactionSigner`. Rejects when the user cancels or the wallet fails. |

```ts
const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender, receiver, amount, suggestedParams })
const [signed] = await auth.sign([txn], [0]) // Uint8Array, ready for algod.sendRawTransaction
```

| `signData(base64, metadata?)` | ARC-60 raw data signing. Wallets sign through use-wallet's `signData` (if `canSignData()`), ARC-76 accounts after a password prompt. Resolves with `{ data, signer, domain, authenticatorData, signature }`. |
| `canSignData()`     | `true` for ARC-76 accounts and for wallets that support ARC-60 (Biatec does; the mnemonic adapter does not). |

```ts
const res = await auth.signData(btoa('Sign in to MyApp at 2026-10-03')) // data is base64
await verifyArc60(res) // true
```

The signature is Ed25519 over `SHA-256(data) || SHA-256(authenticatorData)` with
`authenticatorData = SHA-256(location.host)` (ARC-60, AUTH scope), so it is bound to your site. Biatec
Wallet additionally requires `location.host` to equal the hostname of the page that connected, which
means ARC-60 signing works on `https://your.domain` but is rejected on `localhost:<port>` (the port is
part of `host`). Test it behind a port-less host — see the live Playwright spec.

`authStore` fields: `isAuthenticated`, `account`, `wallet` (`'arc76'` or a use-wallet id),
`arc14Header` (`SigTx <base64>`), `arc76email`, `inAuthentication`, `inWalletSignature`,
`inArc76Signature`, `count` (incremented on every login/logout — handy to `watch`).

Also exported: `arc14(realm, address, suggestedParams)`, `arc14Header(signedTxn)`,
`deriveArc76Account(email, password)`, `signArc60(base64, account)` and `verifyArc60(response)`.

## Verifying the header on your backend

`Authorization: SigTx <base64>` is a base64 msgpack-encoded **signed** zero-amount self payment whose
note is `<realm>#ARC14`. It is never sent to the network. Verify on every request:

1. Decode with `algosdk.decodeSignedTransaction`; require a payment with `amount = 0`, `fee = 0`,
   `sender == receiver` and `note == "<realm>#ARC14"` for **your** realm.
2. Verify the Ed25519 signature over `"TX" + encodeUnsignedTransaction(txn)` with the public key of
   `sender` (or of `sgnr` for rekeyed accounts).
3. Reject headers outside the transaction validity window (`firstValid` … `lastValid`) so a leaked
   header expires; `sender` is the authenticated address.

```ts
import algosdk from 'algosdk'
import { createPublicKey, verify } from 'node:crypto'

export function verifyArc14(header: string, realm: string): string {
  const signed = algosdk.decodeSignedTransaction(Buffer.from(header.replace(/^SigTx /, ''), 'base64'))
  const t = signed.txn
  const ok =
    t.payment?.amount === 0n && t.fee === 0n &&
    t.sender.toString() === t.payment.receiver.toString() &&
    new TextDecoder().decode(t.note) === `${realm}#ARC14`
  if (!ok || !signed.sig) throw new Error('Invalid ARC-14 transaction')
  const signer = signed.sgnr ?? t.sender
  const key = createPublicKey({
    key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(signer.publicKey)]),
    format: 'der',
    type: 'spki'
  })
  const message = Buffer.concat([Buffer.from('TX'), Buffer.from(algosdk.encodeUnsignedTransaction(t))])
  if (!verify(null, message, key, Buffer.from(signed.sig))) throw new Error('Bad signature')
  return t.sender.toString()
}
```

## ARC-76 accounts

Email + password are run through PBKDF2-SHA256 (999 999 rounds, Web Crypto) into an Ed25519 key —
the same account on every device and in every ARC-76-compatible app (for example Biatec). Nothing is
stored: the password is requested again to sign each transaction group, and a wrong password never
signs. Passwords must be at least 16 characters. Registration only adds a confirmation field; the
account exists as soon as someone derives it.

## Localization

Every string of the component is translated into the **14 languages used by Biatec Wallet and Biatec
DEX**: Afrikaans `af`, Čeština `cs`, Deutsch `de`, English `en`, Español `es`, Magyar `hu`, Italiano `it`,
한국어 `ko`, Nederlands `nl`, Polski `pl`, Русский `ru`, Slovenčina `sk`, Türkçe `tr`, 中文 `zh`.

```vue
<AlgorandAuthentication arc14Realm="MyApp" locale="sk" :messages="{ signIn: 'Vitajte' }" />
```

- No `locale` → the browser's `navigator.languages`, falling back to English. Regional tags match their
  base language (`zh-TW` → `zh`, `de-AT` → `de`). The sign-in screen and the password dialog get a matching
  `lang` attribute.
- `messages` overrides individual keys; placeholders are `{wallet}`, `{min}`, `{count}`, `{address}`.
- Exports for your own pickers: `SUPPORTED_LOCALES`, `LOCALE_NAMES` (native names), `resolveLocale()`,
  `authMessages` (the whole catalog) and `formatMessage()`; types `AuthLocale`, `AuthMessages`.
- Errors thrown by `useAVMAuthentication()` itself (outside the component) stay in English; the strings the
  component shows or rejects with (for example *signing cancelled*) are translated.
- **Biatec connect dialog:** `biatec-wallet-use-wallet-client` ships its own dialog translations for
  `af cs en es hu it nl ru sk tr` and reads `locale` when the wallet manager is created —
  `biatec({ projectId, locale })`. The Biatec DEX languages `de ko pl zh` fall back to English inside
  that dialog (it has its own flag switcher). The demo passes the selected language and therefore reloads
  the page when it changes.

## Styling

The component ships one stylesheet (`algorand-authentication-component-vue/style.css`, ~2 kB gzip),
all classes are prefixed `aa-`, and it needs neither Tailwind nor PrimeVue. Theme it by overriding
CSS variables on `.aa-root`:

```css
.aa-root {
  --aa-primary: #7c3aed;
  --aa-primary-hover: #6d28d9;
  --aa-dark-panel: rgba(15, 23, 42, 0.85);
  --aa-radius: 0.75rem;
  --aa-cover: url('/my-background.jpg'); /* or use the coverImage prop */
}
```

Available variables (each has a light and a dark value):

| Group    | Variables |
| -------- | --------- |
| Brand    | `--aa-primary`, `--aa-primary-hover`, `--aa-primary-contrast`, `--aa-focus`, `--aa-focus-ring` |
| Text     | `--aa-text`, `--aa-heading`, `--aa-text-muted`, `--aa-label`, `--aa-placeholder`, `--aa-icon`, `--aa-icon-hover` |
| Surfaces | `--aa-surface`, `--aa-surface-border`, `--aa-input-bg`, `--aa-input-disabled-bg`, `--aa-border`, `--aa-card-shadow`, `--aa-overlay` |
| Buttons  | `--aa-secondary`, `--aa-secondary-text`, `--aa-secondary-hover`, `--aa-light-btn`, `--aa-light-btn-hover`, `--aa-light-btn-text` |
| Alerts   | `--aa-danger-bg`/`-text`, `--aa-success-bg`/`-text`, `--aa-info-bg`/`-text`, `--aa-warn-bg`/`-text` |
| Panels   | `--aa-form-panel`, `--aa-dark-panel`, `--aa-wallet-text`, `--aa-wallet-muted`, `--aa-wallet-bg`, `--aa-wallet-bg-hover`, `--aa-wallet-border` |
| Shape    | `--aa-radius`, `--aa-radius-sm`, `--aa-cover` |

### Light and dark mode

The component ships a light and a dark palette (each token is one CSS `light-dark()` pair) and picks one:

| `theme` | Result |
| ------- | ------ |
| `auto` (default) | Follows the host page — an ancestor with `.dark` / `data-theme="dark"` (or `.light` / `data-theme="light"`) — and otherwise the OS (`prefers-color-scheme`). |
| `light` | Always light, even if the OS or page is dark. |
| `dark` | Always dark. |

```vue
<!-- follow the OS / host page -->
<AlgorandAuthentication arc14Realm="MyApp" />

<!-- bind it to your own theme switcher -->
<AlgorandAuthentication arc14Realm="MyApp" :theme="isDark ? 'dark' : 'light'" />
```

If a `.dark` and a `.light` ancestor are both present, `.light` wins — pass `theme` explicitly in that case.
The prop sets `data-theme` on the sign-in screen and on the password dialog; your slotted app content is
**not** touched — theme it with your own styles. Requires `light-dark()` support (Chrome/Edge 123, Firefox 120,
Safari 17.5, i.e. every browser since spring 2024).

Brand colours: a plain override beats the defaults and applies to **both** schemes. Use `light-dark()` for
different values per scheme:

```css
.aa-root {
  --aa-primary: #7c3aed; /* same in light and dark */
  --aa-surface: light-dark(#ffffff, #1e1b4b); /* different per scheme */
}
```

Contrast of the form card (default, hover, registration, error) is verified with axe in both schemes in the
Playwright suite.

The layout is two panels (form | wallets) on screens ≥ 768 px and stacked below that.

## Wallets

Any use-wallet v5 adapter works. The component lists `availableWallets` of the active network
(so the testnet-only mnemonic adapter disappears on mainnet), signs the ARC-14 transaction with the
chosen wallet and, if a wallet session is restored after a page reload, offers *“Sign in with
\<wallet\>”* instead of silently prompting.

Bundlers: Pera, Defly and WalletConnect-based wallets still expect `Buffer`/`process` globals —
see the demo's [`main.ts`](../algorand-authentication-demo/src/main.ts) and `vite.config.ts`.

## Development

```bash
pnpm install           # at the repository root
pnpm build             # type-check, library build, declarations
pnpm test              # vitest unit + component tests
pnpm demo              # run the demo app
pnpm test:e2e          # Playwright against the demo, including the live Biatec Wallet
```

## For AI coding agents

Start with the [integration guide](https://github.com/ludovit-scholtz/algorand-authentication-component-vue/blob/main/algorand-authentication-component-vue/docs/INTEGRATION.md) (also shipped in the npm package as `docs/INTEGRATION.md`,
indexed in `llms.txt`). [`docs/AI_INTEGRATION.md`](docs/AI_INTEGRATION.md) explains how to hand
[`skill/algorand-authentication-integration/SKILL.md`](skill/algorand-authentication-integration/SKILL.md) —
a self-contained, step-by-step playbook — to Claude Code, Cursor, Copilot or any other agent so it can
integrate this component into your project correctly on the first try. It ships inside the npm package.
