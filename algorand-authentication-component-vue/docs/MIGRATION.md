# Migrating from 1.x to 2.0

2.0 is a breaking release. The authentication flow (ARC-14 header, ARC-76 derivation) is unchanged, so
**existing ARC-76 accounts keep the same addresses** and **backends need no changes**.

## What changed

| Area               | 1.x                                                                | 2.x                                                                                  |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| use-wallet         | `@txnlab/use-wallet-vue` ^4 (wallets bundled)                      | `@txnlab/use-wallet-vue` **^5**, one package per wallet                              |
| UI dependencies    | PrimeVue 4, Tailwind classes, `tailwindcss-primeui`                | **None.** Own stylesheet, `aa-` prefixed classes, CSS variables                      |
| Styles             | Host app had to provide Tailwind utilities                         | `import 'algorand-authentication-component-vue/style.css'`                           |
| Build output       | `*.es.js`, `*.umd.js`                                              | `algorand-authentication-component-vue.js` (ESM) and `.umd.cjs`; package is `"type": "module"` |
| Wallet sign-in     | Connected the wallet but never produced an ARC-14 header           | Connect → sign ARC-14 with the wallet → `isAuthenticated`, `arc14Header`, `account`  |
| `logout()`         | Sync, left the wallet connected                                    | **Async**, disconnects the wallet                                                    |
| `sign()`           | `sign(txns, indexes, transactionSigner)` — signer required         | `sign(txns, indexes, transactionSigner?)` — defaults to use-wallet's signer; always rejects on cancel/failure |
| ARC-76 signing UI  | Replaced the whole page                                            | Modal dialog on top of your content                                                  |
| Props              | `wallets` (ignored), `useDemoMnemonics`, `algodHost/Port` required | `wallets` filters by wallet id, `useDemoMnemonics` removed, algod props optional, new `coverImage` |
| Events             | `onNotification`                                                   | `onNotification`, `authenticated`                                                    |

Bug fixes you get for free: wrong ARC-76 password no longer signs anyway; cancelling the dialog rejects
`sign()` instead of hanging; the minimum password length is really 16 (1.x demanded 17); `inWalletSignature`
is reset after signing.

## Steps

1. **Dependencies**

   ```bash
   pnpm remove primevue @primevue/themes @primevue/auto-import-resolver tailwindcss-primeui   # if you only used them for this component
   pnpm add algorand-authentication-component-vue@^2 @txnlab/use-wallet-vue@^5 algosdk@^3.5
   pnpm add @txnlab/use-wallet-pera @txnlab/use-wallet-defly @txnlab/use-wallet-exodus \
            @txnlab/use-wallet-kibisis @txnlab/use-wallet-lute biatec-wallet-use-wallet-client
   ```

   `@txnlab/use-wallet-vue` 5 also needs the wallet packages you want — v4 bundled them.
   Drop wallet SDKs you only had for use-wallet 4 (`@perawallet/connect`, `@blockshake/defly-connect`,
   `@walletconnect/*`, `lute-connect`, `@magic-ext/algorand`, `@agoralabs-sh/avm-web-provider`); the wallet
   packages bring their own.

2. **Wallet registration** — enums become factories:

   ```ts
   // 1.x / use-wallet 4
   app.use(WalletManagerPlugin, {
     wallets: [WalletId.PERA, WalletId.DEFLY, { id: WalletId.BIATEC, options: { projectId } }],
     defaultNetwork: NetworkId.TESTNET
   })

   // 2.x / use-wallet 5
   import { pera } from '@txnlab/use-wallet-pera'
   import { defly } from '@txnlab/use-wallet-defly'
   import { biatec } from 'biatec-wallet-use-wallet-client'
   app.use(WalletManagerPlugin, {
     wallets: [biatec({ projectId }), pera(), defly()],
     defaultNetwork: 'testnet'
   })
   ```

   Other use-wallet 5 changes (network ids are plain strings, `WalletId`/`NetworkId` are no longer
   the source of truth for wallet ids) are listed in the
   [use-wallet release notes](https://github.com/TxnLab/use-wallet/releases).

3. **Styles** — replace the old `dist/algorand-authentication-component-vue.css` import (it still resolves) with
   `algorand-authentication-component-vue/style.css`. You can delete the PrimeVue plugin, `ToastService`
   and the Tailwind `@source`/`primeui` setup *if nothing else in your app uses them*; render
   `onNotification` messages in whatever toast system you have.

4. **Component props** — remove `useDemoMnemonics`; `wallets` now takes use-wallet ids (`'pera'`, `'biatec'`) and
   an empty/omitted list shows every wallet; remove `algodHost/algodPort` unless you want a custom node (the
   active use-wallet network is used by default).

5. **Code that calls `logout()`** — it returns a promise now: `await auth.logout()`.

6. **Code that calls `sign()`** — you can drop the third argument; keep a `try/catch` (user cancel = rejection).

7. **Mnemonic wallet** — the 1.x “mnemonic input panel” is gone. For development use
   `@txnlab/use-wallet-mnemonic` (testnet only).

## Compatibility notes

- Node ≥ 20, Vite ≥ 5 (tested with Vite 8), Vue ≥ 3.5, TypeScript ≥ 5.
- `authStore.m` and `authStore.name` still exist for type compatibility but are unused.
- The exported `Account` and `INotification` types are unchanged.
