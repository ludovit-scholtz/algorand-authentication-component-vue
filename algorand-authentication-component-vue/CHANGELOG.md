# Changelog

## 2.0.0

### Breaking

- Requires `@txnlab/use-wallet-vue` **5** (wallets are separate `@txnlab/use-wallet-*` packages) and `algosdk` ≥ 3.5.
- PrimeVue and Tailwind are no longer dependencies. Import `algorand-authentication-component-vue/style.css`.
- `logout()` is async and disconnects the connected wallet.
- Removed the `useDemoMnemonics` prop and the 1.x mnemonic panel; `wallets` now filters by use-wallet wallet id.
- Package is ESM-first (`"type": "module"`): files are `algorand-authentication-component-vue.js` / `.umd.cjs`.
- ARC-76 password dialog is a modal over the page instead of replacing it.

### Added

- Wallet sign-in produces an ARC-14 header (`SigTx …`) with the connected wallet (Biatec, Pera, Defly, …).
- Restored wallet sessions show “Sign in with <wallet>”.
- `authenticated` event, `coverImage` prop, theming through `--aa-*` CSS variables, responsive layout,
  accessible forms (labels, show/hide password, `aria-live` errors, focus rings, Escape closes dialogs).
- Localization: `locale` / `messages` props and a catalog for 14 languages (af cs de en es hu it ko nl pl ru sk tr zh = Biatec Wallet + Biatec DEX); exports `SUPPORTED_LOCALES`, `LOCALE_NAMES`, `resolveLocale`, `authMessages`, `formatMessage`.
- ARC-60 raw data signing: `signData()` / `canSignData()` (wallets via use-wallet, ARC-76 accounts via the password dialog), `signArc60`, `verifyArc60`.
- Exports `arc14`, `arc14Header`, `deriveArc76Account`; `sign()` signer argument is optional.
- Integration guide (`docs/INTEGRATION.md`, protected app and public page with a Login button), `llms.txt`, AI integration guide and portable agent skill (`skill/algorand-authentication-integration/SKILL.md`).
- Unit/component tests (Vitest) and Playwright end-to-end tests in the demo, including the live Biatec Wallet.

### Fixed

- A wrong ARC-76 password no longer signs the transaction.
- Cancelling the ARC-76 dialog rejects `sign()` instead of leaving it pending.
- Minimum password length is 16 as documented (was effectively 17); `inWalletSignature` is reset.

### Dependencies

Vite 8, Vue 3.5, Vitest 5, ESLint 10 (flat config), TypeScript 6, vue-tsc 3, Prettier 3.9, algosdk 3.8.

## 1.1.3

Last 1.x release (use-wallet 4, PrimeVue).
